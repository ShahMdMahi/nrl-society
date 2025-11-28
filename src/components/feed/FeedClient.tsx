"use client";

import { useState, useEffect, useCallback } from "react";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard, type PostData } from "@/components/feed/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface FeedClientProps {
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
}

export function FeedClient({ user }: FeedClientProps) {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(
    async (loadMore = false) => {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({ limit: "10" });
        if (loadMore && cursor) {
          params.set("cursor", cursor);
        }

        const res = await fetch(`/api/v1/posts?${params}`);
        const data = (await res.json()) as {
          success: boolean;
          data?: PostData[];
          meta?: { cursor?: string; hasMore?: boolean };
          error?: { message: string };
        };

        if (data.success && data.data) {
          if (loadMore) {
            setPosts((prev) => [...prev, ...data.data!]);
          } else {
            setPosts(data.data);
          }
          setCursor(data.meta?.cursor);
          setHasMore(data.meta?.hasMore ?? false);
        } else {
          setError(data.error?.message || "Failed to load posts");
        }
      } catch {
        setError("Failed to load posts");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [cursor]
  );

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePostCreated = () => {
    // Reset and refetch
    setCursor(undefined);
    fetchPosts();
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      fetchPosts(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PostComposer user={user} />
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
            <div className="flex gap-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PostComposer user={user} onPostCreated={handlePostCreated} />

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4 text-sm">
          {error}
          <Button
            variant="link"
            className="ml-2 h-auto p-0"
            onClick={() => fetchPosts()}
          >
            Try again
          </Button>
        </div>
      )}

      {posts.length === 0 && !error ? (
        <div className="text-muted-foreground py-12 text-center">
          <p className="text-lg font-medium">No posts yet</p>
          <p className="text-sm">Be the first to share something!</p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
          ))}

          {hasMore && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
