"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, ArrowLeft, Plus, Search } from "lucide-react";
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

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/conversations");
      const data = await res.json() as { success: boolean; data?: Conversation[] };
      
      if (data.success && data.data) {
        setConversations(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/messages`);
      const data = await res.json() as { success: boolean; data?: Message[] };
      
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
      const data = await res.json() as { success: boolean; data?: Message } & Message;
      
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
      <div className="h-[calc(100vh-8rem)] flex">
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
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Conversations List */}
      <Card
        className={cn(
          "w-80 shrink-0 flex flex-col",
          selectedConversation && "hidden md:flex"
        )}
      >
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button variant="ghost" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations" className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a conversation with a friend</p>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
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
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {getConversationName(conv)}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), {
                          addSuffix: false,
                        })}
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
          "flex-1 flex flex-col",
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
                    src={getConversationAvatar(selectedConversation) || undefined}
                    alt={getConversationName(selectedConversation)}
                  />
                  <AvatarFallback>
                    {getConversationName(selectedConversation).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {getConversationName(selectedConversation)}
                  </p>
                  <p className="text-sm text-muted-foreground">
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
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No messages yet</p>
                    <p className="text-sm">Send a message to start the conversation</p>
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
                              {message.sender.displayName.charAt(0).toUpperCase()}
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
                              "text-xs mt-1",
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
            <div className="shrink-0 p-4 border-t">
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
                <Button type="submit" disabled={!newMessage.trim() || isSending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a conversation</p>
              <p className="text-sm">Choose a conversation from the list</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
