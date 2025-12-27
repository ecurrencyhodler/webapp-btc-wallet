import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bitcoinMessage from "bitcoinjs-message";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get Bitcoin price in USD - try multiple sources
  let cachedPrice = 87000; // Fallback price
  let lastPriceUpdate = 0;
  
  app.get("/api/btc-price", async (req, res) => {
    const now = Date.now();
    
    // Use cached price if updated within last 30 seconds
    if (now - lastPriceUpdate < 30000 && cachedPrice > 0) {
      res.json({ price: cachedPrice });
      return;
    }
    
    try {
      // Try CoinGecko first
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await response.json();
      
      if (data?.bitcoin?.usd) {
        cachedPrice = data.bitcoin.usd;
        lastPriceUpdate = now;
        res.json({ price: cachedPrice });
        return;
      }
      
      throw new Error("Invalid response format");
    } catch (error) {
      // Try Blockchain.info as fallback
      try {
        const fallbackResponse = await fetch(
          "https://blockchain.info/ticker",
          { signal: AbortSignal.timeout(5000) }
        );
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData?.USD?.last) {
          cachedPrice = fallbackData.USD.last;
          lastPriceUpdate = now;
          res.json({ price: cachedPrice });
          return;
        }
      } catch (fallbackError) {
        console.error("Fallback price fetch failed:", fallbackError);
      }
      
      // Return cached price as last resort
      console.error("Error fetching BTC price:", error);
      res.json({ price: cachedPrice });
    }
  });

  // Get address balance and transactions from Blockstream API (better bc1 support)
  app.get("/api/address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      // Use Blockstream API - better support for Native SegWit addresses
      const [addressResponse, txsResponse] = await Promise.all([
        fetch(`https://blockstream.info/api/address/${address}`),
        fetch(`https://blockstream.info/api/address/${address}/txs`)
      ]);
      
      if (!addressResponse.ok) {
        // Address might be new with no history
        res.json({ balance: 0, transactions: [] });
        return;
      }
      
      const addressData = await addressResponse.json();
      const txsData = txsResponse.ok ? await txsResponse.json() : [];
      
      // Calculate balance (funded - spent) in BTC
      const balanceSatoshis = 
        (addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum) +
        (addressData.mempool_stats.funded_txo_sum - addressData.mempool_stats.spent_txo_sum);
      const balanceBTC = balanceSatoshis / 100000000;
      
      // Format transactions
      const transactions = txsData.slice(0, 10).map((tx: any) => {
        // Determine if sent or received by checking inputs
        const isSent = tx.vin.some((input: any) => 
          input.prevout?.scriptpubkey_address === address
        );
        
        // Calculate amount for this address
        let amount = 0;
        if (isSent) {
          // Sum outputs not going back to this address
          amount = tx.vout
            .filter((out: any) => out.scriptpubkey_address !== address)
            .reduce((sum: number, out: any) => sum + (out.value || 0), 0) / 100000000;
        } else {
          // Sum outputs going to this address
          amount = tx.vout
            .filter((out: any) => out.scriptpubkey_address === address)
            .reduce((sum: number, out: any) => sum + (out.value || 0), 0) / 100000000;
        }
        
        const isConfirmed = tx.status?.confirmed === true;
        const txTime = tx.status?.block_time || Math.floor(Date.now() / 1000);
        
        return {
          id: tx.txid,
          type: isSent ? "sent" : "received",
          amount,
          date: new Date(txTime * 1000).toISOString(),
          address: isSent 
            ? tx.vout.find((o: any) => o.scriptpubkey_address !== address)?.scriptpubkey_address || "Unknown"
            : tx.vin[0]?.prevout?.scriptpubkey_address || "Unknown",
          status: isConfirmed ? "confirmed" : "pending"
        };
      });
      
      res.json({
        balance: balanceBTC,
        transactions
      });
    } catch (error) {
      console.error("Error fetching address data:", error);
      // Return empty state instead of error for new addresses
      res.json({ balance: 0, transactions: [] });
    }
  });

  // Verify Bitcoin message signature
  app.post("/api/verify-signature", async (req, res) => {
    try {
      const { address, message, signature } = req.body;
      
      if (!address || !message || !signature) {
        res.status(400).json({ error: "Missing required fields", valid: false });
        return;
      }
      
      // For Native SegWit addresses (bc1...), we need special handling
      const isSegwit = address.startsWith('bc1') || address.startsWith('tb1');
      
      try {
        // Try standard verification first
        const isValid = bitcoinMessage.verify(message, address, signature);
        res.json({ valid: isValid });
        return;
      } catch (e1) {
        // For SegWit, try with checkSegwitAlways flag
        if (isSegwit) {
          try {
            const isValid = bitcoinMessage.verify(message, address, signature, undefined, true);
            res.json({ valid: isValid });
            return;
          } catch (e2) {
            // Try converting signature format - Ledger may return different format
            try {
              const sigBuffer = Buffer.from(signature, 'base64');
              // Adjust recovery flag for SegWit (BIP137)
              if (sigBuffer.length === 65) {
                // Try different recovery flags for p2wpkh (39-42)
                for (let flag = 39; flag <= 42; flag++) {
                  try {
                    const adjustedSig = Buffer.concat([Buffer.from([flag]), sigBuffer.slice(1)]);
                    const isValid = bitcoinMessage.verify(message, address, adjustedSig, undefined, true);
                    if (isValid) {
                      res.json({ valid: true });
                      return;
                    }
                  } catch (e) {
                    continue;
                  }
                }
              }
            } catch (e3) {
              // Fall through
            }
          }
        }
        
        res.json({ valid: false, error: "Signature verification failed" });
      }
    } catch (error) {
      console.error("Error verifying signature:", error);
      res.json({ valid: false, error: "Verification failed" });
    }
  });

  return httpServer;
}
