import { useLedger } from "@/lib/ledger-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Loader2, PenTool, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function SignPage() {
  const { signMessage, address } = useLedger();
  const [activeTab, setActiveTab] = useState("message");
  
  // Message State
  const [message, setMessage] = useState("");
  const [messageSignature, setMessageSignature] = useState("");
  const [isSigningMessage, setIsSigningMessage] = useState(false);

  // Verify State
  const [verifyAddress, setVerifyAddress] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifySignature, setVerifySignature] = useState("");
  const [verificationResult, setVerificationResult] = useState<"valid" | "invalid" | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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

  const handleVerifySignature = async () => {
    if (!verifyAddress || !verifyMessage || !verifySignature) return;
    setIsVerifying(true);
    setVerificationResult(null);
    
    try {
      const response = await fetch('/api/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: verifyAddress,
          message: verifyMessage,
          signature: verifySignature
        })
      });
      
      const data = await response.json();
      setVerificationResult(data.valid ? "valid" : "invalid");
    } catch (e) {
      console.error(e);
      setVerificationResult("invalid");
    } finally {
      setIsVerifying(false);
    }
  };

  const resetVerification = () => {
    setVerifyAddress("");
    setVerifyMessage("");
    setVerifySignature("");
    setVerificationResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-display">Sign & Verify</h1>
        <p className="text-muted-foreground">Cryptographically sign messages or verify signatures.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="message">Sign Message</TabsTrigger>
          <TabsTrigger value="verify">Verify Signature</TabsTrigger>
        </TabsList>

        <TabsContent value="message" className="space-y-4">
          <Card className="glass-panel border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Signing Address</label>
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
                  <code className="text-sm font-mono text-zinc-300 break-all" data-testid="text-signing-address">
                    {address}
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message to sign</label>
                <Textarea 
                  placeholder="Enter a message to prove ownership..." 
                  className="bg-zinc-950/50 font-mono min-h-[120px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-testid="input-sign-message"
                />
              </div>

              {messageSignature ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Signed Successfully
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Signature</div>
                    <code className="text-xs font-mono break-all text-primary block" data-testid="text-message-signature">
                      {messageSignature}
                    </code>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setMessageSignature("")} data-testid="button-sign-another">
                    Sign Another Message
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={handleSignMessage}
                  disabled={!message}
                  data-testid="button-sign-message"
                >
                  <PenTool className="mr-2 h-4 w-4" /> Sign Message
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify" className="space-y-4">
          <Card className="glass-panel border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bitcoin Address</label>
                <Input 
                  placeholder="bc1q..." 
                  className="bg-zinc-950/50 font-mono"
                  value={verifyAddress}
                  onChange={(e) => setVerifyAddress(e.target.value)}
                  data-testid="input-verify-address"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea 
                  placeholder="The original message that was signed..." 
                  className="bg-zinc-950/50 font-mono min-h-[80px]"
                  value={verifyMessage}
                  onChange={(e) => setVerifyMessage(e.target.value)}
                  data-testid="input-verify-message"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Signature</label>
                <Textarea 
                  placeholder="The signature to verify..." 
                  className="bg-zinc-950/50 font-mono min-h-[80px]"
                  value={verifySignature}
                  onChange={(e) => setVerifySignature(e.target.value)}
                  data-testid="input-verify-signature"
                />
              </div>

              {verificationResult ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  {verificationResult === "valid" ? (
                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                      <div>
                        <div className="font-medium text-emerald-500">Valid Signature</div>
                        <div className="text-sm text-muted-foreground">This signature was created by the owner of this address.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                      <div>
                        <div className="font-medium text-red-500">Invalid Signature</div>
                        <div className="text-sm text-muted-foreground">This signature does not match the address and message.</div>
                      </div>
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={resetVerification} data-testid="button-verify-another">
                    Verify Another Signature
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={handleVerifySignature}
                  disabled={!verifyAddress || !verifyMessage || !verifySignature || isVerifying}
                  data-testid="button-verify-signature"
                >
                  {isVerifying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><ShieldCheck className="mr-2 h-4 w-4" /> Verify Signature</>
                  )}
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
              Please review and confirm the message on your device.
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
