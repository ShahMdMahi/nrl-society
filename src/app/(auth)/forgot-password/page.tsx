"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  AlertCircle,
  Mail,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { validateEmail } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError(null);
    setError(null);
  };

  const handleEmailBlur = () => {
    if (email) {
      const result = validateEmail(email);
      if (!result.isValid) {
        setEmailError(result.errors[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const result = validateEmail(email);
    if (!result.isValid) {
      setEmailError(result.errors[0]);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsSubmitted(true);
      } else {
        setError(
          data.error?.message || "Something went wrong. Please try again."
        );
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-muted-foreground text-sm">
            If an account exists for{" "}
            <span className="font-medium">{email}</span>, you&apos;ll receive a
            password reset link shortly.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <p className="text-muted-foreground">
            <strong>Didn&apos;t receive an email?</strong>
          </p>
          <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email</li>
            <li>Wait a few minutes and try again</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              setIsSubmitted(false);
              setEmail("");
            }}
          >
            Try a different email
          </Button>
          <Button variant="ghost" className="h-11 w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Forgot your password?
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive animate-in fade-in-0 slide-in-from-top-1 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email address
          </Label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              disabled={isLoading}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              className={`h-11 pl-10 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
          </div>
          {emailError && (
            <p
              id="email-error"
              className="text-destructive flex items-center gap-1 text-xs"
            >
              <AlertCircle className="h-3 w-3" />
              {emailError}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="h-11 w-full font-medium"
          disabled={isLoading || !email.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending reset link...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>

      {/* Back to Login */}
      <Button variant="ghost" className="h-11 w-full" asChild>
        <Link href="/login">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
      </Button>
    </div>
  );
}
