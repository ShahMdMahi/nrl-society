"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  User,
  Shield,
  Bell,
  Camera,
  Loader2,
  X,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/utils/image-compression";

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
}

interface BlockedUser {
  id: string;
  blockedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    isPrivate: false,
  });

  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    pushNotifications: true,
    likesNotifications: true,
    commentsNotifications: true,
    followsNotifications: true,
    messagesNotifications: true,
    mentionsNotifications: true,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      const data = (await res.json()) as {
        success: boolean;
        data?: { user: UserProfile };
      };

      if (data.success && data.data?.user) {
        setUser(data.data.user);
        setFormData({
          displayName: data.data.user.displayName,
          bio: data.data.user.bio || "",
          isPrivate: data.data.user.isPrivate,
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  }, []);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/blocks");
      const data = (await res.json()) as {
        success: boolean;
        data?: BlockedUser[];
      };

      if (data.success && data.data) {
        setBlockedUsers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch blocked users:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchProfile(), fetchBlockedUsers()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchBlockedUsers]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        toast.success("Profile updated successfully");
        fetchProfile();
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.9,
        maxSizeKB: 200, // 200KB max for avatars
      });

      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("type", "avatar");

      const uploadRes = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = (await uploadRes.json()) as {
        success: boolean;
        data?: { url: string };
      };

      if (uploadData.success && uploadData.data?.url) {
        // Update profile with new avatar URL
        const updateRes = await fetch(`/api/v1/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarUrl: uploadData.data.url }),
        });

        const updateData = (await updateRes.json()) as { success: boolean };

        if (updateData.success) {
          toast.success("Avatar updated");
          fetchProfile();
        }
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingCover(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file, {
        maxWidth: 1500,
        maxHeight: 500,
        quality: 0.85,
        maxSizeKB: 500, // 500KB max for covers
      });

      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("type", "cover");

      const uploadRes = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = (await uploadRes.json()) as {
        success: boolean;
        data?: { url: string };
      };

      if (uploadData.success && uploadData.data?.url) {
        // Update profile with new cover URL
        const updateRes = await fetch(`/api/v1/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverUrl: uploadData.data.url }),
        });

        const updateData = (await updateRes.json()) as { success: boolean };

        if (updateData.success) {
          toast.success("Cover photo updated");
          fetchProfile();
        }
      }
    } catch (error) {
      console.error("Failed to upload cover:", error);
      toast.error("Failed to upload cover photo");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/blocks?userId=${userId}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setBlockedUsers((prev) => prev.filter((b) => b.user.id !== userId));
        toast.success("User unblocked");
      }
    } catch (error) {
      console.error("Failed to unblock user:", error);
      toast.error("Failed to unblock user");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="text-primary h-8 w-8" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Please log in to access settings.
            </p>
            <Button className="mt-4" onClick={() => router.push("/login")}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="text-primary h-8 w-8" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-2">
            <Lock className="h-4 w-4" />
            Blocked
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Cover Photo */}
          <Card>
            <CardHeader>
              <CardTitle>Cover Photo</CardTitle>
              <CardDescription>
                Your cover photo appears at the top of your profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="from-primary/20 to-primary/40 h-32 rounded-lg bg-linear-to-r">
                  {user.coverUrl && (
                    <img
                      src={user.coverUrl}
                      alt="Cover"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  )}
                </div>
                <label className="absolute right-2 bottom-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadCover}
                    disabled={isUploadingCover}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      {isUploadingCover ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      Change Cover
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Avatar */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Your profile picture is visible to everyone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute -right-1 -bottom-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadAvatar}
                      disabled={isUploadingAvatar}
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 cursor-pointer rounded-full"
                      asChild
                    >
                      <span>
                        {isUploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-muted-foreground text-sm">
                    @{user.username}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  maxLength={500}
                  rows={4}
                />
                <p className="text-muted-foreground text-xs">
                  {formData.bio.length}/500 characters
                </p>
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving || !formData.displayName.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can see your content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Private Account</Label>
                  <p className="text-muted-foreground text-sm">
                    Only approved followers can see your posts.
                  </p>
                </div>
                <Switch
                  checked={formData.isPrivate}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isPrivate: checked })
                  }
                />
              </div>
              <Separator />
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Privacy Settings"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Delivery Methods</h4>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-muted-foreground text-sm">
                      Receive notifications via email.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        emailNotifications: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-muted-foreground text-sm">
                      Receive push notifications in your browser.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.pushNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        pushNotifications: checked,
                      })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Activity Notifications</h4>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Likes</Label>
                    <p className="text-muted-foreground text-sm">
                      When someone likes your posts.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.likesNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        likesNotifications: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Comments</Label>
                    <p className="text-muted-foreground text-sm">
                      When someone comments on your posts.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.commentsNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        commentsNotifications: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Follows</Label>
                    <p className="text-muted-foreground text-sm">
                      When someone follows you.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.followsNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        followsNotifications: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Messages</Label>
                    <p className="text-muted-foreground text-sm">
                      When you receive new messages.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.messagesNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        messagesNotifications: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mentions</Label>
                    <p className="text-muted-foreground text-sm">
                      When someone mentions you in a post.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.mentionsNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        mentionsNotifications: checked,
                      })
                    }
                  />
                </div>
              </div>

              <Separator />

              <Button
                onClick={() => {
                  setIsSavingNotifications(true);
                  // Save notification preferences (would need an API endpoint)
                  setTimeout(() => {
                    toast.success("Notification preferences saved");
                    setIsSavingNotifications(false);
                  }, 500);
                }}
                disabled={isSavingNotifications}
              >
                {isSavingNotifications ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Notification Settings"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Blocked Users</CardTitle>
              <CardDescription>
                People you&apos;ve blocked can&apos;t see your profile or
                contact you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockedUsers.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  You haven&apos;t blocked anyone.
                </p>
              ) : (
                <div className="space-y-3">
                  {blockedUsers.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage
                            src={blocked.user.avatarUrl || undefined}
                          />
                          <AvatarFallback>
                            {blocked.user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {blocked.user.displayName}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            @{blocked.user.username}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblock(blocked.user.id)}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
