import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { SolanaWalletProvider } from "@/lib/wallet-provider";
import { RealtimeProvider } from "@/hooks/use-realtime";
import { AuthProvider } from "@/hooks/use-auth";
import { Suspense, lazy } from "react";
import { Loader } from "@/components/ui/loader";
import { DevnetBanner } from "@/components/devnet-banner";

// Lazy Load Pages
const InvoiceLanding = lazy(() => import("@/pages/invoice-landing"));
const InvoiceList = lazy(() => import("@/pages/invoice-list"));
const InvoiceCreate = lazy(() => import("@/pages/invoice-create"));
const InvoiceDetail = lazy(() => import("@/pages/invoice-detail"));
const PayInvoice = lazy(() => import("@/pages/pay-invoice"));
const Customers = lazy(() => import("@/pages/customers"));
const Templates = lazy(() => import("@/pages/templates"));
const DashboardLayout = lazy(() => import("@/pages/dashboard-layout"));
const NotFound = lazy(() => import("@/pages/not-found"));
const ComingSoon = lazy(() => import("@/pages/coming-soon"));
const Stats = lazy(() => import("@/pages/stats"));
const SettingsPage = lazy(() => import("@/pages/settings"));

const CommunityNFTDrop = lazy(() => import("@/pages/community-nft"));
const DeveloperWaitlistPage = lazy(() => import("@/pages/developer-waitlist"));
const DocsPage = lazy(() => import("@/pages/docs"));
const Tokenomics = lazy(() => import("@/pages/tokenomics"));

import { useAnalytics } from "@/hooks/use-analytics";


function AnalyticsTracker() {
  useAnalytics();
  return null;
}

function Router() {
  return (
    <Suspense fallback={<Loader />}>
      <AnalyticsTracker />
      <Switch>
        <Route path="/" component={InvoiceLanding} />
        <Route path="/community-nft" component={CommunityNFTDrop} />
        <Route path="/stats" component={Stats} />
        <Route path="/pay/:invoiceId" component={PayInvoice} />
        <Route path="/developers" component={DeveloperWaitlistPage} />
        <Route path="/docs" component={DocsPage} />
        <Route path="/tokenomics" component={Tokenomics} />

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

        {/* Redirect to landing page sections */}
        <Route path="/pricing">
          {() => {
            window.location.href = "/#pricing";
            return null;
          }}
        </Route>
        <Route path="/rewards">
          {() => {
            window.location.href = "/#rewards";
            return null;
          }}
        </Route>
        <Route path="/dashboard/settings">
          {() => (
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/dashboard/blacklist" component={ComingSoon} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <SolanaWalletProvider>
          <AuthProvider>
            <ThemeProvider defaultTheme="dark">
              <TooltipProvider>
                <RealtimeProvider>
                  <DevnetBanner />
                  <Toaster />
                  <Router />
                </RealtimeProvider>
              </TooltipProvider>
            </ThemeProvider>
          </AuthProvider>
        </SolanaWalletProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
