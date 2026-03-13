-- Create delivery_zones table for flexible seller-defined delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  cod_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_delivery_zones_user_id ON delivery_zones(user_id);

-- Note: delivery_settings table remains for backward compatibility
