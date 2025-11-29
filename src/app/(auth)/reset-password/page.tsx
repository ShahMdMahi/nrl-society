"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { validatePassword, validatePasswordMatch } from "@/lib/validation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenError(
          "No reset token provided. Please request a new password reset link."
        );
        setIsVerifying(false);
        return;
      }

      try {
        const res = await fetch(`/api/v1/auth/reset-password?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setTokenError(
            data.error?.message ||
              "This reset link is invalid or has expired. Please request a new one."
          );
        }
      } catch {
        setTokenError("Failed to verify reset link. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setError(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "password" && value) {
      const result = validatePassword(value);
      if (!result.isValid) {
        setFieldErrors((prev) => ({ ...prev, password: result.errors[0] }));
      }
    }

    if (name === "confirmPassword" && value) {
      const result = validatePasswordMatch(formData.password, value);
      if (!result.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          confirmPassword: result.errors[0],
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate password
    const passwordResult = validatePassword(formData.password);
    if (!passwordResult.isValid) {
      setFieldErrors((prev) => ({
        ...prev,
        password: passwordResult.errors[0],
      }));
      return;
    }

    // Validate password match
    const matchResult = validatePasswordMatch(
      formData.password,
      formData.confirmPassword
    );
    if (!matchResult.isValid) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: matchResult.errors[0],
      }));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsSubmitted(true);
      } else {
        setError(
          data.error?.message || "Failed to reset password. Please try again."
        );
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while verifying token
  if (isVerifying) {
    return (
      <div className="space-y-6 text-center">
        <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Verifying reset link...</p>
      </div>
    );
  }

  // Invalid token state
  if (tokenError) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="text-destructive h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Invalid reset link
          </h1>
          <p className="text-muted-foreground text-sm">{tokenError}</p>
        </div>

        <div className="space-y-3">
          <Button className="h-11 w-full" asChild>
            <Link href="/forgot-password">Request new reset link</Link>
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

  // Success state
  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Password reset successful
          </h1>
          <p className="text-muted-foreground text-sm">
            Your password has been reset. You can now log in with your new
            password.
          </p>
        </div>

        <Button
          className="h-11 w-full font-medium"
          onClick={() => router.push("/login")}
        >
          Continue to login
        </Button>
      </div>
    );
  }

  // Reset form
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your new password below.
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
        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            New password
          </Label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              aria-invalid={!!fieldErrors.password}
              className={`h-11 pr-10 pl-10 ${
                fieldErrors.password
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {formData.password && (
            <PasswordStrengthIndicator
              password={formData.password}
              showFeedback={true}
            />
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm new password
          </Label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              aria-invalid={!!fieldErrors.confirmPassword}
              className={`h-11 pr-10 pl-10 ${
                fieldErrors.confirmPassword
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="h-11 w-full font-medium"
          disabled={
            isLoading || !formData.password || !formData.confirmPassword
          }
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting password...
            </>
          ) : (
            "Reset password"
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 text-center">
          <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
