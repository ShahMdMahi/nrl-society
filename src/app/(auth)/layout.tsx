import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import Link from "next/link";

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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left side - Branding */}
      <div className="bg-primary text-primary-foreground hidden flex-col justify-between p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg">
            <span className="text-primary text-xl font-bold">N</span>
          </div>
          <span className="text-xl font-semibold">NRL Society</span>
        </Link>

        <div className="space-y-6">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Connect with peoples from around the world. Share your
              passion, discuss anything, and be part of the ultimate NRL
              community.&rdquo;
            </p>
            <footer className="text-primary-foreground/70 text-sm">
              — Join thousands of members
            </footer>
          </blockquote>
        </div>

        <div className="text-primary-foreground/70 flex items-center gap-4 text-sm">
          <span>© 2025 NRL Society</span>
          <span>•</span>
          <Link
            href="/privacy"
            className="hover:text-primary-foreground transition-colors"
          >
            Privacy
          </Link>
          <span>•</span>
          <Link
            href="/terms"
            className="hover:text-primary-foreground transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex flex-col">
        {/* Mobile header */}
        <div className="flex items-center justify-center border-b p-6 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <span className="text-primary-foreground text-lg font-bold">
                N
              </span>
            </div>
            <span className="text-lg font-semibold">NRL Society</span>
          </Link>
        </div>

        {/* Form container */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        {/* Mobile footer */}
        <div className="text-muted-foreground flex items-center justify-center gap-4 border-t p-6 text-sm lg:hidden">
          <span>© 2025 NRL Society</span>
          <span>•</span>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}
