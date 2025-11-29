import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getDB } from "@/lib/cloudflare/d1";
import { users, posts, friendships, likes, blocks } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  BadgeCheck,
  Calendar,
  Settings,
  UserPlus,
  UserMinus,
  Clock,
  ShieldBan,
  ImageIcon,
} from "lucide-react";
import { eq, sql, or, and, desc, inArray } from "drizzle-orm";
import { formatDate } from "@/lib/utils/date";
import { PostCard, type PostData } from "@/components/feed/PostCard";
import ProfileActions from "./ProfileActions";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;
  const currentUser = await getCurrentUser();

  const db = await getDB();

  // Get user profile
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      coverUrl: users.coverUrl,
      isVerified: users.isVerified,
      isPrivate: users.isPrivate,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    notFound();
  }

  // Get post count
  const [postCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.userId, userId));

  // Get friends count
  const [friendsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId)
        ),
        eq(friendships.status, "accepted")
      )
    );

  // Get user's posts
  const userPosts = await db
    .select({
      id: posts.id,
      content: posts.content,
      mediaUrls: posts.mediaUrls,
      visibility: posts.visibility,
      likesCount: posts.likesCount,
      commentsCount: posts.commentsCount,
      sharesCount: posts.sharesCount,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(20);

  // Get user's friends list
  const userFriendships = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
    })
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId)
        ),
        eq(friendships.status, "accepted")
      )
    )
    .limit(12);

  // Get friend IDs
  const friendIds = userFriendships.map((f) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  );

  // Fetch friend details
  let friendsList: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean | null;
  }[] = [];

  if (friendIds.length > 0) {
    friendsList = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(inArray(users.id, friendIds))
      .limit(12);
  }

  // Extract photos from posts with media
  const photosFromPosts = userPosts
    .filter((p) => p.mediaUrls)
    .flatMap((p) => {
      try {
        const urls = JSON.parse(p.mediaUrls || "[]") as string[];
        return urls.map((url) => ({ postId: p.id, url }));
      } catch {
        return [];
      }
    })
    .slice(0, 9);

  const isOwnProfile = currentUser?.id === userId;

  // Get friendship status if not own profile
  let friendshipStatus:
    | "none"
    | "pending_sent"
    | "pending_received"
    | "friends" = "none";
  if (currentUser && !isOwnProfile) {
    const [friendship] = await db
      .select({
        status: friendships.status,
        requesterId: friendships.requesterId,
      })
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, currentUser.id),
            eq(friendships.addresseeId, userId)
          ),
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, currentUser.id)
          )
        )
      )
      .limit(1);

    if (friendship) {
      if (friendship.status === "accepted") {
        friendshipStatus = "friends";
      } else if (friendship.status === "pending") {
        friendshipStatus =
          friendship.requesterId === currentUser.id
            ? "pending_sent"
            : "pending_received";
      }
    }
  }

  // Check if user is blocked
  let isBlocked = false;
  if (currentUser && !isOwnProfile) {
    const [blocked] = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        and(eq(blocks.blockerId, currentUser.id), eq(blocks.blockedId, userId))
      )
      .limit(1);
    isBlocked = !!blocked;
  }

  // Get liked post IDs for current user
  let likedPostIds: string[] = [];
  if (currentUser && userPosts.length > 0) {
    const postIds = userPosts.map((p) => p.id);
    const userLikes = await db
      .select({ targetId: likes.targetId })
      .from(likes)
      .where(
        and(
          eq(likes.userId, currentUser.id),
          eq(likes.targetType, "post"),
          inArray(likes.targetId, postIds)
        )
      );
    likedPostIds = userLikes.map((l) => l.targetId);
  }

  // Map posts to PostData format
  const postsData: PostData[] = userPosts.map((post) => ({
    ...post,
    visibility: post.visibility || "public",
    mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
    createdAt: post.createdAt.toISOString(),
    author: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
    },
    isLiked: likedPostIds.includes(post.id),
    isOwnPost: isOwnProfile,
  }));

  return (
    <div className="w-full">
      {/* Cover Photo */}
      <div className="from-primary/20 to-primary/40 relative h-48 rounded-t-lg bg-linear-to-r">
        {user.coverUrl && (
          <Image
            src={user.coverUrl}
            alt="Cover photo"
            fill
            className="rounded-t-lg object-cover"
            unoptimized
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="bg-background relative rounded-b-lg border-x border-b px-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="border-background -mt-16 h-32 w-32 border-4">
              <AvatarImage
                src={user.avatarUrl || undefined}
                alt={user.displayName}
              />
              <AvatarFallback className="text-4xl">
                {user.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="pb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{user.displayName}</h1>
                {user.isVerified && (
                  <BadgeCheck className="text-primary fill-primary h-6 w-6" />
                )}
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0">
            {isOwnProfile ? (
              <Link href="/settings">
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </Link>
            ) : (
              <ProfileActions
                userId={userId}
                friendshipStatus={friendshipStatus}
                isBlocked={isBlocked}
              />
            )}
          </div>
        </div>

        {/* Bio */}
        {user.bio && <p className="mt-4 text-sm">{user.bio}</p>}

        {/* Meta info */}
        <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {formatDate(user.createdAt, "MMMM yyyy")}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <span className="font-bold">{postCount?.count ?? 0}</span>{" "}
            <span className="text-muted-foreground">Posts</span>
          </div>
          <div>
            <span className="font-bold">{friendsCount?.count ?? 0}</span>{" "}
            <span className="text-muted-foreground">Friends</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="mt-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="mt-4 space-y-4">
          {postsData.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>No posts yet</p>
            </div>
          ) : (
            postsData.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>
        <TabsContent value="photos" className="mt-4">
          {photosFromPosts.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <ImageIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No photos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photosFromPosts.map((photo, index) => (
                <Link
                  key={`${photo.postId}-${index}`}
                  href={`/post/${photo.postId}`}
                  className="group relative aspect-square overflow-hidden rounded-lg"
                >
                  <Image
                    src={photo.url}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    unoptimized
                  />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="friends" className="mt-4">
          {friendsList.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>No friends yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {friendsList.map((friend) => (
                <Link key={friend.id} href={`/profile/${friend.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={friend.avatarUrl || undefined}
                          alt={friend.displayName}
                        />
                        <AvatarFallback>
                          {friend.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-sm font-medium">
                            {friend.displayName}
                          </p>
                          {friend.isVerified && (
                            <BadgeCheck className="text-primary fill-primary h-3 w-3 shrink-0" />
                          )}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          @{friend.username}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
