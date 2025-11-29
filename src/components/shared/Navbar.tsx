"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Bell,
  MessageCircle,
  User,
  Menu,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

interface NavbarProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

const navItems = [
  { href: "/feed", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
];

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/feed" className="mr-6 flex items-center space-x-2">
          <span className="text-xl font-bold">NRL Society</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center justify-center space-x-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2",
                  pathname === item.href && "bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="hidden lg:inline">{item.label}</span>
              </Button>
            </Link>
          ))}
        </nav>

        {/* User Menu (Desktop) */}
        <div className="ml-auto hidden items-center space-x-2 md:flex">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={user.avatarUrl || undefined}
                      alt={user.displayName}
                    />
                    <AvatarFallback>
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.avatarUrl || undefined}
                      alt={user.displayName}
                    />
                    <AvatarFallback>
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">{user.displayName}</p>
                    <p className="text-muted-foreground text-xs">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={`/profile/${user.id}`}
                    className="flex items-center"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center space-x-2">
              <Link href="/login">
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link href="/register">
                <Button>Sign up</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild className="ml-auto md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-4 flex flex-col space-y-4">
              {user && (
                <div className="flex items-center gap-3 border-b p-2 pb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user.avatarUrl || undefined}
                      alt={user.displayName}
                    />
                    <AvatarFallback>
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-muted-foreground text-sm">
                      @{user.username}
                    </p>
                  </div>
                </div>
              )}

              <nav className="flex flex-col space-y-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={pathname === item.href ? "secondary" : "ghost"}
                      className="w-full justify-start gap-3"
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </nav>

              {user ? (
                <>
                  <div className="border-t pt-4">
                    <Link href={`/profile/${user.id}`}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                      >
                        <User className="h-5 w-5" />
                        Profile
                      </Button>
                    </Link>
                    <Link href="/settings">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                      >
                        <Settings className="h-5 w-5" />
                        Settings
                      </Button>
                    </Link>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-destructive w-full justify-start gap-3"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                    Log out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col space-y-2 border-t pt-4">
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      Log in
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="w-full">Sign up</Button>
                  </Link>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
