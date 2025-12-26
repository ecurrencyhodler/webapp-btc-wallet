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
  addresses: string[];
  transactions: Transaction[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendBitcoin: (amount: number, to: string) => Promise<string>;
  signMessage: (message: string, addressIndex?: number) => Promise<string>;
  refreshBalance: () => Promise<void>;
  verifyAddressOnDevice: () => Promise<void>;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LedgerStatus>('disconnected');
  const [btcBalance, setBtcBalance] = useState(0);
  const [btcPrice, setBtcPrice] = useState(96420.50);
  const [address, setAddress] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [transport, setTransport] = useState<any>(null);
  const [appClient, setAppClient] = useState<AppClient | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [masterFingerprint, setMasterFingerprint] = useState<string>("");
  const [xpub, setXpub] = useState<string>("");
  const [keepAliveInterval, setKeepAliveInterval] = useState<NodeJS.Timeout | null>(null);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

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
      
      // Derive first 5 addresses
      const derivedAddresses: string[] = [];
      for (let i = 0; i < 5; i++) {
        const addr = await app.getWalletAddress(
          policy,
          null,
          0,
          i,
          false
        );
        derivedAddresses.push(addr);
      }
      
      setAddresses(derivedAddresses);
      setAddress(derivedAddresses[0]);
      setStatus('connected');
      
      // Start keep-alive ping every 15 seconds to prevent device sleep
      const interval = setInterval(async () => {
        try {
          // Get master fingerprint as a lightweight ping
          await app.getMasterFingerprint();
        } catch (err) {
          console.log("Keep-alive ping failed, device may have disconnected");
        }
      }, 15000);
      setKeepAliveInterval(interval);
      
      // Request wake lock to prevent system sleep
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (err) {
          console.log("Wake lock not available");
        }
      }
      
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
    // Stop keep-alive ping
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      setKeepAliveInterval(null);
    }
    
    // Release wake lock
    if (wakeLock) {
      wakeLock.release();
      setWakeLock(null);
    }
    
    if (transport) {
      transport.close();
      setTransport(null);
    }
    setAppClient(null);
    setStatus('disconnected');
    setAddress("");
    setAddresses([]);
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

  const signMessage = async (message: string, addressIndex: number = 0) => {
    if (!appClient || status !== 'connected') throw new Error("Device not connected");
    
    toast({
      title: "Confirm on Device",
      description: "Please review and sign the message on your Ledger.",
    });

    try {
      const result = await appClient.signMessage(
        Buffer.from(message),
        `m/84'/0'/0'/0/${addressIndex}`
      );
      
      return result;
    } catch (e: any) {
      console.error("Signing failed", e);
      throw new Error(e.message || "Signing failed");
    }
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

  const verifyAddressOnDevice = async () => {
    if (!appClient || status !== 'connected') throw new Error("Device not connected");
    
    toast({
      title: "Check Your Ledger",
      description: "Please verify the address displayed on your device matches.",
    });

    try {
      const policy = new DefaultWalletPolicy(
        "wpkh(@0/**)",
        `[${masterFingerprint}/84'/0'/0']${xpub}`
      );
      
      await appClient.getWalletAddress(
        policy,
        null,
        0,
        0,
        true
      );
      
      toast({
        title: "Address Verified",
        description: "The address on your device matches.",
        variant: "default",
      });
    } catch (e: any) {
      console.error("Verification failed", e);
      toast({
        title: "Verification Failed",
        description: e.message || "Could not verify address on device.",
        variant: "destructive",
      });
      throw e;
    }
  };

  return (
    <LedgerContext.Provider value={{
      status,
      btcBalance,
      btcPrice,
      address,
      addresses,
      transactions,
      connect,
      disconnect,
      sendBitcoin,
      signMessage,
      refreshBalance,
      verifyAddressOnDevice
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
