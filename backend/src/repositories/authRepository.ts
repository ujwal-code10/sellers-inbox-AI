import pool from "../utils/db.js";
import { AuthenticatedUser } from "../models/auth.js";

export interface AuthUserCredentialsRow {
  id: number;
  name: string;
  email: string;
  password: string;
  banned_at: string | null;
}

export async function insertUser(params: {
  name: string;
  email: string;
  hashedPassword: string;
}): Promise<AuthenticatedUser> {
  const result = await pool.query(
    "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
    [params.name, params.email, params.hashedPassword]
  );

  return result.rows[0] as AuthenticatedUser;
}

export async function selectAuthUserCredentialsByEmail(
  email: string
): Promise<AuthUserCredentialsRow | null> {
  const result = await pool.query(
    "SELECT id, name, email, password, banned_at FROM users WHERE email = $1",
    [email]
  );

  return (result.rows[0] as AuthUserCredentialsRow | undefined) || null;
}

export async function existsUserByEmail(email: string): Promise<boolean> {
  const result = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
  return result.rows.length > 0;
}

export async function selectUserProfileById(
  userId: number
): Promise<AuthenticatedUser | null> {
  const result = await pool.query(
    "SELECT id, name, email, created_at FROM users WHERE id = $1",
    [userId]
  );

  return (result.rows[0] as AuthenticatedUser | undefined) || null;
}

export async function updateUserNameById(
  userId: number,
  trimmedName: string
): Promise<AuthenticatedUser | null> {
  const result = await pool.query(
    "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email",
    [trimmedName, userId]
  );

  return (result.rows[0] as AuthenticatedUser | undefined) || null;
}