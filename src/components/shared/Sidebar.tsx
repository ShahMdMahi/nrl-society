"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, TrendingUp, Bookmark, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "/feed", icon: Home, label: "Home Feed" },
  { href: "/friends", icon: Users, label: "Friends" },
  { href: "/trending", icon: TrendingUp, label: "Trending" },
  { href: "/saved", icon: Bookmark, label: "Saved Posts" },
  { href: "/events", icon: Calendar, label: "Events" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-20 space-y-4">
        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  pathname === item.href && "bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* Quick Stats or Suggestions could go here */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Welcome to NRL Society</h3>
          <p className="text-xs text-muted-foreground">
            Connect with friends, share your thoughts, and discover new content.
          </p>
        </div>
      </div>
    </aside>
  );
}
