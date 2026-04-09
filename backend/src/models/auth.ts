export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  normalizedEmail: string;
}

export interface UpdateProfileNameInput {
  trimmedName: string;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}
