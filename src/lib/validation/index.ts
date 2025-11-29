/**
 * Shared validation utilities for client and server
 * These can be imported in both client components and API routes
 */

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 100,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
} as const;

export interface PasswordStrength {
  score: number; // 0-5
  level: "weak" | "fair" | "good" | "strong" | "very-strong";
  feedback: string[];
  isValid: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Invalid email address");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate username format
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (!username) {
    errors.push("Username is required");
  } else {
    if (username.length < 3) {
      errors.push("Username must be at least 3 characters");
    }
    if (username.length > 30) {
      errors.push("Username must be at most 30 characters");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push(
        "Username can only contain letters, numbers, and underscores"
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate display name
 */
export function validateDisplayName(displayName: string): ValidationResult {
  const errors: string[] = [];

  if (!displayName) {
    errors.push("Display name is required");
  } else if (displayName.length > 50) {
    errors.push("Display name must be at most 50 characters");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Check password strength and provide feedback
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return {
      score: 0,
      level: "weak",
      feedback: ["Password is required"],
      isValid: false,
    };
  }

  // Length checks
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) {
    score += 1;
  } else {
    feedback.push(
      `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
    );
  }

  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    feedback.push(
      `Password must be at most ${PASSWORD_REQUIREMENTS.maxLength} characters`
    );
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Add an uppercase letter (A-Z)");
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Add a lowercase letter (a-z)");
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Add a number (0-9)");
  }

  // Special character check
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Add a special character (!@#$%^&*...)");
  }

  // Determine level
  let level: PasswordStrength["level"];
  if (score <= 1) level = "weak";
  else if (score === 2) level = "fair";
  else if (score === 3) level = "good";
  else if (score === 4) level = "strong";
  else level = "very-strong";

  return {
    score,
    level,
    feedback,
    isValid: score === 5 && password.length <= PASSWORD_REQUIREMENTS.maxLength,
  };
}

/**
 * Validate password meets all requirements
 */
export function validatePassword(password: string): ValidationResult {
  const strength = checkPasswordStrength(password);
  return {
    isValid: strength.isValid,
    errors: strength.feedback,
  };
}

/**
 * Validate password confirmation matches
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): ValidationResult {
  const errors: string[] = [];

  if (!confirmPassword) {
    errors.push("Please confirm your password");
  } else if (password !== confirmPassword) {
    errors.push("Passwords do not match");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Full registration form validation
 */
export function validateRegistrationForm(data: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  const emailResult = validateEmail(data.email);
  if (!emailResult.isValid) errors.email = emailResult.errors;

  const usernameResult = validateUsername(data.username);
  if (!usernameResult.isValid) errors.username = usernameResult.errors;

  const displayNameResult = validateDisplayName(data.displayName);
  if (!displayNameResult.isValid) errors.displayName = displayNameResult.errors;

  const passwordResult = validatePassword(data.password);
  if (!passwordResult.isValid) errors.password = passwordResult.errors;

  const confirmResult = validatePasswordMatch(
    data.password,
    data.confirmPassword
  );
  if (!confirmResult.isValid) errors.confirmPassword = confirmResult.errors;

  return errors;
}

/**
 * Full login form validation
 */
export function validateLoginForm(data: {
  email: string;
  password: string;
}): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  const emailResult = validateEmail(data.email);
  if (!emailResult.isValid) errors.email = emailResult.errors;

  if (!data.password) {
    errors.password = ["Password is required"];
  }

  return errors;
}
