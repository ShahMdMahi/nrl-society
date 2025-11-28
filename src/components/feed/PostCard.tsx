"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PostData {
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

interface PostCardProps {
  post: PostData;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, onDelete }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      const res = await fetch(`/api/v1/posts/${post.id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });

      const data = (await res.json()) as { success: boolean };

      if (!data.success) {
        // Revert on error
        setIsLiked(wasLiked);
        setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
      }
    } catch {
      // Revert on error
      setIsLiked(wasLiked);
      setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/v1/posts/${post.id}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        onDelete?.(post.id);
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            href={`/profile/${post.author.id}`}
            className="flex items-center gap-3 hover:opacity-80"
          >
            <Avatar className="h-10 w-10">
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
                <span className="text-sm font-semibold">
                  {post.author.displayName}
                </span>
                {post.author.isVerified && (
                  <BadgeCheck className="text-primary fill-primary h-4 w-4" />
                )}
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
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
                  onClick={handleDelete}
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
          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
        )}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="mt-3 grid gap-2 overflow-hidden rounded-lg">
            {/* TODO: Implement media gallery */}
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
        <div className="flex w-full items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2", isLiked && "text-red-500")}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
            <span>{likesCount > 0 ? likesCount : ""}</span>
          </Button>
          <Link href={`/post/${post.id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>
                {(post.commentsCount ?? 0) > 0 ? post.commentsCount : ""}
              </span>
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="gap-2" disabled>
            <Share2 className="h-4 w-4" />
            <span>{(post.sharesCount ?? 0) > 0 ? post.sharesCount : ""}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
