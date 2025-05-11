import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { User, Organization } from "@shared/schema";
import { useAuth } from "@/components/auth/auth-provider";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Building, ChevronDown, LogOut, Search, User as UserIcon, Bug as BugIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  onSidebarToggle: () => void;
  user?: User;
  organization?: Organization | null;
}

export default function Header({ onSidebarToggle, user, organization }: HeaderProps) {
  const { organizations, switchOrganization, signOut } = useAuth();
  const { toast } = useToast();
  
  // Query to get urgent repairs (priority 1 or 2, not completed or cancelled)
  const { data: urgentRepairs = [] } = useQuery<any[]>({
    queryKey: ["/api/repairs", { priority: "1,2" }],
  });

  // Check if there are any urgent repairs
  const hasUrgentRepairs = Array.isArray(urgentRepairs) && urgentRepairs.length > 0 && 
    urgentRepairs.some((repair: any) => 
      repair.status !== 'completed' && repair.status !== 'cancelled'
    );
  
  // Get user's initials for avatar fallback
  const getInitials = () => {
    if (!user) return "?";
    if (user.displayName) {
      return user.displayName
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };
  
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
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input 
          type="text" 
          className="pl-10"
          placeholder="Search repairs, customers, or tickets..." 
        />
      </div>
      
      <div className="flex items-center ml-4 gap-2">
        {/* Organization Selector (if there are multiple orgs) */}
        {organizations.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Building className="h-4 w-4" />
                {organization?.name || "Select Organization"}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem 
                  key={org.id}
                  onClick={() => switchOrganization(org.id)}
                  className={org.id === organization?.id ? "bg-muted" : ""}
                >
                  {org.name}
                  {org.role === "owner" && (
                    <span className="ml-2 text-xs text-muted-foreground">(Owner)</span>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link to="/new-organization">Create Organization</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {hasUrgentRepairs && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </Button>
        
        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Building className="mr-2 h-4 w-4" />
              <span>Organization Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Only show dev mode option if in dev mode */}
            {localStorage.getItem('useDevelopmentAuth') === 'true' && (
              <DropdownMenuItem onClick={() => {
                localStorage.removeItem('useDevelopmentAuth');
                toast({
                  title: "Development Mode Disabled",
                  description: "Reloading application..."
                });
                // Give time for toast to appear then reload
                setTimeout(() => window.location.reload(), 1000);
              }}>
                <BugIcon className="mr-2 h-4 w-4" />
                <span>Disable Development Mode</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
