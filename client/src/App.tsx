import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Repairs from "@/pages/repairs";
import CreateRepair from "@/pages/create-repair";
import EditRepair from "@/pages/edit-repair";
import ViewRepair from "@/pages/view-repair";
import AddRepairItem from "@/pages/add-repair-item";
import EditRepairItem from "@/pages/edit-repair-item";
import CreateRepairQuote from "@/pages/create-repair-quote";
import CreateRepairInvoice from "@/pages/create-repair-invoice";
import Customers from "@/pages/customers";
import Inventory from "@/pages/inventory";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import BasicAuthPage from "@/pages/basic-auth";
import AuthDebugPage from "@/pages/auth-debug";
import SubscribePage from "@/pages/subscribe";
import SubscriptionSuccessPage from "@/pages/subscription-success";
import MainLayout from "@/components/layout/main-layout";
import { AuthProvider } from "@/components/auth/auth-provider";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/basic-auth" component={BasicAuthPage} />
      <Route path="/auth-debug" component={AuthDebugPage} />
      
      {/* Subscription Routes */}
      <ProtectedRoute path="/subscribe" component={SubscribePage} />
      <ProtectedRoute path="/subscription-success" component={SubscriptionSuccessPage} />
      
      {/* Protected Routes */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/repairs" component={Repairs} />
      <ProtectedRoute path="/repairs/create" component={CreateRepair} />
      <ProtectedRoute path="/repairs/edit/:id" component={EditRepair} />
      <ProtectedRoute path="/repairs/:id/items/add" component={AddRepairItem} />
      <ProtectedRoute path="/repairs/:repairId/items/:itemId/edit" component={EditRepairItem} />
      <ProtectedRoute path="/repairs/:id/quotes/create" component={CreateRepairQuote} />
      <ProtectedRoute path="/repairs/:id/quotes/:quoteId/edit" component={CreateRepairQuote} />
      <ProtectedRoute path="/repairs/:id/invoices/create" component={CreateRepairInvoice} />
      <ProtectedRoute path="/repairs/:id/invoices/:invoiceId/edit" component={CreateRepairInvoice} />
      <ProtectedRoute path="/repairs/view/:id" component={ViewRepair} />
      <ProtectedRoute path="/repairs/:id" component={ViewRepair} />
      <ProtectedRoute path="/customers" component={Customers} />
      <ProtectedRoute path="/inventory" component={Inventory} />
      <ProtectedRoute path="/invoices" component={Invoices} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/settings" component={Settings} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingProvider>
          <TooltipProvider>
            <MainLayout>
              <Router />
            </MainLayout>
            <Toaster />
          </TooltipProvider>
        </OnboardingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return <AppWithProviders />;
}

export default App;
