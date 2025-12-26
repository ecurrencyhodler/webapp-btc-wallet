import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';

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
const MOCK_ADDRESS = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LedgerStatus>('disconnected');
  const [btcBalance, setBtcBalance] = useState(0.42069);
  
  // Mock transactions
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
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStatus('connected');
      toast({
        title: "Ledger Connected",
        description: "Nano X connected successfully.",
        variant: "default",
      });
    } catch (e) {
      setStatus('error');
      toast({
        title: "Connection Failed",
        description: "Could not connect to device.",
        variant: "destructive",
      });
    }
  };

  const disconnect = () => {
    setStatus('disconnected');
    toast({
      title: "Ledger Disconnected",
      description: "Device safely disconnected.",
    });
  };

  const sendBitcoin = async (amount: number, to: string) => {
    if (status !== 'connected') throw new Error("Device not connected");
    if (amount > btcBalance) throw new Error("Insufficient funds");
    
    // Simulate signing on device
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
    
    return "tx_hash_mock_123456789";
  };

  const signMessage = async (message: string) => {
    if (status !== 'connected') throw new Error("Device not connected");
    // Simulate signing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    return "HC/7...signed_message_mock_signature";
  };

  const signPsbt = async (psbtBase64: string) => {
    if (status !== 'connected') throw new Error("Device not connected");
    // Simulate signing delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    return psbtBase64 + "_signed";
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
      address: MOCK_ADDRESS,
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
