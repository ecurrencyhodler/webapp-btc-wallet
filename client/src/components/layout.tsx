import { Link, useLocation } from "wouter";
import { useLedger } from "@/lib/ledger-context";
import { cn } from "@/lib/utils";
import { 
  Wallet, 
  Send, 
  ArrowDownLeft, 
  PenTool, 
  LogOut, 
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { status, disconnect } = useLedger();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If not connected and not on connect page, this would usually redirect, 
  // but we'll handle that in the pages or App.tsx routing logic.

  const navItems = [
    { href: "/", label: "Dashboard", icon: Wallet },
    { href: "/send", label: "Send", icon: Send },
    { href: "/receive", label: "Receive", icon: ArrowDownLeft },
    { href: "/sign", label: "Sign & Verify", icon: PenTool },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg tracking-tight">LEDGER<span className="text-primary">BTC</span></span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur-sm p-4 animate-in slide-in-from-top-5">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a 
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    location === item.href 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "hover:bg-accent text-muted-foreground hover:text-foreground",
                    status !== 'connected' && "pointer-events-none opacity-50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </a>
              </Link>
            ))}
            {status === 'connected' && (
              <button 
                onClick={() => { disconnect(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors mt-4"
              >
                <LogOut className="w-5 h-5" />
                Disconnect
              </button>
            )}
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border h-screen sticky top-0 p-6 bg-card/30">
          <div className="flex items-center gap-2 mb-10">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <span className="font-display font-bold text-xl tracking-tight">LEDGER<span className="text-primary">BTC</span></span>
          </div>

          <nav className="flex flex-col gap-2 flex-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group",
                  location === item.href 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_hsl(36,98%,53%,0.3)]" 
                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground",
                  status !== 'connected' && "pointer-events-none opacity-50"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform group-hover:scale-110",
                    location === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>

          {status === 'connected' && (
            <div className="mt-auto pt-6 border-t border-border">
              <div className="flex items-center gap-3 px-4 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_hsl(142,76%,36%)] animate-pulse" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Nano X Connected</span>
              </div>
              <button 
                onClick={disconnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Device
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
