import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // If user is logged in, redirect to feed
  if (user) {
    redirect("/feed");
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-6">{children}</div>
    </div>
  );
}
