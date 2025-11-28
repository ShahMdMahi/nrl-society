"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, Check, X, Users } from "lucide-react";
import Link from "next/link";

interface Friend {
  id?: string;
  friendId?: string;
  requesterId?: string;
  addresseeId?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean | null;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFriends = useCallback(async (status: string) => {
    try {
      const res = await fetch(`/api/v1/friends?status=${status}`);
      const data = (await res.json()) as { success: boolean; data?: Friend[] };

      if (data.success && data.data) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch ${status} friends:`, error);
      return [];
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      const [friendsData, pendingData, sentData] = await Promise.all([
        fetchFriends("accepted"),
        fetchFriends("pending"),
        fetchFriends("sent"),
      ]);

      setFriends(friendsData);
      setPendingRequests(pendingData);
      setSentRequests(sentData);
      setIsLoading(false);
    };

    loadAll();
  }, [fetchFriends]);

  const acceptRequest = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/friends/accept/${userId}`, {
        method: "POST",
      });
      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        const accepted = pendingRequests.find((r) => r.requesterId === userId);
        if (accepted) {
          setPendingRequests((prev) =>
            prev.filter((r) => r.requesterId !== userId),
          );
          setFriends((prev) => [...prev, { ...accepted, friendId: userId }]);
        }
      }
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  const rejectRequest = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/friends/reject/${userId}`, {
        method: "POST",
      });
      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setPendingRequests((prev) =>
          prev.filter((r) => r.requesterId !== userId),
        );
      }
    } catch (error) {
      console.error("Failed to reject request:", error);
    }
  };

  const cancelRequest = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/friends/request/${userId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setSentRequests((prev) => prev.filter((r) => r.addresseeId !== userId));
      }
    } catch (error) {
      console.error("Failed to cancel request:", error);
    }
  };

  const removeFriend = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/friends/request/${userId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setFriends((prev) => prev.filter((f) => f.friendId !== userId));
      }
    } catch (error) {
      console.error("Failed to remove friend:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Friends</CardTitle>
            <Badge variant="secondary">{friends.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="friends">
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="friends" className="flex gap-2">
                <Users className="h-4 w-4" />
                Friends ({friends.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex gap-2">
                <UserPlus className="h-4 w-4" />
                Requests ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex gap-2">
                Sent ({sentRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-sm">
                    Connect with people to add them as friends
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.friendId}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
                    >
                      <Link href={`/profile/${friend.friendId}`}>
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={friend.avatarUrl || undefined}
                            alt={friend.displayName}
                          />
                          <AvatarFallback>
                            {friend.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <Link
                          href={`/profile/${friend.friendId}`}
                          className="font-semibold hover:underline"
                        >
                          {friend.displayName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          @{friend.username}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFriend(friend.friendId!)}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.requesterId}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
                    >
                      <Link href={`/profile/${request.requesterId}`}>
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={request.avatarUrl || undefined}
                            alt={request.displayName}
                          />
                          <AvatarFallback>
                            {request.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <Link
                          href={`/profile/${request.requesterId}`}
                          className="font-semibold hover:underline"
                        >
                          {request.displayName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          @{request.username}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptRequest(request.requesterId!)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rejectRequest(request.requesterId!)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent">
              {sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sent requests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sentRequests.map((request) => (
                    <div
                      key={request.addresseeId}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
                    >
                      <Link href={`/profile/${request.addresseeId}`}>
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={request.avatarUrl || undefined}
                            alt={request.displayName}
                          />
                          <AvatarFallback>
                            {request.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <Link
                          href={`/profile/${request.addresseeId}`}
                          className="font-semibold hover:underline"
                        >
                          {request.displayName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          @{request.username}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelRequest(request.addresseeId!)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
