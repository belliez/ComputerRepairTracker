import { NavItem } from "@/types";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: "tachometer-alt" },
  { label: "Repairs", path: "/repairs", icon: "tools" },
  { label: "Customers", path: "/customers", icon: "users" },
  { label: "Inventory", path: "/inventory", icon: "boxes" },
  { label: "Invoices", path: "/invoices", icon: "file-invoice-dollar" },
  { label: "Reports", path: "/reports", icon: "chart-bar" },
  { label: "Settings", path: "/settings", icon: "cog" },
];

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function Sidebar({ isVisible, onClose }: SidebarProps) {
  const [location] = useLocation();

  // Common classes for sidebar both mobile and desktop
  const sidebarBaseClasses = "bg-gray-800 text-white";
  
  // Mobile-specific classes
  const mobileSidebarClasses = cn(
    sidebarBaseClasses,
    "fixed inset-0 z-40 w-64 transform transition-transform duration-200 ease-in-out md:hidden",
    isVisible ? "translate-x-0" : "-translate-x-full"
  );
  
  // Desktop-specific classes
  const desktopSidebarClasses = cn(
    sidebarBaseClasses,
    "hidden md:block w-64 flex-shrink-0"
  );

  const renderSidebarContent = () => (
    <>
      <Link href="/" onClick={() => onClose()}>
        <div className="p-4 border-b border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer">
          <h1 className="text-xl font-bold">RepairTrack</h1>
          <p className="text-xs text-gray-400">Computer Repair Management</p>
        </div>
      </Link>
      
      {/* User info */}
      <div className="p-4 border-b border-gray-700 flex items-center">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-2">
          <span className="text-white font-semibold">JD</span>
        </div>
        <div>
          <p className="text-sm font-medium">John Doe</p>
          <p className="text-xs text-gray-400">Senior Technician</p>
        </div>
      </div>
      
      {/* Navigation links */}
      <nav className="p-2">
        <ul>
          {navItems.map((item) => (
            <li key={item.path} className="mb-1">
              <Link 
                href={item.path}
                className={cn(
                  "flex items-center px-4 py-2 rounded transition-colors",
                  location === item.path
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                )}
                onClick={() => onClose()}
              >
                <i className={`fas fa-${item.icon} w-5`}></i>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <aside className={mobileSidebarClasses}>
        <div className="flex justify-end p-4 md:hidden">
          <button 
            onClick={onClose}
            className="text-gray-300 hover:text-white"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        {renderSidebarContent()}
      </aside>
      
      {/* Desktop sidebar */}
      <aside className={desktopSidebarClasses}>
        {renderSidebarContent()}
      </aside>
      
      {/* Backdrop for mobile - click to close sidebar */}
      {isVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onClose}
        ></div>
      )}
    </>
  );
}
