import { notFound } from "next/navigation";
import Image from "next/image";
import { getDB } from "@/lib/cloudflare/d1";
import { users, posts, friendships } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeCheck, Calendar } from "lucide-react";
import { eq, sql, or, and, desc } from "drizzle-orm";
import { format } from "date-fns";
import { PostCard, type PostData } from "@/components/feed/PostCard";

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

  const isOwnProfile = currentUser?.id === userId;

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
    isLiked: false, // TODO: Check if current user liked each post
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
              <Button variant="outline">Edit Profile</Button>
            ) : (
              <Button>Add Friend</Button>
            )}
          </div>
        </div>

        {/* Bio */}
        {user.bio && <p className="mt-4 text-sm">{user.bio}</p>}

        {/* Meta info */}
        <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {format(user.createdAt, "MMMM yyyy")}</span>
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
          <div className="text-muted-foreground py-12 text-center">
            <p>No photos yet</p>
          </div>
        </TabsContent>
        <TabsContent value="friends" className="mt-4">
          <div className="text-muted-foreground py-12 text-center">
            <p>Friends list coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
