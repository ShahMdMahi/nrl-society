"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Trash2,
  Flag,
  Bookmark,
  BadgeCheck,
  ArrowLeft,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PostData {
  id: string;
  content: string | null;
  mediaUrls: string[];
  visibility: string;
  likesCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean | null;
  };
  isLiked: boolean;
  isOwnPost?: boolean;
}

interface CommentData {
  id: string;
  content: string;
  likesCount: number | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean | null;
  };
  isOwnComment?: boolean;
}

interface PostPageProps {
  params: Promise<{ postId: string }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { postId } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/posts/${postId}`);
      const data = (await res.json()) as {
        success: boolean;
        data?: PostData;
      };

      if (data.success && data.data) {
        setPost(data.data);
        setIsLiked(data.data.isLiked);
        setLikesCount(data.data.likesCount ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch post:", error);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  const fetchComments = useCallback(
    async (loadMore = false) => {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (loadMore && cursor) {
          params.set("cursor", cursor);
        }

        const res = await fetch(`/api/v1/posts/${postId}/comments?${params}`);
        const data = (await res.json()) as {
          success: boolean;
          data?: CommentData[];
          meta?: { cursor?: string; hasMore?: boolean };
        };

        if (data.success && data.data) {
          if (loadMore) {
            setComments((prev) => [...prev, ...data.data!]);
          } else {
            setComments(data.data);
          }
          setCursor(data.meta?.cursor);
          setHasMore(data.meta?.hasMore ?? false);
        }
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setIsLoadingComments(false);
      }
    },
    [postId, cursor]
  );

  useEffect(() => {
    fetchPost();
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPost]);

  const handleLike = async () => {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      const res = await fetch(`/api/v1/posts/${postId}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });
      const data = (await res.json()) as { success: boolean };
      if (!data.success) {
        setIsLiked(wasLiked);
        setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
      }
    } catch {
      setIsLiked(wasLiked);
      setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      const data = (await res.json()) as {
        success: boolean;
        data?: CommentData;
      };

      if (data.success && data.data) {
        setComments((prev) => [data.data!, ...prev]);
        setNewComment("");
        if (post) {
          setPost({
            ...post,
            commentsCount: (post.commentsCount ?? 0) + 1,
          });
        }
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const res = await fetch(
        `/api/v1/posts/${postId}/comments?commentId=${commentId}`,
        {
          method: "DELETE",
        }
      );

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        if (post) {
          setPost({
            ...post,
            commentsCount: Math.max((post.commentsCount ?? 0) - 1, 0),
          });
        }
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/v1/posts/${postId}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        router.push("/feed");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Post not found</h2>
            <p className="text-muted-foreground mt-2">
              This post may have been deleted or you don&apos;t have permission
              to view it.
            </p>
            <Button className="mt-4" onClick={() => router.push("/feed")}>
              Go to Feed
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      {/* Post */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <Link
              href={`/profile/${post.author.id}`}
              className="flex items-center gap-3 hover:opacity-80"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={post.author.avatarUrl || undefined}
                  alt={post.author.displayName}
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
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <span>@{post.author.username}</span>
                  <span>·</span>
                  <span>{timeAgo}</span>
                </div>
              </div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Bookmark className="mr-2 h-4 w-4" />
                  Save post
                </DropdownMenuItem>
                {post.isOwnPost ? (
                  <DropdownMenuItem
                    onClick={handleDeletePost}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete post
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem>
                    <Flag className="mr-2 h-4 w-4" />
                    Report post
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {post.content && (
            <p className="whitespace-pre-wrap">{post.content}</p>
          )}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <div className="mt-4 grid gap-2">
              {post.mediaUrls.map((url, index) => (
                <div key={index} className="relative aspect-video w-full">
                  <Image
                    src={url}
                    alt="Post media"
                    fill
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-3">
          <div className="flex w-full items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-2", isLiked && "text-red-500")}
              onClick={handleLike}
            >
              <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
              <span>{likesCount}</span>
            </Button>
            <div className="text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span>{post.commentsCount ?? 0}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              <span>{post.sharesCount ?? 0}</span>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Comment Input */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-20 resize-none"
              disabled={isSubmitting}
            />
            <Button
              size="icon"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <div className="space-y-3">
        <h2 className="font-semibold">Comments ({post.commentsCount ?? 0})</h2>

        {isLoadingComments ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageCircle className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground">
                No comments yet. Be the first to comment!
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <Link href={`/profile/${comment.author.id}`}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={comment.author.avatarUrl || undefined}
                        />
                        <AvatarFallback>
                          {comment.author.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/profile/${comment.author.id}`}
                          className="flex items-center gap-1"
                        >
                          <span className="text-sm font-semibold">
                            {comment.author.displayName}
                          </span>
                          {comment.author.isVerified && (
                            <BadgeCheck className="text-primary fill-primary h-3 w-3" />
                          )}
                          <span className="text-muted-foreground text-xs">
                            ·{" "}
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </Link>
                        {comment.isOwnComment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-sm">{comment.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fetchComments(true)}
              >
                Load more comments
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
