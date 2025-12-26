import { useLedger } from "@/lib/ledger-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Shield } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function ReceivePage() {
  const { address, verifyAddressOnDevice } = useLedger();
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Address Copied",
      description: "Bitcoin address copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await verifyAddressOnDevice();
    } catch (e) {
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold font-display">Receive Bitcoin</h1>
        <p className="text-muted-foreground">Scan the QR code or copy the address below.</p>
      </div>

      <Card className="glass-panel border-zinc-800 overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center space-y-8">
          <div className="p-4 bg-white rounded-xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]">
            <QRCodeSVG 
              value={address} 
              size={240}
              level={"H"}
              includeMargin={false}
            />
          </div>

          <div className="w-full space-y-3">
            <div className="text-xs text-muted-foreground text-center uppercase tracking-wider font-semibold">
              Your SegWit Address
            </div>
            <div 
              className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={copyToClipboard}
            >
              <code className="text-sm font-mono text-zinc-300 break-all group-hover:text-white transition-colors">
                {address}
              </code>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          <Button 
            onClick={handleVerify}
            disabled={isVerifying}
            variant="outline"
            className="w-full"
            data-testid="button-verify-address"
          >
            <Shield className="w-4 h-4 mr-2" />
            {isVerifying ? "Verifying..." : "Verify on Device"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
