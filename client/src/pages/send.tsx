import { useLedger } from "@/lib/ledger-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowUpRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";

const formSchema = z.object({
  address: z.string().min(26, "Invalid Bitcoin address").regex(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/, "Invalid Bitcoin address format"),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
});

export default function SendPage() {
  const { btcBalance, btcPrice, sendBitcoin } = useLedger();
  const [isSigning, setIsSigning] = useState(false);
  const [_, setLocation] = useLocation();
  const [txHash, setTxHash] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
      amount: "",
    },
  });

  const amountValue = form.watch("amount");
  const usdValue = amountValue ? (Number(amountValue) * btcPrice).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00";

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSigning(true);
    try {
      const hash = await sendBitcoin(Number(values.amount), values.address);
      setTxHash(hash);
      toast({
        title: "Transaction Broadcasted",
        description: "Your Bitcoin has been sent successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsSigning(false);
    }
  };

  if (txHash) {
    return (
      <div className="max-w-xl mx-auto pt-10 text-center space-y-6 animate-in zoom-in duration-300">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold font-display">Sent Successfully!</h2>
        <p className="text-muted-foreground">
          Your transaction has been broadcasted to the network.
        </p>
        <div className="bg-zinc-900 p-4 rounded-lg break-all font-mono text-xs text-muted-foreground border border-white/10">
          {txHash}
        </div>
        <div className="flex justify-center gap-4 pt-4">
          <Button variant="outline" onClick={() => setLocation('/')}>Back to Dashboard</Button>
          <Button onClick={() => {
            setTxHash(null);
            form.reset();
            setIsSigning(false);
          }}>Send Another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-display">Send Bitcoin</h1>
        <p className="text-muted-foreground">Enter recipient details and sign with your Ledger.</p>
      </div>

      <Card className="glass-panel border-zinc-800">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Address</FormLabel>
                    <FormControl>
                      <Input placeholder="bc1q..." className="bg-zinc-950/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (BTC)</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input 
                          placeholder="0.00" 
                          className="bg-zinc-950/50 font-mono text-lg pl-4 pr-24" 
                          {...field} 
                        />
                      </FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground bg-zinc-900 px-2 py-1 rounded">
                        ≈ ${usdValue}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Available: {btcBalance} BTC</span>
                      <span 
                        className="text-primary cursor-pointer hover:underline"
                        onClick={() => {
                          // Estimate ~1500 sats for a typical transaction fee
                          const estimatedFee = 0.000015;
                          const maxAmount = Math.max(0, btcBalance - estimatedFee);
                          form.setValue("amount", maxAmount.toFixed(8));
                        }}
                      >
                        Use Max
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg" className="w-full h-12 text-base font-medium" disabled={isSigning}>
                {isSigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Review on Ledger...
                  </>
                ) : (
                  <>
                    Send Bitcoin <ArrowUpRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={isSigning} onOpenChange={setIsSigning}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>Review Transaction</DialogTitle>
            <DialogDescription>
              Please verify the transaction details on your Ledger device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-ping" />
              <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground text-center animate-pulse">
              Waiting for approval...
            </p>
            <div className="text-center space-y-1 bg-zinc-900 p-4 rounded-lg w-full">
              <div className="text-xs text-muted-foreground">Confirm Output</div>
              <div className="font-mono text-sm break-all">{form.getValues().address}</div>
              <div className="font-mono font-bold text-primary mt-2">{form.getValues().amount} BTC</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
