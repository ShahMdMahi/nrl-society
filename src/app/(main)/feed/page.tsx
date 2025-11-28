import { getCurrentUser } from "@/lib/auth/session";
import { FeedClient } from "@/components/feed/FeedClient";

export default async function FeedPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null; // Layout will redirect
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Home Feed</h1>
      <FeedClient
        user={{
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        }}
      />
    </div>
  );
}
