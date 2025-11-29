"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/v1/auth/verify-email?token=${token}`);
        const data = (await res.json()) as {
          success: boolean;
          data?: { message: string };
          error?: { message: string };
        };

        if (data.success) {
          setStatus("success");
          setMessage(
            data.data?.message || "Your email has been verified successfully!"
          );
        } else {
          setStatus("error");
          setMessage(
            data.error?.message ||
              "Failed to verify email. The link may be invalid or expired."
          );
        }
      } catch {
        setStatus("error");
        setMessage("An error occurred. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Verifying your email...</h1>
          <p className="text-muted-foreground">
            Please wait while we verify your email address.
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Email Verified!</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="space-y-2">
          <Link href="/feed">
            <Button className="w-full">Go to Feed</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" className="w-full">
              Complete Your Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <XCircle className="h-8 w-8 text-red-600" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Verification Failed</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <div className="space-y-2">
        <Link href="/settings">
          <Button className="w-full">
            <Mail className="mr-2 h-4 w-4" />
            Request New Verification Email
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            Back to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
