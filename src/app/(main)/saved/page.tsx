"use client";

import { useState, useEffect, useCallback } from "react";
import { PostCard, type PostData } from "@/components/feed/PostCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SavedPostsPage() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const fetchSavedPosts = useCallback(
    async (loadMore = false) => {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (loadMore && cursor) {
          params.set("cursor", cursor);
        }

        const res = await fetch(`/api/v1/saved?${params}`);
        const data = (await res.json()) as {
          success: boolean;
          data?: PostData[];
          meta?: { cursor?: string; hasMore?: boolean };
        };

        if (data.success && data.data) {
          if (loadMore) {
            setPosts((prev) => [...prev, ...data.data!]);
          } else {
            setPosts(data.data);
          }
          setCursor(data.meta?.cursor);
          setHasMore(data.meta?.hasMore ?? false);
        }
      } catch (error) {
        console.error("Failed to fetch saved posts:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [cursor]
  );

  useEffect(() => {
    fetchSavedPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleUnsave = async (postId: string) => {
    try {
      const res = await fetch(`/api/v1/saved?postId=${postId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (error) {
      console.error("Failed to unsave post:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Bookmark className="text-primary h-8 w-8" />
          <h1 className="text-2xl font-bold">Saved Posts</h1>
        </div>

        <div className="space-y-4">
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bookmark className="text-primary h-8 w-8" />
          <h1 className="text-2xl font-bold">Saved Posts</h1>
        </div>
        {posts.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {posts.length} saved
          </span>
        )}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bookmark className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h2 className="mb-2 text-xl font-semibold">No saved posts yet</h2>
            <p className="text-muted-foreground mb-6">
              Save posts you want to come back to by clicking the bookmark icon.
            </p>
            <Link href="/feed">
              <Button>Browse Feed</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="group relative">
                <PostCard post={post} onDelete={handleDeletePost} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleUnsave(post.id)}
                >
                  <Bookmark className="mr-1 h-4 w-4 fill-current" />
                  Unsave
                </Button>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchSavedPosts(true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
