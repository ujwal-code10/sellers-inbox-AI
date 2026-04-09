import bcrypt from "bcryptjs";
import {
  createRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
  SELLER_REFRESH_TTL_SECONDS,
  signSellerAccessToken,
} from "../utils/authSession.js";
import { AuthenticatedUser, LoginInput, SignupInput } from "../models/auth.js";
import {
  existsUserByEmail,
  insertUser,
  selectAuthUserCredentialsByEmail,
  selectUserProfileById,
  updateUserNameById,
} from "../repositories/authRepository.js";

interface SessionRequestMeta {
  ipAddress?: string;
  userAgent?: string | string[];
}

interface AuthSessionResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

export class AuthServiceError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
  }
}

export async function signupUser(
  input: SignupInput,
  meta: SessionRequestMeta
): Promise<AuthSessionResult> {
  try {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await insertUser({
      name: input.name,
      email: input.email,
      hashedPassword,
    });

    const accessToken = signSellerAccessToken(user.id);
    const refreshSession = await createRefreshSession({
      tokenType: "user",
      userId: user.id,
      ttlSeconds: SELLER_REFRESH_TTL_SECONDS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user,
      accessToken,
      refreshToken: refreshSession.token,
    };
  } catch (err: any) {
    if (err?.code === "23505") {
      throw new AuthServiceError("Unable to create account", 400);
    }

    throw new AuthServiceError("Server error", 500);
  }
}

export async function loginUser(
  input: LoginInput,
  meta: SessionRequestMeta
): Promise<AuthSessionResult> {
  try {
    const user = await selectAuthUserCredentialsByEmail(input.email);
    if (!user) {
      throw new AuthServiceError("Invalid credentials", 401);
    }

    if (user.banned_at) {
      throw new AuthServiceError("Invalid credentials", 401);
    }

    const isMatch = await bcrypt.compare(input.password, user.password);

    if (!isMatch) {
      throw new AuthServiceError("Invalid credentials", 401);
    }

    const accessToken = signSellerAccessToken(user.id);
    const refreshSession = await createRefreshSession({
      tokenType: "user",
      userId: user.id,
      ttlSeconds: SELLER_REFRESH_TTL_SECONDS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken: refreshSession.token,
    };
  } catch (err) {
    if (err instanceof AuthServiceError) {
      throw err;
    }

    throw new AuthServiceError("Server error", 500);
  }
}

export async function requestPasswordReset(normalizedEmail: string): Promise<void> {
  try {
    await existsUserByEmail(normalizedEmail);
  } catch {
    throw new AuthServiceError("Server error", 500);
  }
}

export async function rotateSellerSession(
  refreshToken: string,
  meta: SessionRequestMeta
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const rotated = await rotateRefreshSession({
      currentToken: refreshToken,
      tokenType: "user",
      ttlSeconds: SELLER_REFRESH_TTL_SECONDS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (!rotated?.userId) {
      return null;
    }

    const accessToken = signSellerAccessToken(rotated.userId);

    return {
      accessToken,
      refreshToken: rotated.token,
    };
  } catch {
    throw new AuthServiceError("Server error", 500);
  }
}

export async function revokeSellerSession(refreshToken: string): Promise<void> {
  try {
    await revokeRefreshSession(refreshToken, "user");
  } catch {
    // Keep logout resilient; do not throw.
  }
}

export async function getUserById(userId: number): Promise<AuthenticatedUser> {
  try {
    const user = await selectUserProfileById(userId);
    if (!user) {
      throw new AuthServiceError("User not found", 404);
    }

    return user;
  } catch (err) {
    if (err instanceof AuthServiceError) {
      throw err;
    }

    throw new AuthServiceError("Server error", 500);
  }
}

export async function updateUserName(
  userId: number,
  trimmedName: string
): Promise<AuthenticatedUser> {
  try {
    const user = await updateUserNameById(userId, trimmedName);
    if (!user) {
      throw new AuthServiceError("User not found", 404);
    }

    return user;
  } catch (err) {
    if (err instanceof AuthServiceError) {
      throw err;
    }

    throw new AuthServiceError("Server error", 500);
  }
}
