import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Navbar } from "@/components/shared/Navbar";
import { Sidebar } from "@/components/shared/Sidebar";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // If user is not logged in, redirect to login
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="bg-background min-h-screen">
      <Navbar user={user} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-3xl">{children}</div>
          </main>
          {/* Right spacer to balance the sidebar on large screens */}
          <div className="hidden w-64 shrink-0 xl:block" />
        </div>
      </div>
    </div>
  );
}
