import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get Bitcoin price in USD from CoinGecko (no API key required)
  app.get("/api/btc-price", async (req, res) => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
      );
      const data = await response.json();
      res.json({ price: data.bitcoin.usd });
    } catch (error) {
      console.error("Error fetching BTC price:", error);
      res.status(500).json({ error: "Failed to fetch Bitcoin price" });
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
      
      // For a complete implementation, you would use bitcoinjs-message library
      // to verify the signature cryptographically. For now, we'll return a 
      // placeholder that indicates this needs the bitcoinjs-message package.
      // 
      // Example with bitcoinjs-message:
      // const bitcoinMessage = require('bitcoinjs-message');
      // const isValid = bitcoinMessage.verify(message, address, signature);
      
      // Since signature verification requires crypto libraries that need
      // proper setup, we'll indicate this feature needs enhancement
      res.json({ 
        valid: false, 
        message: "Signature verification requires additional setup. The signature format from Ledger needs to be converted to Bitcoin message signature format."
      });
    } catch (error) {
      console.error("Error verifying signature:", error);
      res.json({ valid: false, error: "Verification failed" });
    }
  });

  return httpServer;
}
