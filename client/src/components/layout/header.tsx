import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

import { useQuery } from "@tanstack/react-query";

interface HeaderProps {
  onSidebarToggle: () => void;
}

export default function Header({ onSidebarToggle }: HeaderProps) {
  // Query to get urgent repairs (priority 1 or 2, not completed or cancelled)
  const { data: urgentRepairs = [] } = useQuery<any[]>({
    queryKey: ["/api/repairs", { priority: "1,2" }],
  });

  // Check if there are any urgent repairs
  const hasUrgentRepairs = urgentRepairs.length > 0 && 
    urgentRepairs.some((repair: any) => 
      repair.status !== 'completed' && repair.status !== 'cancelled'
    );
  
  return (
    <header className="bg-white border-b flex items-center justify-between p-4">
      <div className="flex items-center">
        <Button 
          onClick={onSidebarToggle} 
          variant="ghost" 
          size="icon" 
          className="md:hidden mr-2"
        >
          <i className="fas fa-bars text-gray-600"></i>
        </Button>
        <Link to="/" className="md:hidden text-xl font-bold">RepairTrack</Link>
      </div>
      
      <div className="ml-4 relative flex-1 max-w-xl">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className="fas fa-search text-gray-400"></i>
        </div>
        <Input 
          type="text" 
          className="pl-10"
          placeholder="Search repairs, customers, or tickets..." 
        />
      </div>
      
      <div className="flex items-center ml-4">
        <Button variant="ghost" size="icon" className="relative">
          <i className="fas fa-bell text-gray-600"></i>
          {hasUrgentRepairs && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </Button>
        <Button variant="ghost" size="icon">
          <i className="fas fa-question-circle text-gray-600"></i>
        </Button>
      </div>
    </header>
  );
}
