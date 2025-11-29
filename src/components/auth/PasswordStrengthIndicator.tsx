"use client";

import { useMemo } from "react";
import { checkPasswordStrength, type PasswordStrength } from "@/lib/validation";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
  className?: string;
}

const strengthColors: Record<PasswordStrength["level"], string> = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-lime-500",
  "very-strong": "bg-green-500",
};

const strengthLabels: Record<PasswordStrength["level"], string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
  "very-strong": "Very Strong",
};

export function PasswordStrengthIndicator({
  password,
  showFeedback = true,
  className,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Strength bars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              level <= strength.score
                ? strengthColors[strength.level]
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            strength.level === "weak" && "text-red-500",
            strength.level === "fair" && "text-orange-500",
            strength.level === "good" && "text-yellow-600",
            strength.level === "strong" && "text-lime-600",
            strength.level === "very-strong" && "text-green-600"
          )}
        >
          {strengthLabels[strength.level]}
        </span>
        <span className="text-muted-foreground">
          {strength.score}/5 requirements met
        </span>
      </div>

      {/* Feedback messages */}
      {showFeedback && strength.feedback.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 text-xs">
          {strength.feedback.map((message, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <span className="text-amber-500">•</span>
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
