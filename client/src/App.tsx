import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { LedgerProvider, useLedger } from "@/lib/ledger-context";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Connect from "@/pages/connect";
import SendPage from "@/pages/send";
import ReceivePage from "@/pages/receive";
import SignPage from "@/pages/sign";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { status } = useLedger();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (status !== 'connected' && status !== 'connecting') {
      setLocation('/connect');
    }
  }, [status, setLocation]);

  if (status !== 'connected') return null; // Or a loading spinner
  
  return <Component {...rest} />;
}

function Router() {
  const { status } = useLedger();
  const [location, setLocation] = useLocation();

  // Simple redirect logic
  useEffect(() => {
    if (status !== 'connected' && location !== '/connect') {
      setLocation('/connect');
    } else if (status === 'connected' && location === '/connect') {
      setLocation('/');
    }
  }, [status, location, setLocation]);

  return (
    <Layout>
      <Switch>
        <Route path="/connect" component={Connect} />
        <Route path="/" component={Dashboard} />
        <Route path="/send" component={SendPage} />
        <Route path="/receive" component={ReceivePage} />
        <Route path="/sign" component={SignPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LedgerProvider>
        <Router />
        <Toaster />
      </LedgerProvider>
    </QueryClientProvider>
  );
}

export default App;
