import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import { useAuth } from "@/components/auth/auth-provider";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, currentOrganization } = useAuth();
  const [location] = useLocation();

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };
  
  // Refresh currency data when location changes
  useEffect(() => {
    // Refresh currency data on location change
    console.log("Location changed, refreshing currency data");
    queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
    queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies/default'] });
  }, [location]);

  // Don't show layout for auth page
  if (location === '/auth') {
    return <>{children}</>;
  }

  // Don't show layout if not authenticated
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header 
          onSidebarToggle={toggleSidebar} 
          user={user} 
          organization={currentOrganization} 
        />
        
        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
