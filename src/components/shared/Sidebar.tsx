"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  Users,
  TrendingUp,
  Bookmark,
  Calendar,
  Search,
  Settings,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "/feed", icon: Home, label: "Home Feed" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/friends", icon: Users, label: "Friends" },
  { href: "/trending", icon: TrendingUp, label: "Trending" },
  { href: "/saved", icon: Bookmark, label: "Saved Posts" },
  { href: "/events", icon: Calendar, label: "Events" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface Suggestion {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean | null;
  reason: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/v1/users/suggestions?limit=3");
        const data = (await res.json()) as {
          success: boolean;
          data?: Suggestion[];
        };

        if (data.success && data.data) {
          setSuggestions(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 lg:block">
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

        {/* People You May Know */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4" />
              People You May Know
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                ))}
              </>
            ) : suggestions.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No suggestions available.
              </p>
            ) : (
              suggestions.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className="hover:bg-muted/50 flex items-center gap-2 rounded-lg p-1 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.displayName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user.reason}
                    </p>
                  </div>
                </Link>
              ))
            )}
            {suggestions.length > 0 && (
              <Link href="/search?type=users">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  See More
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Welcome Card */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="mb-2 text-sm font-semibold">Welcome to NRL Society</h3>
          <p className="text-muted-foreground text-xs">
            Connect with friends, share your thoughts, and discover new content.
          </p>
        </div>
      </div>
    </aside>
  );
}
