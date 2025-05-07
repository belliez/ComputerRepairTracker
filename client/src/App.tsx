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
import CreateRepairQuote from "@/pages/create-repair-quote";
import CreateRepairInvoice from "@/pages/create-repair-invoice";
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
      <Route path="/repairs/create" component={CreateRepair} />
      <Route path="/repairs/edit/:id" component={EditRepair} />
      <Route path="/repairs/:id/items/add" component={AddRepairItem} />
      <Route path="/repairs/:id/quotes/create" component={CreateRepairQuote} />
      <Route path="/repairs/:id/quotes/:quoteId/edit" component={CreateRepairQuote} />
      <Route path="/repairs/:id/invoices/create" component={CreateRepairInvoice} />
      <Route path="/repairs/:id/invoices/:invoiceId/edit" component={CreateRepairInvoice} />
      <Route path="/repairs/view/:id" component={ViewRepair} />
      <Route path="/repairs/:id" component={ViewRepair} />
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
