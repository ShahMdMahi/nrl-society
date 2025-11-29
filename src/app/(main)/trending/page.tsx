"use client";

import { useState, useEffect, useCallback } from "react";
import { PostCard, type PostData } from "@/components/feed/PostCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Hash, Flame, Clock } from "lucide-react";
import Link from "next/link";

interface TrendingHashtag {
  id: string;
  name: string;
  postCount: number | null;
}

export default function TrendingPage() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");

  const fetchTrending = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/trending?period=${period}&limit=20`);
      const data = (await res.json()) as {
        success: boolean;
        data?: {
          posts?: PostData[];
          hashtags?: TrendingHashtag[];
        };
      };

      if (data.success && data.data) {
        setPosts(data.data.posts || []);
        setHashtags(data.data.hashtags || []);
      }
    } catch (error) {
      console.error("Failed to fetch trending:", error);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const periodLabels = {
    day: "Today",
    week: "This Week",
    month: "This Month",
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-primary h-8 w-8" />
          <h1 className="text-2xl font-bold">Trending</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-primary h-8 w-8" />
          <h1 className="text-2xl font-bold">Trending</h1>
        </div>

        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as "day" | "week" | "month")}
        >
          <TabsList>
            <TabsTrigger value="day" className="gap-2">
              <Flame className="h-4 w-4" />
              Today
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2">
              <Clock className="h-4 w-4" />
              Week
            </TabsTrigger>
            <TabsTrigger value="month" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Month
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Trending Posts */}
        <div className="space-y-4 md:col-span-2">
          <h2 className="text-lg font-semibold">
            Top Posts {periodLabels[period]}
          </h2>
          {posts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <TrendingUp className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p className="text-muted-foreground">
                  No trending posts {periodLabels[period].toLowerCase()}. Check
                  back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post, index) => (
              <div key={post.id} className="relative">
                {index < 3 && (
                  <Badge
                    variant={index === 0 ? "default" : "secondary"}
                    className="absolute -top-2 -left-2 z-10"
                  >
                    #{index + 1}
                  </Badge>
                )}
                <PostCard post={post} onDelete={handleDeletePost} />
              </div>
            ))
          )}
        </div>

        {/* Trending Hashtags */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Hash className="h-5 w-5" />
                Trending Hashtags
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hashtags.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No trending hashtags yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {hashtags.map((hashtag, index) => (
                    <Link
                      key={hashtag.id}
                      href={`/search?q=%23${hashtag.name}&type=posts`}
                      className="hover:bg-muted flex items-center justify-between rounded-lg p-2 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">#{hashtag.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {hashtag.postCount ?? 0} posts
                          </p>
                        </div>
                      </div>
                      {index < 3 && (
                        <Flame className="h-4 w-4 text-orange-500" />
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
