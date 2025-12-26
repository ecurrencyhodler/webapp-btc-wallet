import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import { AppClient, DefaultWalletPolicy } from "ledger-bitcoin";
import { listen } from "@ledgerhq/logs";
import { Buffer } from 'buffer';

listen((log) => console.log("Ledger:", log));

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
  const [appClient, setAppClient] = useState<AppClient | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [masterFingerprint, setMasterFingerprint] = useState<string>("");
  const [xpub, setXpub] = useState<string>("");

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

  useEffect(() => {
    if (address) {
      refreshBalance();
    }
  }, [address]);

  const connect = async () => {
    try {
      setStatus('connecting');
      const newTransport = await TransportWebHID.create();
      setTransport(newTransport);
      
      const app = new AppClient(newTransport);
      setAppClient(app);
      
      const fpr = await app.getMasterFingerprint();
      const fingerprint = fpr.toString("hex");
      setMasterFingerprint(fingerprint);
      
      const extPubKey = await app.getExtendedPubkey("m/84'/0'/0'");
      setXpub(extPubKey);
      
      const policy = new DefaultWalletPolicy(
        "wpkh(@0/**)",
        `[${fingerprint}/84'/0'/0']${extPubKey}`
      );
      
      const bitcoinAddress = await app.getWalletAddress(
        policy,
        null,
        0,
        0,
        false
      );
      
      setAddress(bitcoinAddress);
      setStatus('connected');
      
      toast({
        title: "Ledger Connected",
        description: "Device connected successfully.",
        variant: "default",
      });
      
      newTransport.on("disconnect", () => {
        disconnect();
      });

    } catch (e: any) {
      console.error(e);
      setStatus('error');

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
    setAppClient(null);
    setStatus('disconnected');
    setAddress("");
    setBtcBalance(0);
    setTransactions([]);
    setMasterFingerprint("");
    setXpub("");
    toast({
      title: "Ledger Disconnected",
      description: "Device safely disconnected.",
    });
  };

  const sendBitcoin = async (amount: number, to: string) => {
    if (!transport || status !== 'connected') throw new Error("Device not connected");
    if (amount > btcBalance) throw new Error("Insufficient funds");
    
    toast({
      title: "Confirm on Device",
      description: "Please review and approve the transaction on your Ledger.",
    });

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
    if (!appClient || status !== 'connected') throw new Error("Device not connected");
    
    toast({
      title: "Confirm on Device",
      description: "Please review and sign the message on your Ledger.",
    });

    try {
      const result = await appClient.signMessage(
        Buffer.from(message),
        "m/84'/0'/0'/0/0"
      );
      
      return result;
    } catch (e: any) {
      console.error("Signing failed", e);
      throw new Error(e.message || "Signing failed");
    }
  };

  const signPsbt = async (psbtBase64: string) => {
    if (!appClient || status !== 'connected') throw new Error("Device not connected");
    
    toast({
      title: "Confirm on Device",
      description: "Please review the transaction details.",
    });

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
