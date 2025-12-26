import { useLedger } from "@/lib/ledger-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Dashboard() {
  const { btcBalance, btcPrice, transactions } = useLedger();
  const usdBalance = btcBalance * btcPrice;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold font-display tracking-tight text-white">Dashboard</h1>
      </header>

      {/* Balance Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-panel overflow-hidden relative border-zinc-800">
          <div className="absolute top-0 right-0 p-32 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
          
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Balance</span>
                <div className="flex items-baseline gap-2 mt-2 select-none">
                  <h2 className="text-5xl md:text-6xl font-bold font-display tracking-tight text-white">
                    {btcBalance.toFixed(8)}
                  </h2>
                  <span className="text-xl md:text-2xl font-medium text-muted-foreground">BTC</span>
                </div>
                
                <div className="mt-1 text-2xl font-medium text-zinc-400">
                  ${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>

              </div>

              <div className="flex gap-4">
                <Link href="/send">
                  <Button size="lg" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-medium h-12 text-base shadow-[0_0_20px_-5px_hsl(36,98%,53%,0.5)]">
                    <ArrowUpRight className="mr-2 h-5 w-5" /> Send
                  </Button>
                </Link>
                <Link href="/receive">
                  <Button size="lg" variant="secondary" className="flex-1 h-12 text-base">
                    <ArrowDownLeft className="mr-2 h-5 w-5" /> Receive
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold font-display">Recent Activity</h3>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="py-6" data-testid="empty-activity">
              <p className="text-muted-foreground text-sm">
                No transactions yet. Your activity will appear here once you send or receive bitcoin.
              </p>
            </div>
          ) : transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <a 
                href={`https://mempool.space/tx/${tx.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-900 transition-colors cursor-pointer"
                data-testid={`link-tx-${tx.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'received' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {tx.type === 'received' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {tx.type === 'received' ? 'Received Bitcoin' : 'Sent Bitcoin'}
                      {tx.status === 'pending' && (
                        <span className="text-[10px] uppercase bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-bold tracking-wide">Pending</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{tx.date.toLocaleDateString()} • {tx.date.toLocaleTimeString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-medium ${tx.type === 'received' ? 'text-emerald-400' : 'text-white'}`}>
                    {tx.type === 'received' ? '+' : '-'}{tx.amount} BTC
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${(tx.amount * btcPrice).toLocaleString()}
                  </div>
                </div>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
