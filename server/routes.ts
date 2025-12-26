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

  // Get address balance and transactions from Blockchain.info
  app.get("/api/address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      // Fetch from blockchain.info API (no key needed for basic queries)
      const response = await fetch(
        `https://blockchain.info/rawaddr/${address}?limit=10`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch address data");
      }
      
      const data = await response.json();
      
      // Convert satoshis to BTC
      const balanceBTC = data.final_balance / 100000000;
      
      // Format transactions
      const transactions = data.txs.slice(0, 10).map((tx: any) => {
        // Determine if sent or received
        const isSent = tx.inputs.some((input: any) => 
          input.prev_out?.addr === address
        );
        
        // Calculate amount for this address
        let amount = 0;
        if (isSent) {
          // Sum outputs not going back to this address
          amount = tx.out
            .filter((out: any) => out.addr !== address)
            .reduce((sum: number, out: any) => sum + out.value, 0) / 100000000;
        } else {
          // Sum outputs going to this address
          amount = tx.out
            .filter((out: any) => out.addr === address)
            .reduce((sum: number, out: any) => sum + out.value, 0) / 100000000;
        }
        
        return {
          id: tx.hash,
          type: isSent ? "sent" : "received",
          amount,
          date: new Date(tx.time * 1000).toISOString(),
          address: isSent 
            ? tx.out.find((o: any) => o.addr !== address)?.addr || "Unknown"
            : tx.inputs[0]?.prev_out?.addr || "Unknown",
          status: "confirmed",
          confirmations: tx.block_height ? data.n_tx : 0
        };
      });
      
      res.json({
        balance: balanceBTC,
        transactions
      });
    } catch (error) {
      console.error("Error fetching address data:", error);
      res.status(500).json({ error: "Failed to fetch address data" });
    }
  });

  return httpServer;
}
