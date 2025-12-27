import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import { AppClient, DefaultWalletPolicy, WalletPolicy } from "ledger-bitcoin";
import { listen } from "@ledgerhq/logs";
import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';

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
  receiveAddress: string;
  receiveAddressIndex: number;
  addresses: string[];
  transactions: Transaction[];
  deviceName: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendBitcoin: (amount: number, to: string, feeRate: number) => Promise<string>;
  signMessage: (message: string, addressIndex?: number) => Promise<string>;
  refreshBalance: () => Promise<void>;
  verifyAddressOnDevice: (addressIndex?: number) => Promise<void>;
  generateMoreAddresses: () => Promise<void>;
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
  const [deviceName, setDeviceName] = useState<string>("Ledger");
  const [usedAddresses, setUsedAddresses] = useState<Set<string>>(new Set());
  const [receiveAddress, setReceiveAddress] = useState<string>("");
  const [receiveAddressIndex, setReceiveAddressIndex] = useState<number>(0);

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
    if (addresses.length > 0) {
      refreshBalance();
    }
  }, [addresses]);

  const connect = async () => {
    try {
      setStatus('connecting');
      const newTransport = await TransportWebHID.create();
      setTransport(newTransport);
      
      // Detect device name from HID device info
      const hidDevice = (newTransport as any).device;
      if (hidDevice && hidDevice.productName) {
        setDeviceName(hidDevice.productName);
      } else {
        setDeviceName("Ledger");
      }
      
      const app = new AppClient(newTransport);
      setAppClient(app);
      
      const fpr = await app.getMasterFingerprint();
      // getMasterFingerprint returns a Buffer, convert to hex string
      let fingerprint: string;
      if (typeof fpr === 'string') {
        fingerprint = fpr;
      } else if (fpr && typeof (fpr as any).toString === 'function') {
        fingerprint = (fpr as any).toString('hex');
      } else {
        fingerprint = Array.from(fpr as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
      }
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
      setReceiveAddress(derivedAddresses[0]);
      setReceiveAddressIndex(0);
      setStatus('connected');
      
      // Start keep-alive ping every 10 seconds to prevent device sleep
      const interval = setInterval(async () => {
        try {
          // Get master fingerprint as a lightweight ping to keep Bitcoin app active
          await app.getMasterFingerprint();
          console.log("Keep-alive ping successful");
        } catch (err: any) {
          console.log("Keep-alive ping failed:", err?.message);
          // If the device disconnects, clean up
          if (err?.message?.includes("DISCONNECTED") || err?.name === "DisconnectedDeviceDuringOperation") {
            disconnect();
          }
        }
      }, 10000);
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
    setDeviceName("Ledger");
    setUsedAddresses(new Set());
    setReceiveAddress("");
    setReceiveAddressIndex(0);
    toast({
      title: "Ledger Disconnected",
      description: "Device safely disconnected.",
    });
  };

  const sendBitcoin = async (amount: number, to: string, feeRate: number = 10) => {
    if (!appClient || !transport || status !== 'connected') throw new Error("Device not connected");
    if (amount > btcBalance) throw new Error("Insufficient funds");
    
    const amountSats = Math.round(amount * 100000000);
    
    // Fetch UTXOs
    toast({
      title: "Preparing Transaction",
      description: "Fetching available funds...",
    });
    
    const utxoResponse = await fetch('/api/utxos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses })
    });
    
    if (!utxoResponse.ok) {
      throw new Error("Failed to fetch UTXOs");
    }
    
    const { utxos } = await utxoResponse.json();
    
    if (!utxos || utxos.length === 0) {
      throw new Error("No available funds found");
    }
    
    // Sort UTXOs by value (largest first) and select enough for amount + fee
    utxos.sort((a: any, b: any) => b.value - a.value);
    
    const selectedUtxos: any[] = [];
    let totalInput = 0;
    
    // Select UTXOs greedily, recalculating fee as we add inputs
    for (const utxo of utxos) {
      selectedUtxos.push(utxo);
      totalInput += utxo.value;
      
      // Calculate fee based on current selection (68 vbytes per input, ~31 per output)
      const inputSize = selectedUtxos.length * 68;
      const outputSize = 31 + 31; // recipient + possible change
      const overheadSize = 10; // tx overhead
      const currentTxSize = overheadSize + inputSize + outputSize;
      const currentFee = feeRate * currentTxSize;
      
      if (totalInput >= amountSats + currentFee) break;
    }
    
    // Final fee calculation
    const finalTxSize = 10 + (selectedUtxos.length * 68) + 31 + 31;
    const estimatedFee = feeRate * finalTxSize;
    
    if (totalInput < amountSats + estimatedFee) {
      const maxSendable = totalInput - estimatedFee;
      throw new Error(`Insufficient funds. Max sendable: ${(maxSendable / 100000000).toFixed(8)} BTC`);
    }
    
    // Calculate actual fee and change
    const hasChange = totalInput > amountSats + estimatedFee + 546; // 546 is dust threshold
    const actualTxSize = 10 + (selectedUtxos.length * 68) + 31 + (hasChange ? 31 : 0);
    const actualFee = feeRate * actualTxSize;
    const change = totalInput - amountSats - actualFee;
    
    // Create PSBT
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    
    // Fetch raw transactions for inputs and add to PSBT
    for (const utxo of selectedUtxos) {
      const txHexResponse = await fetch(`/api/tx/${utxo.txid}/hex`);
      const { hex } = await txHexResponse.json();
      
      // Parse the previous transaction to get the output script
      const prevTx = bitcoin.Transaction.fromHex(hex);
      const prevOutput = prevTx.outs[utxo.vout];
      
      // For SegWit inputs (bc1 addresses), use witnessUtxo only
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: prevOutput.script,
          value: BigInt(prevOutput.value)
        }
      });
    }
    
    // Add recipient output
    psbt.addOutput({
      address: to,
      value: BigInt(amountSats)
    });
    
    // Add change output if needed
    if (change > 546) { // Dust threshold
      const changeAddress = addresses[0]; // Use first address for change
      psbt.addOutput({
        address: changeAddress,
        value: BigInt(Math.floor(change))
      });
    }
    
    // Convert to Buffer for Ledger (not base64)
    const psbtBuffer = psbt.toBuffer();
    
    toast({
      title: "Confirm on Device",
      description: "Please review and approve the transaction on your Ledger.",
    });
    
    try {
      // Create wallet policy for signing
      const policy = new DefaultWalletPolicy(
        "wpkh(@0/**)",
        `[${masterFingerprint}/84'/0'/0']${xpub}`
      );
      
      // Sign with Ledger - pass buffer and input indexes
      const signResult = await appClient.signPsbt(
        psbtBuffer,
        policy,
        null
      );
      
      // Parse signed PSBT and finalize
      // signResult is [signedPsbtBuffer, signatures]
      const signedPsbtBuffer = signResult[0] as Buffer;
      const signedPsbt = bitcoin.Psbt.fromBuffer(signedPsbtBuffer);
      signedPsbt.finalizeAllInputs();
      
      // Extract and broadcast
      const txHex = signedPsbt.extractTransaction().toHex();
      
      toast({
        title: "Broadcasting",
        description: "Sending transaction to network...",
      });
      
      const broadcastResponse = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHex })
      });
      
      if (!broadcastResponse.ok) {
        const error = await broadcastResponse.json();
        throw new Error(error.error || "Broadcast failed");
      }
      
      const { txid } = await broadcastResponse.json();
      
      // Update local state
      setBtcBalance(prev => prev - amount - (actualFee / 100000000));
      setTransactions(prev => [{
        id: txid,
        type: 'sent',
        amount,
        date: new Date(),
        address: to,
        status: 'pending'
      }, ...prev]);
      
      return txid;
    } catch (e: any) {
      console.error("Transaction failed:", e);
      if (e.message?.includes("denied") || e.message?.includes("rejected")) {
        throw new Error("Transaction rejected on device");
      }
      throw new Error(e.message || "Transaction signing failed");
    }
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
    if (addresses.length === 0) return;
    
    try {
      // Fetch balances for all derived addresses
      const allData = await Promise.all(
        addresses.map(async (addr, index) => {
          const response = await fetch(`/api/address/${addr}`);
          const data = await response.json();
          return { ...data, addr, index };
        })
      );
      
      // Aggregate total balance across all addresses
      const totalBalance = allData.reduce((sum, data) => sum + (data.balance || 0), 0);
      setBtcBalance(totalBalance);
      
      // Track which addresses have received funds (mark as used)
      const used = new Set<string>();
      allData.forEach((data) => {
        if (data.transactions && data.transactions.length > 0) {
          used.add(data.addr);
        }
      });
      setUsedAddresses(used);
      
      // Find the first unused address for receiving
      let unusedIndex = addresses.findIndex(addr => !used.has(addr));
      
      // If all addresses are used, we need to generate more
      if (unusedIndex === -1) {
        // For now, use the last address but flag that more are needed
        unusedIndex = addresses.length - 1;
        // Auto-generate more addresses if all are used
        if (appClient && masterFingerprint && xpub) {
          generateMoreAddressesInternal();
        }
      }
      
      setReceiveAddress(addresses[unusedIndex]);
      setReceiveAddressIndex(unusedIndex);
      
      // Combine and sort all transactions by date
      const allTransactions = allData
        .flatMap((data) => data.transactions || [])
        .map((tx: any) => ({
          ...tx,
          date: new Date(tx.date)
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 20); // Keep last 20 transactions
      
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      toast({
        title: "Error",
        description: "Failed to fetch wallet data. Using cached data.",
        variant: "destructive",
      });
    }
  };
  
  const generateMoreAddressesInternal = async () => {
    if (!appClient) return;
    
    try {
      const policy = new DefaultWalletPolicy(
        "wpkh(@0/**)",
        `[${masterFingerprint}/84'/0'/0']${xpub}`
      );
      
      const startIndex = addresses.length;
      const newAddresses: string[] = [];
      
      for (let i = startIndex; i < startIndex + 5; i++) {
        const addr = await appClient.getWalletAddress(
          policy,
          null,
          0,
          i,
          false
        );
        newAddresses.push(addr);
      }
      
      setAddresses(prev => [...prev, ...newAddresses]);
      
      // Set the first new address as receive address if all previous were used
      if (newAddresses.length > 0 && !receiveAddress) {
        setReceiveAddress(newAddresses[0]);
        setReceiveAddressIndex(startIndex);
      }
    } catch (e: any) {
      console.error("Failed to auto-generate addresses", e);
    }
  };

  const verifyAddressOnDevice = async (addressIndex: number = 0) => {
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
        addressIndex,
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

  const generateMoreAddresses = async () => {
    if (!appClient || status !== 'connected') throw new Error("Device not connected");
    
    try {
      const policy = new DefaultWalletPolicy(
        "wpkh(@0/**)",
        `[${masterFingerprint}/84'/0'/0']${xpub}`
      );
      
      const startIndex = addresses.length;
      const newAddresses: string[] = [];
      
      for (let i = startIndex; i < startIndex + 5; i++) {
        const addr = await appClient.getWalletAddress(
          policy,
          null,
          0,
          i,
          false
        );
        newAddresses.push(addr);
      }
      
      setAddresses(prev => [...prev, ...newAddresses]);
      
      toast({
        title: "Addresses Generated",
        description: `Generated 5 more addresses (${startIndex + 1}-${startIndex + 5}).`,
      });
    } catch (e: any) {
      console.error("Failed to generate addresses", e);
      toast({
        title: "Generation Failed",
        description: e.message || "Could not generate more addresses.",
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
      receiveAddress,
      receiveAddressIndex,
      addresses,
      transactions,
      deviceName,
      connect,
      disconnect,
      sendBitcoin,
      signMessage,
      refreshBalance,
      verifyAddressOnDevice,
      generateMoreAddresses
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
