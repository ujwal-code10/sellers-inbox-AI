export interface UserModel {
  id: number;
  name: string;
  email: string;
  password_hash?: string;
  banned_at?: string | null;
  ban_reason?: string | null;
  banned_by?: number | null;
  created_at?: string;
}

export interface UserSessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}
