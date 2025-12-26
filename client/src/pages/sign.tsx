import { useLedger } from "@/lib/ledger-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Loader2, PenTool, FileSignature, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function SignPage() {
  const { signMessage, signPsbt } = useLedger();
  const [activeTab, setActiveTab] = useState("message");
  
  // Message State
  const [message, setMessage] = useState("");
  const [messageSignature, setMessageSignature] = useState("");
  const [isSigningMessage, setIsSigningMessage] = useState(false);

  // PSBT State
  const [psbt, setPsbt] = useState("");
  const [signedPsbt, setSignedPsbt] = useState("");
  const [isSigningPsbt, setIsSigningPsbt] = useState(false);

  // Modal State
  const [signingModalOpen, setSigningModalOpen] = useState(false);

  const handleSignMessage = async () => {
    if (!message) return;
    setSigningModalOpen(true);
    setIsSigningMessage(true);
    try {
      const sig = await signMessage(message);
      setMessageSignature(sig);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSigningMessage(false);
      setSigningModalOpen(false);
    }
  };

  const handleSignPsbt = async () => {
    if (!psbt) return;
    setSigningModalOpen(true);
    setIsSigningPsbt(true);
    try {
      const sig = await signPsbt(psbt);
      setSignedPsbt(sig);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSigningPsbt(false);
      setSigningModalOpen(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-display">Sign & Verify</h1>
        <p className="text-muted-foreground">Cryptographically sign messages or transactions with your Ledger.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="message">Sign Message</TabsTrigger>
          <TabsTrigger value="psbt">Sign PSBT</TabsTrigger>
        </TabsList>

        <TabsContent value="message" className="space-y-4">
          <Card className="glass-panel border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Message to sign</label>
                <Textarea 
                  placeholder="Enter a message to prove ownership..." 
                  className="bg-zinc-950/50 font-mono min-h-[120px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {messageSignature ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Signed Successfully
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Signature</div>
                    <code className="text-xs font-mono break-all text-primary block">
                      {messageSignature}
                    </code>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setMessageSignature("")}>
                    Sign Another Message
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={handleSignMessage}
                  disabled={!message}
                >
                  <PenTool className="mr-2 h-4 w-4" /> Sign Message
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="psbt" className="space-y-4">
          <Card className="glass-panel border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">PSBT (Base64)</label>
                <Textarea 
                  placeholder="Paste your Partially Signed Bitcoin Transaction..." 
                  className="bg-zinc-950/50 font-mono min-h-[120px]"
                  value={psbt}
                  onChange={(e) => setPsbt(e.target.value)}
                />
              </div>

              {signedPsbt ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Signed Successfully
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Signed PSBT</div>
                    <code className="text-xs font-mono break-all text-primary block">
                      {signedPsbt}
                    </code>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setSignedPsbt("")}>
                    Sign Another PSBT
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={handleSignPsbt}
                  disabled={!psbt}
                >
                  <FileSignature className="mr-2 h-4 w-4" /> Sign PSBT
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={signingModalOpen} onOpenChange={setSigningModalOpen}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>Sign on Ledger</DialogTitle>
            <DialogDescription>
              Please review and confirm the {activeTab === 'message' ? 'message' : 'transaction'} on your device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-ping" />
              <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground text-center animate-pulse">
              Confirm action on device...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
