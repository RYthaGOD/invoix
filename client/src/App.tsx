import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SolanaWalletProvider } from "@/lib/wallet-provider";
import { RealtimeProvider } from "@/hooks/use-realtime";
import { AuthProvider } from "@/hooks/use-auth";
import InvoiceLanding from "@/pages/invoice-landing";
import InvoiceList from "@/pages/invoice-list";
import InvoiceCreate from "@/pages/invoice-create";
import InvoiceDetail from "@/pages/invoice-detail";
import PayInvoice from "@/pages/pay-invoice";
import Customers from "@/pages/customers";
import Templates from "@/pages/templates";
import DashboardLayout from "@/pages/dashboard-layout";
import NotFound from "@/pages/not-found";
import ComingSoon from "@/pages/coming-soon";

import Stats from "@/pages/stats";

function Router() {
  return (
    <Switch>
      <Route path="/" component={InvoiceLanding} />
      <Route path="/stats" component={Stats} />
      <Route path="/pay/:invoiceId" component={PayInvoice} />

      {/* Dashboard Routes with Layout */}
      <Route path="/invoices">
        {() => (
          <DashboardLayout>
            <InvoiceList />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/invoices/create">
        {() => (
          <DashboardLayout>
            <InvoiceCreate />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/invoices/:id">
        {(params: { id: string }) => (
          <DashboardLayout>
            <InvoiceDetail />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/customers">
        {() => (
          <DashboardLayout>
            <Customers />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/templates">
        {() => (
          <DashboardLayout>
            <Templates />
          </DashboardLayout>
        )}
      </Route>

      {/* Placeholders for Future Features */}
      <Route path="/pricing" component={ComingSoon} />
      <Route path="/rewards" component={ComingSoon} />
      <Route path="/dashboard/settings" component={ComingSoon} />
      <Route path="/dashboard/blacklist" component={ComingSoon} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <AuthProvider>
          <ThemeProvider defaultTheme="dark">
            <TooltipProvider>
              <RealtimeProvider>
                <Toaster />
                <Router />
              </RealtimeProvider>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </SolanaWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
