"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  UserMinus,
  Clock,
  Check,
  MoreHorizontal,
  ShieldBan,
  Flag,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileActionsProps {
  userId: string;
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "friends";
  isBlocked: boolean;
}

export default function ProfileActions({
  userId,
  friendshipStatus: initialStatus,
  isBlocked: initialBlocked,
}: ProfileActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isBlocked, setIsBlocked] = useState(initialBlocked);
  const [isLoading, setIsLoading] = useState(false);

  const handleFriendAction = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (status === "none") {
        // Send friend request
        const res = await fetch(`/api/v1/friends/request/${userId}`, {
          method: "POST",
        });
        const data = (await res.json()) as { success: boolean };
        if (data.success) {
          setStatus("pending_sent");
        }
      } else if (status === "pending_sent") {
        // Cancel friend request - would need new API endpoint
        // For now, just refresh
        router.refresh();
      } else if (status === "pending_received") {
        // Accept friend request
        const res = await fetch(`/api/v1/friends/accept/${userId}`, {
          method: "POST",
        });
        const data = (await res.json()) as { success: boolean };
        if (data.success) {
          setStatus("friends");
        }
      } else if (status === "friends") {
        // Unfriend
        const res = await fetch(`/api/v1/friends?friendId=${userId}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { success: boolean };
        if (data.success) {
          setStatus("none");
        }
      }
    } catch (error) {
      console.error("Friend action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isBlocked) {
        const res = await fetch(`/api/v1/blocks?userId=${userId}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { success: boolean };
        if (data.success) {
          setIsBlocked(false);
        }
      } else {
        const res = await fetch("/api/v1/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = (await res.json()) as { success: boolean };
        if (data.success) {
          setIsBlocked(true);
          setStatus("none");
        }
      }
    } catch (error) {
      console.error("Block action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReport = async () => {
    const reason = prompt(
      "Why are you reporting this user?\n\nOptions: spam, harassment, hate_speech, impersonation, other"
    );
    if (!reason) return;

    try {
      await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "user",
          targetId: userId,
          reason: reason.toLowerCase().includes("spam")
            ? "spam"
            : reason.toLowerCase().includes("harass")
              ? "harassment"
              : reason.toLowerCase().includes("hate")
                ? "hate_speech"
                : reason.toLowerCase().includes("impers")
                  ? "impersonation"
                  : "other",
          description: reason,
        }),
      });
      alert("Report submitted. Thank you.");
    } catch {
      alert("Failed to submit report.");
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case "none":
        return (
          <>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Friend
          </>
        );
      case "pending_sent":
        return (
          <>
            <Clock className="mr-2 h-4 w-4" />
            Request Sent
          </>
        );
      case "pending_received":
        return (
          <>
            <Check className="mr-2 h-4 w-4" />
            Accept Request
          </>
        );
      case "friends":
        return (
          <>
            <UserMinus className="mr-2 h-4 w-4" />
            Unfriend
          </>
        );
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleFriendAction}
        disabled={isLoading || isBlocked}
        variant={status === "friends" ? "outline" : "default"}
      >
        {getButtonContent()}
      </Button>

      {status === "friends" && (
        <Button
          variant="outline"
          onClick={() => router.push(`/messages?user=${userId}`)}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleBlock}>
            <ShieldBan
              className={cn("mr-2 h-4 w-4", isBlocked && "text-red-500")}
            />
            {isBlocked ? "Unblock user" : "Block user"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReport}>
            <Flag className="mr-2 h-4 w-4" />
            Report user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
