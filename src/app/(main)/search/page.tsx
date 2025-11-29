"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  FileText,
  Hash,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { PostCard, type PostData } from "@/components/feed/PostCard";

interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean | null;
  bio: string | null;
}

interface SearchPost {
  id: string;
  content: string | null;
  createdAt: Date;
  likesCount: number | null;
  commentsCount: number | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean | null;
  };
}

interface SearchHashtag {
  id: string;
  name: string;
  postCount: number | null;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialType = searchParams.get("type") || "all";

  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [hashtags, setHashtags] = useState<SearchHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query || query.length < 2) {
      setUsers([]);
      setPosts([]);
      setHashtags([]);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: query,
        type,
        limit: "20",
      });

      const res = await fetch(`/api/v1/search?${params}`);
      const data = (await res.json()) as {
        success: boolean;
        data?: {
          users?: SearchUser[];
          posts?: SearchPost[];
          hashtags?: SearchHashtag[];
        };
      };

      if (data.success && data.data) {
        setUsers(data.data.users || []);
        setPosts(data.data.posts || []);
        setHashtags(data.data.hashtags || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    if (initialQuery) {
      search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query) {
      search();
    }
  }, [query, type, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setQuery(searchInput.trim());
      router.push(
        `/search?q=${encodeURIComponent(searchInput.trim())}&type=${type}`
      );
    }
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}&type=${newType}`);
    }
  };

  const totalResults = users.length + posts.length + hashtags.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Search className="text-primary h-8 w-8" />
        <h1 className="text-2xl font-bold">Search</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search users, posts, or hashtags..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={isLoading || !searchInput.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      <Tabs value={type} onValueChange={handleTypeChange}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            All
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <FileText className="h-4 w-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="gap-2">
            <Hash className="h-4 w-4" />
            Hashtags
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 pt-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasSearched ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h2 className="mb-2 text-xl font-semibold">Search NRL Society</h2>
            <p className="text-muted-foreground">
              Find users, posts, and trending hashtags.
            </p>
          </CardContent>
        </Card>
      ) : totalResults === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h2 className="mb-2 text-xl font-semibold">No results found</h2>
            <p className="text-muted-foreground">
              Try searching for something else.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Users Results */}
          {(type === "all" || type === "users") && users.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Users</h2>
              <div className="space-y-2">
                {users.map((user) => (
                  <Link key={user.id} href={`/profile/${user.id}`}>
                    <Card className="hover:bg-muted/50 transition-colors">
                      <CardContent className="flex items-center gap-4 py-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback>
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {user.displayName}
                            </span>
                            {user.isVerified && (
                              <BadgeCheck className="text-primary fill-primary h-4 w-4" />
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            @{user.username}
                          </p>
                          {user.bio && (
                            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                              {user.bio}
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              {type === "all" && users.length >= 5 && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => handleTypeChange("users")}
                >
                  See all users
                </Button>
              )}
            </div>
          )}

          {/* Posts Results */}
          {(type === "all" || type === "posts") && posts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Posts</h2>
              <div className="space-y-4">
                {posts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-4">
                      <Link href={`/profile/${post.author.id}`}>
                        <div className="mb-3 flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={post.author.avatarUrl || undefined}
                            />
                            <AvatarFallback>
                              {post.author.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold">
                                {post.author.displayName}
                              </span>
                              {post.author.isVerified && (
                                <BadgeCheck className="text-primary fill-primary h-4 w-4" />
                              )}
                            </div>
                            <p className="text-muted-foreground text-sm">
                              @{post.author.username}
                            </p>
                          </div>
                        </div>
                      </Link>
                      <p className="line-clamp-3">{post.content}</p>
                      <div className="text-muted-foreground mt-3 flex gap-4 text-sm">
                        <span>{post.likesCount ?? 0} likes</span>
                        <span>{post.commentsCount ?? 0} comments</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {type === "all" && posts.length >= 5 && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => handleTypeChange("posts")}
                >
                  See all posts
                </Button>
              )}
            </div>
          )}

          {/* Hashtags Results */}
          {(type === "all" || type === "hashtags") && hashtags.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Hashtags</h2>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((hashtag) => (
                  <Link
                    key={hashtag.id}
                    href={`/search?q=%23${hashtag.name}&type=posts`}
                  >
                    <Badge
                      variant="secondary"
                      className="hover:bg-secondary/80 cursor-pointer px-3 py-2 text-sm"
                    >
                      <Hash className="mr-1 h-3 w-3" />
                      {hashtag.name}
                      <span className="text-muted-foreground ml-2">
                        {hashtag.postCount ?? 0}
                      </span>
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-3">
            <Search className="text-primary h-8 w-8" />
            <h1 className="text-2xl font-bold">Search</h1>
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
