import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Repairs from "@/pages/repairs";
import Customers from "@/pages/customers";
import Inventory from "@/pages/inventory";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import MainLayout from "@/components/layout/main-layout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/repairs" component={Repairs} />
      <Route path="/customers" component={Customers} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <MainLayout>
        <Router />
      </MainLayout>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
