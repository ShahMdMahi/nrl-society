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
          <main className="flex min-w-0 flex-1 justify-center">
            <div className="w-full max-w-3xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
