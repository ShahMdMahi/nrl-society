"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AtSign,
  Check,
} from "lucide-react";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import {
  validateEmail,
  validateUsername,
  validateDisplayName,
  validatePassword,
  validatePasswordMatch,
} from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const validateField = useCallback(
    (name: string, value: string) => {
      switch (name) {
        case "email":
          return validateEmail(value);
        case "username":
          return validateUsername(value);
        case "displayName":
          return validateDisplayName(value);
        case "password":
          return validatePassword(value);
        case "confirmPassword":
          return validatePasswordMatch(formData.password, value);
        default:
          return { isValid: true, errors: [] };
      }
    },
    [formData.password]
  );

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

      // Re-validate confirm password when password changes
      if (
        name === "password" &&
        touched.confirmPassword &&
        formData.confirmPassword
      ) {
        const result = validatePasswordMatch(value, formData.confirmPassword);
        if (!result.isValid) {
          setFieldErrors((prev) => ({
            ...prev,
            confirmPassword: result.errors,
          }));
        } else {
          setFieldErrors((prev) => {
            const updated = { ...prev };
            delete updated.confirmPassword;
            return updated;
          });
        }
      }
    },
    [fieldErrors, touched.confirmPassword, formData.confirmPassword]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validate on blur
      const result = validateField(name, value);
      if (!result.isValid) {
        setFieldErrors((prev) => ({ ...prev, [name]: result.errors }));
      }
    },
    [validateField]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const allTouched = Object.keys(formData).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);

    const errors: Record<string, string[]> = {};
    Object.entries(formData).forEach(([name, value]) => {
      const result = validateField(name, value);
      if (!result.isValid) {
        errors[name] = result.errors;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          displayName: formData.displayName,
          password: formData.password,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        error?: {
          code: string;
          message: string;
          details?: Array<{ path: string[]; message: string }>;
        };
      };

      if (!data.success) {
        // Handle rate limiting
        if (res.status === 429) {
          setError(
            data.error?.message || "Too many attempts. Please try again later."
          );
          return;
        }

        // Handle validation errors from server
        if (data.error?.details) {
          const serverErrors: Record<string, string[]> = {};
          for (const err of data.error.details) {
            const field = err.path[0];
            if (!serverErrors[field]) serverErrors[field] = [];
            serverErrors[field].push(err.message);
          }
          setFieldErrors(serverErrors);
        } else {
          setError(data.error?.message || "Registration failed");
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

  const isFieldValid = (field: string) =>
    touched[field] &&
    !fieldErrors[field] &&
    formData[field as keyof typeof formData];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-muted-foreground text-sm">
          Join the NRL Society community today
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive animate-in fade-in-0 slide-in-from-top-1 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Registration failed</p>
            <p className="text-destructive/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Display Name Field */}
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-sm font-medium">
            Display Name
          </Label>
          <div className="relative">
            <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="displayName"
              name="displayName"
              placeholder="John Doe"
              value={formData.displayName}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              aria-invalid={!!getFieldError("displayName")}
              className={`h-11 pr-10 pl-10 ${
                getFieldError("displayName")
                  ? "border-destructive focus-visible:ring-destructive"
                  : isFieldValid("displayName")
                    ? "border-green-500 focus-visible:ring-green-500"
                    : ""
              }`}
            />
            {isFieldValid("displayName") && (
              <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
            )}
          </div>
          {getFieldError("displayName") && (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {getFieldError("displayName")}
            </p>
          )}
        </div>

        {/* Username Field */}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium">
            Username
          </Label>
          <div className="relative">
            <AtSign className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="username"
              name="username"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              aria-invalid={!!getFieldError("username")}
              className={`h-11 pr-10 pl-10 ${
                getFieldError("username")
                  ? "border-destructive focus-visible:ring-destructive"
                  : isFieldValid("username")
                    ? "border-green-500 focus-visible:ring-green-500"
                    : ""
              }`}
            />
            {isFieldValid("username") && (
              <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
            )}
          </div>
          {getFieldError("username") ? (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {getFieldError("username")}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Letters, numbers, and underscores only
            </p>
          )}
        </div>

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
              className={`h-11 pr-10 pl-10 ${
                getFieldError("email")
                  ? "border-destructive focus-visible:ring-destructive"
                  : isFieldValid("email")
                    ? "border-green-500 focus-visible:ring-green-500"
                    : ""
              }`}
            />
            {isFieldValid("email") && (
              <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
            )}
          </div>
          {getFieldError("email") && (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {getFieldError("email")}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
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
              aria-invalid={!!getFieldError("password")}
              className={`h-11 pr-10 pl-10 ${
                getFieldError("password")
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
              showFeedback={touched.password}
            />
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
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
              aria-invalid={!!getFieldError("confirmPassword")}
              className={`h-11 pr-10 pl-10 ${
                getFieldError("confirmPassword")
                  ? "border-destructive focus-visible:ring-destructive"
                  : isFieldValid("confirmPassword")
                    ? "border-green-500 focus-visible:ring-green-500"
                    : ""
              }`}
            />
            {isFieldValid("confirmPassword") ? (
              <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
            ) : (
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
            )}
          </div>
          {getFieldError("confirmPassword") && (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {getFieldError("confirmPassword")}
            </p>
          )}
        </div>

        {/* Terms Notice */}
        <p className="text-muted-foreground text-center text-xs">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>

        {/* Submit Button */}
        <Button
          type="submit"
          className="h-11 w-full font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
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
            Already have an account?
          </span>
        </div>
      </div>

      {/* Sign In Link */}
      <Button variant="outline" className="h-11 w-full" asChild>
        <Link href="/login">Sign in instead</Link>
      </Button>
    </div>
  );
}
