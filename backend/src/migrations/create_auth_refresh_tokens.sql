-- Refresh token sessions for secure cookie-based auth

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    token_type VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    replaced_by_id BIGINT REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
    CONSTRAINT valid_refresh_token_type CHECK (token_type IN ('user', 'admin')),
    CONSTRAINT valid_refresh_token_owner CHECK (
      (token_type = 'user' AND user_id IS NOT NULL AND admin_id IS NULL) OR
      (token_type = 'admin' AND admin_id IS NOT NULL AND user_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id
  ON auth_refresh_tokens(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_admin_id
  ON auth_refresh_tokens(admin_id)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at
  ON auth_refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked_at
  ON auth_refresh_tokens(revoked_at);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_type_hash
  ON auth_refresh_tokens(token_type, token_hash);
