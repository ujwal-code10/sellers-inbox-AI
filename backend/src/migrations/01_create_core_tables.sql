-- Core Business Tables Migration
-- Set up products, variants, subscriptions, and usage_daily tables

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    keywords TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Variants Table
CREATE TABLE IF NOT EXISTS variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    color VARCHAR(100) NOT NULL,
    size VARCHAR(50) NOT NULL,
    available BOOLEAN DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1
);

-- 3. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    billing VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    payment_ref VARCHAR(255)
);

-- 4. Daily Usage Tracking
CREATE TABLE IF NOT EXISTS usage_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reply_count INTEGER DEFAULT 0,
    UNIQUE (user_id, date)
);
