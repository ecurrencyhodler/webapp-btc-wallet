import { useLedger } from "@/lib/ledger-context";
import { Button } from "@/components/ui/button";
import { Loader2, Usb, ExternalLink } from "lucide-react";

export default function Connect() {
  const { connect, status } = useLedger();

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
      
      <div className="z-10 w-full max-w-md text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tighter text-white">
            Connect your <span className="text-primary">Ledger</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Connect and unlock your Ledger device to access your Bitcoin wallet securely.
          </p>
        </div>

        <div className="pt-8 flex flex-col items-center gap-4">
          <Button 
            size="lg" 
            onClick={connect} 
            disabled={status === 'connecting'}
            className="w-full max-w-xs h-14 text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_-10px_hsl(36,98%,53%,0.6)] transition-all hover:scale-105"
          >
            {status === 'connecting' ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Usb className="mr-2 h-5 w-5" />
                Connect Wallet
              </>
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={openInNewTab}
            className="text-muted-foreground hover:text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab (Required for WebHID)
          </Button>
          
          <p className="mt-2 text-xs text-muted-foreground">
            Supports Ledger Nano S, S Plus, and Nano X
          </p>
        </div>
      </div>
    </div>
  );
}
