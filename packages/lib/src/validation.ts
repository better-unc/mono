export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 39;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const PASSWORD_MIN_LENGTH = 8;

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export function validateUsername(username: string): ValidationResult {
  if (username.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: `Username must be at most ${USERNAME_MAX_LENGTH} characters` };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, hyphens, and underscores" };
  }

  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }

  return { valid: true };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
