import { getCurrentUser } from "@/lib/auth/session";
import { FeedClient } from "@/components/feed/FeedClient";

export default async function FeedPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null; // Layout will redirect
  }

  return (
    <div className="w-full">
      <h1 className="mb-6 text-2xl font-bold">Home Feed</h1>
      <FeedClient
        user={{
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        }}
      />
    </div>
  );
}
