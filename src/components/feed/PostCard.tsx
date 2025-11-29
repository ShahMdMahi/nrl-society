"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import { MediaGallery } from "@/components/shared/MediaGallery";

/**
 * Parse content and render @mentions as clickable links
 */
function RenderContent({ content }: { content: string }) {
  const parts = useMemo(() => {
    // Split content by @mentions while keeping the mentions
    const mentionRegex = /(@[a-zA-Z0-9_]{3,30})\b/g;
    const segments: { type: "text" | "mention"; value: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: content.slice(lastIndex, match.index),
        });
      }
      // Add the mention
      segments.push({
        type: "mention",
        value: match[1],
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex),
      });
    }

    return segments;
  }, [content]);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "mention") {
          const username = part.value.slice(1); // Remove @ symbol
          return (
            <Link
              key={index}
              href={`/search?q=${encodeURIComponent(username)}&type=users`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part.value}
            </Link>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </>
  );
}

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
  isSaved?: boolean;
  isShared?: boolean;
}

interface PostCardProps {
  post: PostData;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, onDelete }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(post.isSaved ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [isShared, setIsShared] = useState(post.isShared ?? false);
  const [sharesCount, setSharesCount] = useState(post.sharesCount ?? 0);
  const [isSharing, setIsSharing] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

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

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const wasSaved = isSaved;
    setIsSaved(!wasSaved);

    try {
      if (wasSaved) {
        const res = await fetch(`/api/v1/saved?postId=${post.id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { success: boolean };
        if (!data.success) {
          setIsSaved(wasSaved);
        }
      } else {
        const res = await fetch("/api/v1/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        });
        const data = (await res.json()) as { success: boolean };
        if (!data.success) {
          setIsSaved(wasSaved);
        }
      }
    } catch {
      setIsSaved(wasSaved);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    const wasShared = isShared;
    setIsShared(!wasShared);
    setSharesCount((prev) => (wasShared ? prev - 1 : prev + 1));

    try {
      const res = await fetch(`/api/v1/posts/${post.id}/share`, {
        method: wasShared ? "DELETE" : "POST",
      });
      const data = (await res.json()) as { success: boolean };
      if (!data.success) {
        setIsShared(wasShared);
        setSharesCount((prev) => (wasShared ? prev + 1 : prev - 1));
      }
    } catch {
      setIsShared(wasShared);
      setSharesCount((prev) => (wasShared ? prev + 1 : prev - 1));
    } finally {
      setIsSharing(false);
    }
  };

  const handleReport = async () => {
    if (isReporting) return;
    const reason = prompt(
      "Why are you reporting this post?\n\nOptions: spam, harassment, hate_speech, violence, nudity, false_information, other"
    );
    if (!reason) return;

    setIsReporting(true);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "post",
          targetId: post.id,
          reason: reason.toLowerCase().includes("spam")
            ? "spam"
            : reason.toLowerCase().includes("harass")
              ? "harassment"
              : reason.toLowerCase().includes("hate")
                ? "hate_speech"
                : reason.toLowerCase().includes("violen")
                  ? "violence"
                  : reason.toLowerCase().includes("nud")
                    ? "nudity"
                    : reason.toLowerCase().includes("false")
                      ? "false_information"
                      : "other",
          description: reason,
        }),
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        alert(
          "Report submitted. Thank you for helping keep our community safe."
        );
      }
    } catch {
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsReporting(false);
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
              <DropdownMenuItem onClick={handleSave} disabled={isSaving}>
                <Bookmark
                  className={cn("mr-2 h-4 w-4", isSaved && "fill-current")}
                />
                {isSaved ? "Unsave post" : "Save post"}
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
                <DropdownMenuItem onClick={handleReport} disabled={isReporting}>
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
          <p className="text-sm whitespace-pre-wrap">
            <RenderContent content={post.content} />
          </p>
        )}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <MediaGallery mediaUrls={post.mediaUrls} className="mt-3" />
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
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2", isShared && "text-green-500")}
            onClick={handleShare}
            disabled={isSharing}
          >
            <Share2 className={cn("h-4 w-4", isShared && "fill-current")} />
            <span>{sharesCount > 0 ? sharesCount : ""}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("ml-auto", isSaved && "text-yellow-500")}
            onClick={handleSave}
            disabled={isSaving}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
