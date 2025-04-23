import React from "react";
import { useChatStore } from "../utils/chatStore";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, Plus, Calendar, User, Menu, X, LogIn, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser } from "app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserProfileStore } from "../utils/userProfileStore";

interface NavigationProps {
  // Any props we might need in the future
}

export const Navigation: React.FC<NavigationProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const { user, loading } = useCurrentUser();
  const { profile } = useUserProfileStore();
  
  // Navigation items - some only shown when logged in
  const navItems = [
    { label: "Home", icon: <Home className="h-5 w-5" />, path: "/", showWhenLoggedOut: true },
    { label: "Feed", icon: <Calendar className="h-5 w-5" />, path: "/feed", requireAuth: true },
    { label: "Create", icon: <Plus className="h-5 w-5" />, path: "/create", requireAuth: true },
    { 
      label: "Chats", 
      icon: <MessageSquare className="h-5 w-5" />, 
      path: "/chats", 
      requireAuth: true,
      badge: useChatStore(state => state.totalUnreadCount > 0 ? state.totalUnreadCount.toString() : undefined)
    },
    { label: "Profile", icon: <User className="h-5 w-5" />, path: "/profile", requireAuth: true },
  ];

  // Authentication buttons
  const authButtons = [
    { 
      label: "Login", 
      icon: <LogIn className="h-5 w-5" />, 
      path: "/login", 
      show: !user, 
      variant: "ghost" as const
    },
    { 
      label: "Logout", 
      icon: <LogOut className="h-5 w-5" />, 
      path: "/logout", 
      show: !!user, 
      variant: "outline" as const
    },
  ];

  // Filter nav items based on auth status
  const filteredNavItems = navItems.filter(item => {
    if (item.showWhenLoggedOut && !user) return true;
    if (item.requireAuth && user) return true;
    return false;
  });
  
  // Handle navigation
  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex h-screen fixed left-0 top-0 flex-col justify-between p-4 border-r border-border/40 bg-background/95 backdrop-blur-sm shadow-sm">
        <div className="space-y-8">
          <div className="flex items-center justify-center py-6">
            <h1 className="text-2xl font-bold text-primary">Meetu</h1>
          </div>
          <nav className="flex flex-col space-y-2 px-2">
            {filteredNavItems.map((item) => (
              <Button
                key={item.path}
                variant={location.pathname === item.path ? "default" : "ghost"}
                className={`justify-start gap-3 rounded-full h-12 px-4 text-base font-medium transition-all ${location.pathname === item.path ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/50"}`}
                onClick={() => handleNavigation(item.path)}
              >
                <span className={`${location.pathname === item.path ? "text-primary-foreground" : "text-muted-foreground"}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {item.badge}
                  </span>
                )}
              </Button>
            ))}
          </nav>
        </div>
        
        {/* Auth buttons and user profile on desktop */}
        <div className="space-y-4 pb-6 px-2">
          {user && profile && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/30 mb-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.photoURL || undefined} alt={profile.displayName || "User"} />
                <AvatarFallback>{profile.displayName?.charAt(0) || profile.email?.charAt(0) || user.uid?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.displayName || user.email?.split('@')[0] || `User-${user.uid.substring(0, 5)}`}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email || user.email || ""}</p>
              </div>
            </div>
          )}
          
          {authButtons
            .filter(button => button.show)
            .map((button) => (
              <Button
                key={button.path}
                variant={button.variant}
                className="w-full justify-start gap-3 rounded-full h-11 font-medium"
                onClick={() => handleNavigation(button.path)}
              >
                {button.icon}
                <span>{button.label}</span>
              </Button>
            ))}
        </div>
      </div>

      {/* Mobile Header */}
      <header className="md:hidden border-b border-border/40 py-4 px-6 sticky top-0 bg-background/95 backdrop-blur-sm z-40 shadow-sm">
        <div className="flex justify-between items-center">
          <Button 
            variant="ghost" 
            className="p-0 h-auto font-bold text-xl text-primary"
            onClick={() => handleNavigation("/")}
          >
            Meetu
          </Button>
          <div className="flex items-center gap-2">
            {user && (
              <Avatar 
                className="h-9 w-9 cursor-pointer" 
                onClick={() => handleNavigation("/profile")}
              >
                <AvatarImage 
                  src={profile?.photoURL || undefined} 
                  alt={profile?.displayName || "User"} 
                />
                <AvatarFallback>
                  {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || user.uid?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="pt-12 rounded-l-2xl">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-bold text-primary">Meetu</h2>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                
                {user && profile && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 mb-6">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.photoURL || undefined} alt={profile.displayName || "User"} />
                      <AvatarFallback>{profile.displayName?.charAt(0) || profile.email?.charAt(0) || user.uid?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profile.displayName || user.email?.split('@')[0] || `User-${user.uid.substring(0, 5)}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email || user.email || ""}</p>
                    </div>
                  </div>
                )}
                
                <nav className="flex flex-col space-y-1">
                  {navItems.map((item) => (
                    (item.showWhenLoggedOut || (item.requireAuth && user)) && (
                      <Button
                        key={item.path}
                        variant={location.pathname === item.path ? "default" : "ghost"}
                        className={`justify-start gap-3 rounded-full h-12 text-base font-medium ${location.pathname === item.path ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <span className={`${location.pathname === item.path ? "text-primary-foreground" : "text-muted-foreground"}`}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Button>
                    )
                  ))}
                  
                  {/* Auth buttons in mobile menu */}
                  <div className="mt-4 pt-4 border-t">
                    {authButtons
                      .filter(button => button.show)
                      .map((button) => (
                        <Button
                          key={button.path}
                          variant={button.variant}
                          className="w-full justify-start gap-3 rounded-full h-12 mb-2"
                          onClick={() => handleNavigation(button.path)}
                        >
                          {button.icon}
                          <span>{button.label}</span>
                        </Button>
                      ))}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/40 py-2 px-1 z-40 shadow-sm">
        <nav className="flex justify-around items-center">
          {filteredNavItems.slice(0, 5).map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              size="icon"
              className={`rounded-full h-12 w-12 flex flex-col items-center justify-center gap-1 ${location.pathname === item.path ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
              onClick={() => handleNavigation(item.path)}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Button>
          ))}
        </nav>
      </div>
    </>
  );
};
