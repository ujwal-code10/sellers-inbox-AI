import {
  ForgotPasswordInput,
  LoginInput,
  SignupInput,
  UpdateProfileNameInput,
} from "../models/auth.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthSchemaError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "AuthSchemaError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseSignupBody(body: unknown): SignupInput {
  if (!isRecord(body)) {
    throw new AuthSchemaError("Invalid request body");
  }

  const { name, email, password } = body;

  if (!name || !email || !password) {
    throw new AuthSchemaError("All fields required");
  }

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
    throw new AuthSchemaError("Name must be 1-100 characters");
  }

  if (typeof email !== "string" || !EMAIL_REGEX.test(email) || email.length > 255) {
    throw new AuthSchemaError("Invalid email address");
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new AuthSchemaError("Password must be at least 8 characters");
  }

  if (password.length > 128) {
    throw new AuthSchemaError("Password is too long (max 128 characters)");
  }

  return {
    name,
    email,
    password,
  };
}

export function parseLoginBody(body: unknown): LoginInput {
  if (!isRecord(body)) {
    throw new AuthSchemaError("Invalid request body");
  }

  const { email, password } = body;

  if (!email || !password) {
    throw new AuthSchemaError("Email and password required");
  }

  if (typeof email !== "string" || typeof password !== "string") {
    throw new AuthSchemaError("Email and password required");
  }

  return { email, password };
}

export function parseForgotPasswordBody(body: unknown): ForgotPasswordInput {
  if (!isRecord(body)) {
    throw new AuthSchemaError("Invalid request body");
  }

  const { email } = body;

  if (!email || typeof email !== "string") {
    throw new AuthSchemaError("Email is required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 255) {
    throw new AuthSchemaError("Invalid email address");
  }

  return { normalizedEmail };
}

export function parseUpdateMeBody(body: unknown): UpdateProfileNameInput {
  if (!isRecord(body)) {
    throw new AuthSchemaError("Invalid request body");
  }

  const { name } = body;

  if (typeof name !== "string") {
    throw new AuthSchemaError("Name is required");
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 100) {
    throw new AuthSchemaError("Name must be 1-100 characters");
  }

  return { trimmedName };
}
