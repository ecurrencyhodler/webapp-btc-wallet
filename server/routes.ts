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
    
    const priceSources = [
      {
        name: "CoinGecko",
        url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        extract: (data: any) => data?.bitcoin?.usd
      },
      {
        name: "Coinbase",
        url: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
        extract: (data: any) => data?.data?.amount ? parseFloat(data.data.amount) : null
      },
      {
        name: "Blockchain.info",
        url: "https://blockchain.info/ticker",
        extract: (data: any) => data?.USD?.last
      },
      {
        name: "Kraken",
        url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
        extract: (data: any) => data?.result?.XXBTZUSD?.c?.[0] ? parseFloat(data.result.XXBTZUSD.c[0]) : null
      }
    ];
    
    for (const source of priceSources) {
      try {
        const response = await fetch(source.url, { signal: AbortSignal.timeout(3000) });
        const data = await response.json();
        const price = source.extract(data);
        
        if (price && price > 0) {
          cachedPrice = price;
          lastPriceUpdate = now;
          res.json({ price: cachedPrice });
          return;
        }
      } catch (error) {
        console.log(`${source.name} price fetch failed, trying next...`);
      }
    }
    
    // Return cached price as last resort
    console.error("All price sources failed, using cached price");
    res.json({ price: cachedPrice })
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

  // Get UTXOs for addresses
  app.post("/api/utxos", async (req, res) => {
    try {
      const { addresses } = req.body;
      
      if (!addresses || !Array.isArray(addresses)) {
        res.status(400).json({ error: "Addresses array required" });
        return;
      }
      
      const allUtxos: any[] = [];
      
      for (const address of addresses) {
        try {
          const response = await fetch(`https://blockstream.info/api/address/${address}/utxo`);
          if (response.ok) {
            const utxos = await response.json();
            // Add address index info to each UTXO
            const addressIndex = addresses.indexOf(address);
            for (const utxo of utxos) {
              allUtxos.push({
                ...utxo,
                address,
                addressIndex
              });
            }
          }
        } catch (err) {
          console.log(`Failed to fetch UTXOs for ${address}`);
        }
      }
      
      res.json({ utxos: allUtxos });
    } catch (error) {
      console.error("Error fetching UTXOs:", error);
      res.status(500).json({ error: "Failed to fetch UTXOs" });
    }
  });

  // Get raw transaction hex for PSBT input
  app.get("/api/tx/:txid/hex", async (req, res) => {
    try {
      const { txid } = req.params;
      const response = await fetch(`https://blockstream.info/api/tx/${txid}/hex`);
      
      if (!response.ok) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      
      const hex = await response.text();
      res.json({ hex });
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  // Broadcast signed transaction
  app.post("/api/broadcast", async (req, res) => {
    try {
      const { txHex } = req.body;
      
      if (!txHex) {
        res.status(400).json({ error: "Transaction hex required" });
        return;
      }
      
      const response = await fetch("https://blockstream.info/api/tx", {
        method: "POST",
        body: txHex,
        headers: { "Content-Type": "text/plain" }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        res.status(400).json({ error: errorText || "Broadcast failed" });
        return;
      }
      
      const txid = await response.text();
      res.json({ txid });
    } catch (error) {
      console.error("Error broadcasting transaction:", error);
      res.status(500).json({ error: "Failed to broadcast transaction" });
    }
  });

  return httpServer;
}
