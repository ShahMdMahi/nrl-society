"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { validateLoginForm } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));

      // Clear field error when user starts typing
      if (fieldErrors[name]) {
        setFieldErrors((prev) => {
          const updated = { ...prev };
          delete updated[name];
          return updated;
        });
      }
    },
    [fieldErrors]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const { name } = e.target;
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validate on blur
      const errors = validateLoginForm(formData);
      if (errors[name]) {
        setFieldErrors((prev) => ({ ...prev, [name]: errors[name] }));
      }
    },
    [formData]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const errors = validateLoginForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ email: true, password: true });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = (await res.json()) as {
        success: boolean;
        error?: { code: string; message: string };
      };

      if (!data.success) {
        // Handle rate limiting
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          setError(
            data.error?.message ||
              `Too many attempts. Please try again in ${Math.ceil(Number(retryAfter || 60) / 60)} minutes.`
          );
        } else {
          setError(data.error?.message || "Login failed");
        }
        return;
      }

      // Redirect to feed on success
      router.push("/feed");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getFieldError = (field: string) =>
    touched[field] && fieldErrors[field]?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Enter your credentials to access your account
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive animate-in fade-in-0 slide-in-from-top-1 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Authentication failed</p>
            <p className="text-destructive/80 mt-0.5">{error}</p>
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
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              aria-invalid={!!getFieldError("email")}
              aria-describedby={
                getFieldError("email") ? "email-error" : undefined
              }
              className={`h-11 pl-10 ${getFieldError("email") ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
          </div>
          {getFieldError("email") && (
            <p
              id="email-error"
              className="text-destructive flex items-center gap-1 text-xs"
            >
              <AlertCircle className="h-3 w-3" />
              {getFieldError("email")}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-primary text-xs transition-colors"
            >
              Forgot password?
            </Link>
          </div>
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
              aria-invalid={!!getFieldError("password")}
              aria-describedby={
                getFieldError("password") ? "password-error" : undefined
              }
              className={`h-11 pr-10 pl-10 ${getFieldError("password") ? "border-destructive focus-visible:ring-destructive" : ""}`}
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
          {getFieldError("password") && (
            <p
              id="password-error"
              className="text-destructive flex items-center gap-1 text-xs"
            >
              <AlertCircle className="h-3 w-3" />
              {getFieldError("password")}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="h-11 w-full font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">
            New to NRL Society?
          </span>
        </div>
      </div>

      {/* Sign Up Link */}
      <Button variant="outline" className="h-11 w-full" asChild>
        <Link href="/register">Create an account</Link>
      </Button>
    </div>
  );
}
