"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Plus,
  Search,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  name: string | null;
  type: string | null;
  isGroup: boolean;
  createdAt: string;
  participants: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
  lastMessage: {
    id: string;
    content: string | null;
    senderId: string;
    createdAt: string;
  } | null;
}

interface Message {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  isRead: boolean | null;
  createdAt: string;
  isOwn: boolean;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Friend {
  id: string;
  friendId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New conversation modal state
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/conversations");
      const data = (await res.json()) as {
        success: boolean;
        data?: Conversation[];
      };

      if (data.success && data.data) {
        setConversations(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const res = await fetch("/api/v1/friends?status=accepted");
      const data = (await res.json()) as {
        success: boolean;
        data?: Friend[];
      };

      if (data.success && data.data) {
        setFriends(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/v1/conversations/${conversationId}/messages`
      );
      const data = (await res.json()) as { success: boolean; data?: Message[] };

      if (data.success && data.data) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (isNewConversationOpen) {
      fetchFriends();
    }
  }, [isNewConversationOpen, fetchFriends]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(
        `/api/v1/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newMessage }),
        }
      );
      const data = (await res.json()) as {
        success: boolean;
        data?: Message;
      } & Message;

      if (data.success) {
        const msg = data.data || data;
        setMessages((prev) => [...prev, msg as Message]);
        setNewMessage("");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const createConversation = async () => {
    if (selectedFriends.length === 0 || isCreatingConversation) return;

    setIsCreatingConversation(true);
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: selectedFriends,
          isGroup: selectedFriends.length > 1,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        data?: { conversationId: string; existing: boolean };
      };

      if (data.success && data.data) {
        // Refetch conversations to get the new/existing one
        await fetchConversations();

        // Find and select the conversation
        const newConvId = data.data.conversationId;
        const newConv = conversations.find((c) => c.id === newConvId);
        if (newConv) {
          setSelectedConversation(newConv);
        }

        // Close modal and reset
        setIsNewConversationOpen(false);
        setSelectedFriends([]);
        setFriendSearchQuery("");
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const filteredFriends = friends.filter(
    (friend) =>
      friend.displayName
        .toLowerCase()
        .includes(friendSearchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.participants.length > 0) {
      return conv.participants.map((p) => p.displayName).join(", ");
    }
    return "New Conversation";
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.participants.length > 0) {
      return conv.participants[0].avatarUrl;
    }
    return null;
  };

  if (isLoadingConversations) {
    return (
      <div className="flex h-[calc(100vh-8rem)]">
        <Card className="w-80 shrink-0">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full gap-4">
      {/* Conversations List */}
      <Card
        className={cn(
          "flex w-80 shrink-0 flex-col",
          selectedConversation && "hidden md:flex"
        )}
      >
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewConversationOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search conversations"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            {filteredConversations.length === 0 ? (
              <div className="text-muted-foreground px-4 py-8 text-center">
                <MessageCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a conversation with a friend</p>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                      selectedConversation?.id === conv.id
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={getConversationAvatar(conv) || undefined}
                        alt={getConversationName(conv)}
                      />
                      <AvatarFallback>
                        {getConversationName(conv).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {getConversationName(conv)}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-muted-foreground truncate text-sm">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(
                          new Date(conv.lastMessage.createdAt),
                          {
                            addSuffix: false,
                          }
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Messages Area */}
      <Card
        className={cn(
          "flex flex-1 flex-col",
          !selectedConversation && "hidden md:flex"
        )}
      >
        {selectedConversation ? (
          <>
            <CardHeader className="shrink-0 border-b">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={
                      getConversationAvatar(selectedConversation) || undefined
                    }
                    alt={getConversationName(selectedConversation)}
                  />
                  <AvatarFallback>
                    {getConversationName(selectedConversation)
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {getConversationName(selectedConversation)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {selectedConversation.isGroup
                      ? `${selectedConversation.participants.length + 1} members`
                      : "Direct message"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full p-4">
                {isLoadingMessages ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-2",
                          i % 2 === 0 ? "justify-end" : "justify-start"
                        )}
                      >
                        <Skeleton className="h-8 w-48 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <p>No messages yet</p>
                    <p className="text-sm">
                      Send a message to start the conversation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-2",
                          message.isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        {!message.isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={message.sender.avatarUrl || undefined}
                              alt={message.sender.displayName}
                            />
                            <AvatarFallback>
                              {message.sender.displayName
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            message.isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-xs",
                              message.isOwn
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatDistanceToNow(new Date(message.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <div className="shrink-0 border-t p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isSending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Select a conversation</p>
              <p className="text-sm">Choose a conversation from the list</p>
            </div>
          </div>
        )}
      </Card>

      {/* New Conversation Dialog */}
      <Dialog
        open={isNewConversationOpen}
        onOpenChange={setIsNewConversationOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Select friends to start a conversation with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search friends..."
                className="pl-9"
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[300px]">
              {isLoadingFriends ? (
                <div className="space-y-3 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  {friends.length === 0 ? (
                    <>
                      <p>No friends yet</p>
                      <p className="text-sm">
                        Add friends to start conversations
                      </p>
                    </>
                  ) : (
                    <p>No friends match your search</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredFriends.map((friend) => (
                    <button
                      key={friend.friendId}
                      onClick={() => toggleFriendSelection(friend.friendId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                        selectedFriends.includes(friend.friendId)
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={friend.avatarUrl || undefined}
                          alt={friend.displayName}
                        />
                        <AvatarFallback>
                          {friend.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{friend.displayName}</p>
                        <p className="text-muted-foreground text-sm">
                          @{friend.username}
                        </p>
                      </div>
                      {selectedFriends.includes(friend.friendId) && (
                        <Check className="text-primary h-5 w-5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedFriends.length > 0 && (
              <div className="text-muted-foreground text-sm">
                {selectedFriends.length} friend
                {selectedFriends.length > 1 ? "s" : ""} selected
                {selectedFriends.length > 1 && " (group chat)"}
              </div>
            )}
            <Button
              onClick={createConversation}
              disabled={selectedFriends.length === 0 || isCreatingConversation}
              className="w-full"
            >
              {isCreatingConversation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Start Conversation"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
