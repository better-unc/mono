export interface AuthenticatedUser {
  id: string;
  username: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

