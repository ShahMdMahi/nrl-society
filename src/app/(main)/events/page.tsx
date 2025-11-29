"use client";

import { useState, useEffect, useCallback } from "react";
import {
  formatDistanceToNow,
  format,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  Plus,
  Clock,
  Check,
  Star,
  Loader2,
  Video,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  location: string | null;
  locationType: "in-person" | "online" | "hybrid";
  eventUrl: string | null;
  startDate: string;
  endDate: string | null;
  isPublic: boolean;
  maxAttendees: number | null;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  attendeeCounts: {
    going: number;
    interested: number;
  };
  userStatus: "going" | "interested" | null;
  isCreator: boolean;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    "upcoming" | "attending" | "my" | "past"
  >("upcoming");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState<{
    title: string;
    description: string;
    location: string;
    locationType: "in-person" | "online" | "hybrid";
    eventUrl: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    isPublic: boolean;
    maxAttendees: string;
  }>({
    title: "",
    description: "",
    location: "",
    locationType: "in-person",
    eventUrl: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    isPublic: true,
    maxAttendees: "",
  });

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/events?filter=${filter}&limit=20`);
      const data = (await res.json()) as {
        success: boolean;
        data?: EventData[];
      };

      if (data.success && data.data) {
        setEvents(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.startDate || !newEvent.startTime) return;

    setIsCreating(true);
    try {
      const startDateTime = new Date(
        `${newEvent.startDate}T${newEvent.startTime}`
      );
      const endDateTime =
        newEvent.endDate && newEvent.endTime
          ? new Date(`${newEvent.endDate}T${newEvent.endTime}`)
          : null;

      const res = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          description: newEvent.description || undefined,
          location: newEvent.location || undefined,
          locationType: newEvent.locationType,
          eventUrl: newEvent.eventUrl || undefined,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime?.toISOString() || undefined,
          isPublic: newEvent.isPublic,
          maxAttendees: newEvent.maxAttendees
            ? parseInt(newEvent.maxAttendees)
            : undefined,
        }),
      });

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setIsCreateOpen(false);
        setNewEvent({
          title: "",
          description: "",
          location: "",
          locationType: "in-person",
          eventUrl: "",
          startDate: "",
          startTime: "",
          endDate: "",
          endTime: "",
          isPublic: true,
          maxAttendees: "",
        });
        fetchEvents();
      }
    } catch (error) {
      console.error("Failed to create event:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRSVP = async (
    eventId: string,
    status: "going" | "interested" | "not_going"
  ) => {
    try {
      const res = await fetch(`/api/v1/events/${eventId}/attend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = (await res.json()) as {
        success: boolean;
        data?: {
          status: string | null;
          attendeeCounts: { going: number; interested: number };
        };
      };

      if (data.success && data.data) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  userStatus: data.data!.status as
                    | "going"
                    | "interested"
                    | null,
                  attendeeCounts: data.data!.attendeeCounts,
                }
              : e
          )
        );
      }
    } catch (error) {
      console.error("Failed to RSVP:", error);
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case "online":
        return <Video className="h-4 w-4" />;
      case "hybrid":
        return <Globe className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const isEventPast = (date: string) => isBefore(parseISO(date), new Date());

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-primary h-8 w-8" />
            <h1 className="text-2xl font-bold">Events</h1>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Skeleton className="h-40 w-full rounded-t-lg" />
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="text-primary h-8 w-8" />
          <h1 className="text-2xl font-bold">Events</h1>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="Give your event a name"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell people what your event is about"
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newEvent.startDate}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, startTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={newEvent.endDate}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, endDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Type</Label>
                <div className="flex gap-2">
                  {(["in-person", "online", "hybrid"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={
                        newEvent.locationType === type ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() =>
                        setNewEvent({ ...newEvent, locationType: type })
                      }
                    >
                      {type === "in-person" && (
                        <MapPin className="mr-1 h-3 w-3" />
                      )}
                      {type === "online" && <Video className="mr-1 h-3 w-3" />}
                      {type === "hybrid" && <Globe className="mr-1 h-3 w-3" />}
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {(newEvent.locationType === "in-person" ||
                newEvent.locationType === "hybrid") && (
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Where is it happening?"
                    value={newEvent.location}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, location: e.target.value })
                    }
                  />
                </div>
              )}

              {(newEvent.locationType === "online" ||
                newEvent.locationType === "hybrid") && (
                <div className="space-y-2">
                  <Label htmlFor="eventUrl">Event URL</Label>
                  <Input
                    id="eventUrl"
                    type="url"
                    placeholder="https://zoom.us/j/..."
                    value={newEvent.eventUrl}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, eventUrl: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Max Attendees (optional)</Label>
                <Input
                  id="maxAttendees"
                  type="number"
                  placeholder="Leave empty for unlimited"
                  value={newEvent.maxAttendees}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, maxAttendees: e.target.value })
                  }
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreateEvent}
                disabled={
                  isCreating ||
                  !newEvent.title ||
                  !newEvent.startDate ||
                  !newEvent.startTime
                }
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Event"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="attending">Attending</TabsTrigger>
          <TabsTrigger value="my">My Events</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h2 className="mb-2 text-xl font-semibold">No events found</h2>
            <p className="text-muted-foreground mb-6">
              {filter === "upcoming"
                ? "No upcoming events. Create one to get started!"
                : filter === "attending"
                  ? "You haven't RSVP'd to any events yet."
                  : filter === "my"
                    ? "You haven't created any events yet."
                    : "No past events to show."}
            </p>
            {filter !== "upcoming" && (
              <Button variant="outline" onClick={() => setFilter("upcoming")}>
                Browse Upcoming Events
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              {event.coverImageUrl ? (
                <div className="h-40 w-full">
                  <img
                    src={event.coverImageUrl}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="from-primary/20 to-primary/40 flex h-40 items-center justify-center bg-linear-to-br">
                  <Calendar className="text-primary h-16 w-16" />
                </div>
              )}
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="line-clamp-1 font-semibold">
                      {event.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      by {event.creator.displayName}
                    </p>
                  </div>
                  {event.isCreator && (
                    <Badge variant="secondary">Your Event</Badge>
                  )}
                </div>

                <div className="text-muted-foreground space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(
                        parseISO(event.startDate),
                        "MMM d, yyyy 'at' h:mm a"
                      )}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      {getLocationIcon(event.locationType)}
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                      {event.attendeeCounts.going} going
                      {event.attendeeCounts.interested > 0 &&
                        ` · ${event.attendeeCounts.interested} interested`}
                    </span>
                  </div>
                </div>

                {!isEventPast(event.startDate) && !event.isCreator && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant={
                        event.userStatus === "going" ? "default" : "outline"
                      }
                      className="flex-1"
                      onClick={() =>
                        handleRSVP(
                          event.id,
                          event.userStatus === "going" ? "not_going" : "going"
                        )
                      }
                    >
                      {event.userStatus === "going" ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Going
                        </>
                      ) : (
                        "Going"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        event.userStatus === "interested"
                          ? "default"
                          : "outline"
                      }
                      className="flex-1"
                      onClick={() =>
                        handleRSVP(
                          event.id,
                          event.userStatus === "interested"
                            ? "not_going"
                            : "interested"
                        )
                      }
                    >
                      {event.userStatus === "interested" ? (
                        <>
                          <Star className="mr-1 h-3 w-3 fill-current" />
                          Interested
                        </>
                      ) : (
                        <>
                          <Star className="mr-1 h-3 w-3" />
                          Interested
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {event.eventUrl && (
                  <a
                    href={event.eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary mt-2 flex items-center gap-1 text-sm hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Join Online
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
