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

const MOCK_BTC_PRICE = 96420.50;

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LedgerStatus>('disconnected');
  const [btcBalance, setBtcBalance] = useState(0);
  const [address, setAddress] = useState("");
  const [transport, setTransport] = useState<any>(null);
  
  // Mock transactions remain mock for now as we can't easily fetch full history without an indexer API
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 'tx-1',
      type: 'received',
      amount: 0.15,
      date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      address: 'bc1q...9wlh',
      status: 'confirmed'
    },
    {
      id: 'tx-2',
      type: 'sent',
      amount: 0.02,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      address: 'bc1q...3kjs',
      status: 'confirmed'
    }
  ]);

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
      
      // Set a mock balance for demonstration since we can't query the blockchain directly without an API key
      // In a real app, we would query an explorer API with the address
      setBtcBalance(0.42069); 

      setStatus('connected');
      toast({
        title: "Ledger Connected",
        description: "Nano X connected successfully.",
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
      
      const result = await btc.signMessageNew(path, hexMessage);
      
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
    // Simulate network fetch
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <LedgerContext.Provider value={{
      status,
      btcBalance,
      btcPrice: MOCK_BTC_PRICE,
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
