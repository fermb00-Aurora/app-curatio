import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const LogoutButton = () => {
  const { logout } = useAuth();

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={logout}
      title="Logout"
      className="text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  );
}; 