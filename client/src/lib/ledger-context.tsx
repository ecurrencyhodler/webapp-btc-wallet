import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import AppBtc from "@ledgerhq/hw-app-btc";
import { Buffer } from 'buffer';

type LedgerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface Transaction {
  id: string;
  type: 'sent' | 'received';
  amount: number;
  date: Date;
  address: string;
  status: 'confirmed' | 'pending';
}

interface LedgerContextType {
  status: LedgerStatus;
  btcBalance: number;
  btcPrice: number;
  address: string;
  transactions: Transaction[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendBitcoin: (amount: number, to: string) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  signPsbt: (psbtBase64: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LedgerStatus>('disconnected');
  const [btcBalance, setBtcBalance] = useState(0);
  const [btcPrice, setBtcPrice] = useState(96420.50);
  const [address, setAddress] = useState("");
  const [transport, setTransport] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Fetch BTC price on mount and every 60 seconds
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch('/api/btc-price');
        const data = await response.json();
        setBtcPrice(data.price);
      } catch (error) {
        console.error('Failed to fetch BTC price:', error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch address data when address changes
  useEffect(() => {
    if (address) {
      refreshBalance();
    }
  }, [address]);

  const connect = async () => {
    try {
      setStatus('connecting');
      const transport = await TransportWebHID.create();
      setTransport(transport);
      
      const btc = new AppBtc({ transport, currency: "bitcoin" });
      
      // Get Native Segwit Address (bech32)
      // Path: 84'/0'/0'/0/0
      const result = await btc.getWalletPublicKey("84'/0'/0'/0/0", {
        format: "bech32"
      });
      
      setAddress(result.bitcoinAddress);

      setStatus('connected');
      toast({
        title: "Ledger Connected",
        description: "Device connected successfully.",
        variant: "default",
      });
      
      transport.on("disconnect", () => {
        disconnect();
      });

    } catch (e: any) {
      console.error(e);
      setStatus('error');

      // Handle specific HID permission error
      if (e.message && e.message.includes("disallowed by permissions policy")) {
        toast({
          title: "Permission Error",
          description: "WebHID is not supported in this embedded view. Please open the app in a new tab.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: e.message || "Could not connect to device.",
          variant: "destructive",
        });
      }
    }
  };

  const disconnect = () => {
    if (transport) {
      transport.close();
      setTransport(null);
    }
    setStatus('disconnected');
    setAddress("");
    setBtcBalance(0);
    setTransactions([]);
    toast({
      title: "Ledger Disconnected",
      description: "Device safely disconnected.",
    });
  };

  const sendBitcoin = async (amount: number, to: string) => {
    if (!transport || status !== 'connected') throw new Error("Device not connected");
    if (amount > btcBalance) throw new Error("Insufficient funds");
    
    // In a real implementation, we would:
    // 1. Fetch UTXOs from an explorer API
    // 2. Construct the transaction
    // 3. Use btc.createPaymentTransactionNew to sign inputs
    // 4. Broadcast via API
    
    // For this prototype, we simulate the interaction
    toast({
      title: "Confirm on Device",
      description: "Please review and approve the transaction on your Ledger.",
    });

    // Simulate delay for user interaction
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setBtcBalance(prev => prev - amount);
    setTransactions(prev => [{
      id: `tx-${Date.now()}`,
      type: 'sent',
      amount,
      date: new Date(),
      address: to,
      status: 'pending'
    }, ...prev]);
    
    return "tx_hash_simulated_" + Math.random().toString(36).substring(7);
  };

  const signMessage = async (message: string) => {
    if (!transport || status !== 'connected') throw new Error("Device not connected");
    
    toast({
      title: "Confirm on Device",
      description: "Please review and sign the message on your Ledger.",
    });

    try {
      const btc = new AppBtc({ transport, currency: "bitcoin" });
      const path = "84'/0'/0'/0/0"; // Same path as address
      const hexMessage = Buffer.from(message).toString('hex');
      
      const result = await btc.signMessage(path, hexMessage);
      
      // Convert v, r, s to base64 signature
      const v = result['v'];
      const r = result['r'];
      const s = result['s'];
      
      // This is a simplified representation. A real implementation would verify the signature format needed.
      return `r:${r}, s:${s}, v:${v}`;
    } catch (e: any) {
      console.error("Signing failed", e);
      throw new Error(e.message || "Signing failed");
    }
  };

  // Ledger JS SDK doesn't have a direct "signPSBT" method easily exposed in the high-level API for all cases
  // usually it involves parsing the PSBT and signing inputs individually.
  // We will keep this simulated for simplicity unless specific PSBT libraries are added.
  const signPsbt = async (psbtBase64: string) => {
    if (status !== 'connected') throw new Error("Device not connected");
    
    toast({
      title: "Confirm on Device",
      description: "Please review the transaction details.",
    });

    // Simulate signing delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    return psbtBase64 + "_signed_simulated";
  };

  const refreshBalance = async () => {
    if (!address) return;
    
    try {
      const response = await fetch(`/api/address/${address}`);
      const data = await response.json();
      
      setBtcBalance(data.balance);
      setTransactions(data.transactions.map((tx: any) => ({
        ...tx,
        date: new Date(tx.date)
      })));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      toast({
        title: "Error",
        description: "Failed to fetch wallet data. Using cached data.",
        variant: "destructive",
      });
    }
  };

  return (
    <LedgerContext.Provider value={{
      status,
      btcBalance,
      btcPrice,
      address,
      transactions,
      connect,
      disconnect,
      sendBitcoin,
      signMessage,
      signPsbt,
      refreshBalance
    }}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (context === undefined) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
}
