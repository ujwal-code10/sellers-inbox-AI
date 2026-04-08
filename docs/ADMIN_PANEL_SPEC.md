# Admin Panel System Specification

> Version: 1.0
> Status: Implemented baseline + ongoing polish
> Last Updated: April 2026

---

## 1. Database Schema (Admin Layer)

### 1.1 New Tables Required

#### `admin_users`
```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'super_admin'))
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
```

#### `transactions`
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NPR',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_ref VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_type CHECK (type IN ('subscription', 'refund', 'credit')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

#### `ai_usage_logs`
```sql
CREATE TABLE ai_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_request_type CHECK (request_type IN ('suggest_reply', 'clarification'))
);

CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_status ON ai_usage_logs(status);
```

#### `system_settings`
```sql
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES admin_users(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
('free_tier_limits', '{"daily_replies": 20, "max_products": 5}', 'Free tier usage limits'),
('pro_pricing', '{"monthly": 299, "yearly": 2499}', 'Pro plan pricing in NPR'),
('ai_config', '{"model": "llama-3.3-70b-versatile", "temperature": 0.3}', 'AI model configuration'),
('maintenance_mode', '{"enabled": false, "message": ""}', 'Maintenance mode settings');
```

#### `audit_logs`
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### 1.2 Schema Modifications (Existing Tables)

#### Add `banned_at` to users table
```sql
ALTER TABLE users ADD COLUMN banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN banned_by INTEGER REFERENCES admin_users(id);
ALTER TABLE users ADD COLUMN ban_reason TEXT;
```

### 1.3 Entity Relationships

```
admin_users (standalone)
    |
    +-- audit_logs (1:N) -- admin actions
    +-- system_settings (updated_by)

users (existing)
    |
    +-- transactions (1:N) -- payment history
    +-- ai_usage_logs (1:N) -- AI request logs
    +-- subscriptions (1:1) -- existing
    +-- usage_daily (1:N) -- existing
    +-- products (1:N) -- existing
```

---

## 2. Backend Structure

### 2.1 Directory Structure

```
backend/src/
├── admin/
│   ├── middleware/
│   │   └── adminAuth.ts          # JWT auth for admin routes
│   ├── routes/
│   │   ├── adminAuth.ts          # POST /admin/auth/login
│   │   ├── adminUsers.ts         # /admin/users/*
│   │   ├── adminTransactions.ts  # /admin/transactions/*
│   │   ├── adminSubscriptions.ts # /admin/subscriptions/*
│   │   ├── adminAIUsage.ts       # /admin/ai-usage/*
│   │   ├── adminSettings.ts      # /admin/settings/*
│   │   └── adminDashboard.ts     # /admin/dashboard
│   ├── services/
│   │   ├── auditService.ts       # Audit log creation
│   │   └── analyticsService.ts   # Dashboard metrics
│   └── index.ts                  # Admin route aggregator
├── middleware/
│   ├── auth.ts                   # Existing seller auth
│   └── checkPlan.ts              # Existing
├── routes/
│   └── [existing routes]
└── app.ts                        # Add admin routes
```

### 2.2 File Responsibilities

| File | Responsibility |
|------|----------------|
| `adminAuth.ts` (middleware) | Verify admin JWT, attach adminId and role to request |
| `adminAuth.ts` (routes) | Admin login/refresh/logout, me, password+email change, create-admin (super_admin) |
| `adminUsers.ts` | List users, view user details, ban/unban users |
| `adminTransactions.ts` | List transactions, filter by status/date/user |
| `adminSubscriptions.ts` | View/modify user subscriptions, grant Pro access |
| `adminAIUsage.ts` | AI usage statistics, logs, cost tracking |
| `adminSettings.ts` | System configuration CRUD |
| `adminDashboard.ts` | Aggregated metrics for dashboard |
| `auditService.ts` | Create audit log entries for all admin actions |
| `analyticsService.ts` | Complex queries for dashboard stats |

### 2.3 Integration with Existing System

```typescript
// backend/src/app.ts - Add after existing routes

import adminRoutes from "./admin/index.js";

// Mount admin routes (separate from seller routes)
app.use("/api/admin", adminRoutes);
```

---

## 3. Admin Authentication System

### 3.1 Admin Auth Middleware

```typescript
// backend/src/admin/middleware/adminAuth.ts

import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface AdminRequest extends Request {
  adminId?: number;
  adminRole?: "admin" | "super_admin";
}

export function adminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Malformed authorization header" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ADMIN_JWT_SECRET!
    ) as { id: number; role: string; type: string };

    if (decoded.type !== "admin") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    req.adminId = decoded.id;
    req.adminRole = decoded.role as "admin" | "super_admin";
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Role-based access control
export function requireSuperAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  if (req.adminRole !== "super_admin") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}
```

### 3.2 Admin Login Flow

```
1. Admin submits email + password to POST /api/admin/auth/login
2. Server validates credentials against admin_users table
3. Server checks is_active = true
4. Server generates admin access token + refresh session
5. Server sets HttpOnly auth cookies + CSRF cookie
6. Server updates last_login_at and writes audit log
7. Frontend uses credentials: include and automatic refresh flow
```

### 3.3 JWT Strategy

| Property | Value |
|----------|-------|
| Secret | `ADMIN_JWT_SECRET` (separate from seller JWT_SECRET) |
| Algorithm | HS256 |
| Access token | Short-lived JWT in HttpOnly cookie |
| Refresh token | Rotating server-side session token in HttpOnly cookie |
| Payload | `{ id, role, type: "admin", iat, exp }` |

### 3.4 Environment Variables (New)

```
ADMIN_JWT_SECRET=<min 32 chars, different from JWT_SECRET>
```

---

## 4. Admin API Design

### 4.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/auth/login` | Admin login |
| POST | `/admin/auth/refresh` | Refresh token |
| POST | `/admin/auth/logout` | Logout and clear cookies |
| POST | `/admin/auth/change-password` | Change admin password |
| POST | `/admin/auth/change-email` | Change admin email (re-login required) |
| POST | `/admin/auth/create-admin` | Create new admin (super_admin only) |
| GET | `/admin/auth/me` | Get current admin info |

### 4.2 Users Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users (paginated, filterable) |
| GET | `/admin/users/:id` | Get user details with related data |
| PATCH | `/admin/users/:id/ban` | Ban user |
| PATCH | `/admin/users/:id/unban` | Unban user |
| GET | `/admin/users/:id/usage` | User's AI usage history |
| GET | `/admin/users/:id/transactions` | User's transaction history |

**Query Parameters for GET /admin/users:**
```
?page=1
&limit=20
&search=email or name
&status=active|banned
&plan=free|pro
&sort=created_at|name|email
&order=asc|desc
```

### 4.3 Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/transactions` | List all transactions |
| GET | `/admin/transactions/:id` | Transaction details |
| GET | `/admin/transactions/stats` | Transaction statistics |

**Query Parameters for GET /admin/transactions:**
```
?page=1
&limit=20
&status=pending|completed|failed|refunded
&type=subscription|refund|credit
&user_id=123
&from=2026-01-01
&to=2026-12-31
```

### 4.4 Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/subscriptions` | List all subscriptions |
| PATCH | `/admin/subscriptions/:userId` | Modify user subscription |
| POST | `/admin/subscriptions/:userId/grant-pro` | Grant Pro access |
| POST | `/admin/subscriptions/:userId/revoke-pro` | Revoke Pro access |

**PATCH /admin/subscriptions/:userId body:**
```json
{
  "plan": "pro",
  "expires_at": "2027-04-01T00:00:00Z",
  "reason": "Customer support grant"
}
```

### 4.5 AI Usage

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/ai-usage` | AI usage logs (paginated) |
| GET | `/admin/ai-usage/stats` | Aggregated AI statistics |
| GET | `/admin/ai-usage/costs` | Estimated cost breakdown |

**Response for GET /admin/ai-usage/stats:**
```json
{
  "today": {
    "total_requests": 1234,
    "successful": 1200,
    "failed": 34,
    "avg_latency_ms": 450,
    "total_input_tokens": 50000,
    "total_output_tokens": 75000
  },
  "last_7_days": { ... },
  "last_30_days": { ... }
}
```

### 4.6 Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/settings` | Get all settings |
| GET | `/admin/settings/:key` | Get specific setting |
| PATCH | `/admin/settings/:key` | Update setting (super_admin only) |

### 4.7 Dashboard Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Dashboard overview |
| GET | `/admin/dashboard/users` | User growth metrics |
| GET | `/admin/dashboard/revenue` | Revenue metrics |
| GET | `/admin/dashboard/ai` | AI usage metrics |

**Response for GET /admin/dashboard:**
```json
{
  "users": {
    "total": 1500,
    "active_today": 120,
    "new_this_week": 45,
    "banned": 3
  },
  "subscriptions": {
    "free": 1200,
    "pro_monthly": 250,
    "pro_yearly": 50,
    "mrr": 89700
  },
  "ai": {
    "requests_today": 2500,
    "requests_this_month": 45000,
    "avg_latency_ms": 420
  },
  "transactions": {
    "today": { "count": 5, "amount": 1495 },
    "this_month": { "count": 120, "amount": 38000 }
  }
}
```

### 4.8 Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/audit-logs` | List audit logs |

**Query Parameters:**
```
?admin_id=1
&action=user.ban
&entity_type=user
&from=2026-01-01
&to=2026-12-31
```

---

## 5. Controllers

### 5.1 adminAuthController

**Responsibility:** Handle admin authentication and session management

**Functions:**
- `login(email, password)` - Validate credentials, generate JWT
- `refreshToken(token)` - Issue new token if current is valid
- `changePassword(adminId, oldPassword, newPassword)` - Update password
- `getMe(adminId)` - Return current admin info

### 5.2 adminUserController

**Responsibility:** Manage seller/user accounts

**Functions:**
- `listUsers(filters, pagination)` - Paginated user list with filters
- `getUserById(userId)` - Full user details with subscription, usage, products count
- `banUser(adminId, userId, reason)` - Set banned_at, log action
- `unbanUser(adminId, userId)` - Clear banned_at, log action
- `getUserUsage(userId, dateRange)` - AI usage history for user
- `getUserTransactions(userId)` - Payment history for user

### 5.3 adminTransactionController

**Responsibility:** View and analyze payment transactions

**Functions:**
- `listTransactions(filters, pagination)` - Paginated transaction list
- `getTransactionById(transactionId)` - Full transaction details
- `getTransactionStats(dateRange)` - Revenue analytics

### 5.4 adminSubscriptionController

**Responsibility:** Manage user subscriptions

**Functions:**
- `listSubscriptions(filters)` - All subscriptions with user info
- `updateSubscription(userId, changes)` - Modify plan/expiry
- `grantPro(adminId, userId, duration, reason)` - Grant Pro access
- `revokePro(adminId, userId, reason)` - Revoke Pro access

### 5.5 adminAIController

**Responsibility:** Monitor AI usage and costs

**Functions:**
- `listUsageLogs(filters, pagination)` - Paginated AI logs
- `getUsageStats(dateRange)` - Aggregated statistics
- `getCostEstimate(dateRange)` - Estimated Groq API costs

### 5.6 adminSettingsController

**Responsibility:** System configuration management

**Functions:**
- `getAllSettings()` - Return all settings
- `getSetting(key)` - Return specific setting
- `updateSetting(adminId, key, value)` - Update setting, log change

### 5.7 adminAnalyticsController

**Responsibility:** Dashboard metrics and reporting

**Functions:**
- `getDashboardOverview()` - Combined metrics for dashboard
- `getUserGrowth(dateRange)` - User registration trends
- `getRevenueMetrics(dateRange)` - Revenue breakdown
- `getAIMetrics(dateRange)` - AI usage trends

---

## 6. Frontend Architecture

### 6.1 Directory Structure

```
web/src/
├── admin/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── Breadcrumb.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Toggle.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── EmptyState.tsx
│   │   └── data/
│   │       ├── DataTable.tsx
│   │       ├── Pagination.tsx
│   │       └── FilterBar.tsx
│   ├── context/
│   │   ├── AdminAuthContext.tsx
│   │   └── ToastContext.tsx
│   ├── hooks/
│   │   ├── useUsers.ts
│   │   ├── useTransactions.ts
│   │   ├── useSubscriptions.ts
│   │   ├── useAIUsage.ts
│   │   ├── useSettings.ts
│   │   └── useDashboard.ts
│   ├── pages/
│   │   ├── AdminLogin.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Users.tsx
│   │   ├── UserDetails.tsx
│   │   ├── Transactions.tsx
│   │   ├── Subscriptions.tsx
│   │   ├── AIUsage.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   └── adminApi.ts
│   ├── styles/
│   │   └── admin.css
│   └── AdminApp.tsx
├── pages/               # Existing seller pages
├── services/            # Existing
└── App.tsx              # Add admin route mounting
```

### 6.2 Route Structure

```typescript
// Admin routes (separate from seller app)
/admin/login          → AdminLogin
/admin/dashboard      → Dashboard
/admin/users          → Users
/admin/users/:id      → UserDetails
/admin/transactions   → Transactions
/admin/subscriptions  → Subscriptions
/admin/ai-usage       → AIUsage
/admin/settings       → Settings
```

### 6.3 Layout System

```
┌─────────────────────────────────────────────────────────┐
│ Topbar                                          [Admin] │
├────────────┬────────────────────────────────────────────┤
│            │ Breadcrumb: Dashboard > Users > User #123  │
│  Sidebar   ├────────────────────────────────────────────┤
│            │                                            │
│  Dashboard │  Page Content Area                         │
│  Users     │                                            │
│  Trans.    │  ┌─────────────────────────────────────┐   │
│  Subs.     │  │  Page-specific content              │   │
│  AI Usage  │  │                                     │   │
│  Settings  │  │                                     │   │
│            │  └─────────────────────────────────────┘   │
│            │                                            │
│  [Logout]  │                                            │
└────────────┴────────────────────────────────────────────┘
```

---

## 7. UI Component System

### 7.1 Design Tokens

```css
/* admin.css - Design System Variables */

:root {
  /* Spacing (8px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', Monaco, monospace;

  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 18px;
  --text-2xl: 20px;
  --text-3xl: 24px;

  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;

  /* Colors - Light Mode */
  --color-bg: #ffffff;
  --color-bg-subtle: #f9fafb;
  --color-bg-muted: #f3f4f6;
  --color-border: #e5e7eb;
  --color-border-subtle: #f3f4f6;

  --color-text: #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;

  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;

  --color-success: #059669;
  --color-success-bg: #d1fae5;
  --color-warning: #d97706;
  --color-warning-bg: #fef3c7;
  --color-error: #dc2626;
  --color-error-bg: #fee2e2;
  --color-info: #2563eb;
  --color-info-bg: #dbeafe;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Sidebar */
  --sidebar-width: 240px;
  --sidebar-collapsed-width: 64px;
  --topbar-height: 56px;
}

/* Dark Mode */
[data-theme="dark"] {
  --color-bg: #111827;
  --color-bg-subtle: #1f2937;
  --color-bg-muted: #374151;
  --color-border: #374151;
  --color-border-subtle: #1f2937;

  --color-text: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-muted: #9ca3af;
}
```

### 7.2 Component Specifications

#### Button

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}
```

**Styles:**
| Variant | Background | Text | Border |
|---------|------------|------|--------|
| primary | #2563eb | white | none |
| secondary | white | #374151 | #e5e7eb |
| danger | #dc2626 | white | none |
| ghost | transparent | #6b7280 | none |

#### Badge

```typescript
interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: ReactNode;
}
```

**Use Cases:**
| Status | Variant | Example |
|--------|---------|---------|
| active | success | User active |
| banned | error | User banned |
| pro | info | Pro subscriber |
| free | neutral | Free plan |
| pending | warning | Payment pending |
| failed | error | Payment failed |

#### DataTable

```typescript
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: ReactNode;
  sortable?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
}

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
}
```

**Features:**
- Column sorting (click header)
- Loading skeleton state
- Empty state message
- Row click handler
- Responsive overflow handling

#### Card

```typescript
interface CardProps {
  title?: string;
  subtitle?: string;
  value?: string | number;
  change?: { value: number; direction: 'up' | 'down' };
  icon?: ReactNode;
  children?: ReactNode;
}
```

**Variations:**
- Stat card (for dashboard metrics)
- Content card (for sections)

#### Modal

```typescript
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
```

**Confirmation Modal:**
```typescript
interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}
```

#### Toast

```typescript
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Usage via context
const { addToast } = useToast();
addToast({ type: 'success', title: 'User banned successfully' });
```

**Position:** Top-right, stacked
**Auto-dismiss:** 5 seconds (configurable)

#### Tabs

```typescript
interface TabsProps {
  tabs: { key: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (key: string) => void;
}
```

#### Input / Select / Toggle

```typescript
interface InputProps {
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password' | 'number';
}

interface SelectProps {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}
```

#### Skeleton

```typescript
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
}

// Table skeleton
<TableSkeleton rows={10} columns={5} />
```

#### EmptyState

```typescript
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

---

## 8. API Layer (Frontend)

### 8.1 Admin API Service

```typescript
// web/src/admin/services/adminApi.ts

const ADMIN_API_BASE = '/api/admin';

class AdminApiClient {
  private getToken(): string | null {
    return localStorage.getItem('admin_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; admin: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<{ admin: AdminUser }>('/auth/me');
  }

  // Users
  async getUsers(params: UserQueryParams) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<User>>(`/users?${query}`);
  }

  async getUser(id: number) {
    return this.request<UserDetails>(`/users/${id}`);
  }

  async banUser(id: number, reason: string) {
    return this.request(`/users/${id}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async unbanUser(id: number) {
    return this.request(`/users/${id}/unban`, { method: 'PATCH' });
  }

  // Transactions
  async getTransactions(params: TransactionQueryParams) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Transaction>>(`/transactions?${query}`);
  }

  // Subscriptions
  async updateSubscription(userId: number, data: SubscriptionUpdate) {
    return this.request(`/subscriptions/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async grantPro(userId: number, duration: string, reason: string) {
    return this.request(`/subscriptions/${userId}/grant-pro`, {
      method: 'POST',
      body: JSON.stringify({ duration, reason }),
    });
  }

  // AI Usage
  async getAIUsage(params: AIUsageQueryParams) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<AIUsageLog>>(`/ai-usage?${query}`);
  }

  async getAIUsageStats() {
    return this.request<AIUsageStats>('/ai-usage/stats');
  }

  // Settings
  async getSettings() {
    return this.request<SystemSettings[]>('/settings');
  }

  async updateSetting(key: string, value: any) {
    return this.request(`/settings/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  }

  // Dashboard
  async getDashboard() {
    return this.request<DashboardData>('/dashboard');
  }
}

export const adminApi = new AdminApiClient();
```

### 8.2 Custom Hooks

```typescript
// web/src/admin/hooks/useUsers.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';

export function useUsers(params: UserQueryParams) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminApi.getUsers(params),
    keepPreviousData: true,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => adminApi.getUser(id),
    enabled: !!id,
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      adminApi.banUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'users']);
    },
  });
}
```

```typescript
// web/src/admin/hooks/useDashboard.ts

export function useDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.getDashboard(),
    refetchInterval: 60000, // Refresh every minute
  });
}
```

```typescript
// web/src/admin/hooks/useSettings.ts

export function useSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings(),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      adminApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'settings']);
    },
  });
}
```

### 8.3 State Management

**Library:** TanStack Query (React Query)

**Query Key Structure:**
```
['admin', 'users']                    - User list
['admin', 'user', id]                 - Single user
['admin', 'transactions']             - Transaction list
['admin', 'subscriptions']            - Subscription list
['admin', 'ai-usage']                 - AI usage logs
['admin', 'ai-usage', 'stats']        - AI usage stats
['admin', 'settings']                 - System settings
['admin', 'dashboard']                - Dashboard data
```

**Cache Strategy:**
- Dashboard: 1 minute stale time, auto-refresh
- Users/Transactions: 30 seconds stale time
- Settings: 5 minutes stale time
- Invalidate on mutations

---

## 9. Security Requirements

### 9.1 Authentication

- Separate JWT secret for admin tokens (`ADMIN_JWT_SECRET`)
- Shorter token expiry (8 hours vs 7 days for sellers)
- Token type validation (`type: "admin"` in payload)
- Rate limiting on login endpoint (5 attempts per 15 minutes per IP)

### 9.2 Authorization

- All `/api/admin/*` routes protected by `adminAuth` middleware
- Role-based access for sensitive operations:
  - `admin`: View all, ban/unban users, view transactions
  - `super_admin`: All above + modify settings, grant Pro access

### 9.3 Audit Logging

Every admin action must create an audit log entry:

```typescript
await auditService.log({
  adminId: req.adminId,
  action: 'user.ban',
  entityType: 'user',
  entityId: userId,
  oldValue: { banned_at: null },
  newValue: { banned_at: new Date(), ban_reason: reason },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

**Actions to log:**
- user.ban, user.unban
- subscription.update, subscription.grant_pro, subscription.revoke_pro
- settings.update
- admin.login, admin.logout, admin.password_change

### 9.4 Input Validation

- Validate all inputs server-side
- Sanitize search queries
- Limit pagination (max 100 per page)
- Validate date ranges

### 9.5 CORS

- Admin API should have stricter CORS than seller API
- Whitelist specific admin frontend origin

---

## 10. Implementation Plan

### Phase 1: Database Setup (Day 1-2)

1. Create migration file: `admin_tables.sql`
2. Add all new tables (admin_users, transactions, ai_usage_logs, system_settings, audit_logs)
3. Add columns to users table (banned_at, banned_by, ban_reason)
4. Insert default system settings
5. Create first super_admin user manually

### Phase 2: Backend Auth (Day 2-3)

1. Create `backend/src/admin/` directory structure
2. Implement `adminAuth.ts` middleware
3. Implement `adminAuth.ts` routes (login, me, change-password)
4. Add `ADMIN_JWT_SECRET` to environment
5. Test login flow

### Phase 3: Backend APIs (Day 3-5)

1. Implement `auditService.ts`
2. Implement user management routes
3. Implement transaction routes
4. Implement subscription routes
5. Implement AI usage routes
6. Implement settings routes
7. Implement dashboard routes
8. Integrate audit logging into all write operations

### Phase 4: Frontend Setup (Day 5-6)

1. Create `web/src/admin/` directory structure
2. Implement `adminApi.ts`
3. Implement `AdminAuthContext.tsx`
4. Implement basic layout components (AdminLayout, Sidebar, Topbar)
5. Implement AdminLogin page
6. Add routing in App.tsx

### Phase 5: UI Components (Day 6-8)

1. Create design tokens (admin.css)
2. Implement Button, Input, Select, Toggle
3. Implement Badge, Card
4. Implement DataTable with pagination
5. Implement Modal, ConfirmModal
6. Implement Toast system
7. Implement Tabs
8. Implement Skeleton, EmptyState

### Phase 6: Pages (Day 8-12)

1. Dashboard page with stats cards and charts
2. Users page with DataTable, filters, pagination
3. UserDetails page with tabs (info, usage, transactions)
4. Transactions page
5. Subscriptions page
6. AIUsage page
7. Settings page

### Phase 7: Polish (Day 12-14)

1. Add loading states (skeletons)
2. Add empty states
3. Add error states
4. Add confirmation dialogs
5. Add toast notifications
6. Test all flows end-to-end
7. Dark mode implementation
8. Mobile responsive adjustments

### Phase 8: Security Hardening (Day 14-15)

1. Add rate limiting to admin login
2. Add input validation (Zod or similar)
3. Configure CORS for admin routes
4. Review audit log coverage
5. Security testing

---

## 11. File Checklist

### Backend Files to Create

```
[ ] backend/src/admin/index.ts
[ ] backend/src/admin/middleware/adminAuth.ts
[ ] backend/src/admin/routes/adminAuth.ts
[ ] backend/src/admin/routes/adminUsers.ts
[ ] backend/src/admin/routes/adminTransactions.ts
[ ] backend/src/admin/routes/adminSubscriptions.ts
[ ] backend/src/admin/routes/adminAIUsage.ts
[ ] backend/src/admin/routes/adminSettings.ts
[ ] backend/src/admin/routes/adminDashboard.ts
[ ] backend/src/admin/services/auditService.ts
[ ] backend/src/admin/services/analyticsService.ts
[ ] backend/src/migrations/admin_tables.sql
```

### Frontend Files to Create

```
[ ] web/src/admin/AdminApp.tsx
[ ] web/src/admin/context/AdminAuthContext.tsx
[ ] web/src/admin/context/ToastContext.tsx
[ ] web/src/admin/services/adminApi.ts
[ ] web/src/admin/styles/admin.css
[ ] web/src/admin/components/layout/AdminLayout.tsx
[ ] web/src/admin/components/layout/Sidebar.tsx
[ ] web/src/admin/components/layout/Topbar.tsx
[ ] web/src/admin/components/layout/Breadcrumb.tsx
[ ] web/src/admin/components/ui/Button.tsx
[ ] web/src/admin/components/ui/Input.tsx
[ ] web/src/admin/components/ui/Select.tsx
[ ] web/src/admin/components/ui/Toggle.tsx
[ ] web/src/admin/components/ui/Badge.tsx
[ ] web/src/admin/components/ui/Card.tsx
[ ] web/src/admin/components/ui/Modal.tsx
[ ] web/src/admin/components/ui/Toast.tsx
[ ] web/src/admin/components/ui/Tabs.tsx
[ ] web/src/admin/components/ui/Skeleton.tsx
[ ] web/src/admin/components/ui/EmptyState.tsx
[ ] web/src/admin/components/data/DataTable.tsx
[ ] web/src/admin/components/data/Pagination.tsx
[ ] web/src/admin/components/data/FilterBar.tsx
[ ] web/src/admin/hooks/useUsers.ts
[ ] web/src/admin/hooks/useTransactions.ts
[ ] web/src/admin/hooks/useSubscriptions.ts
[ ] web/src/admin/hooks/useAIUsage.ts
[ ] web/src/admin/hooks/useSettings.ts
[ ] web/src/admin/hooks/useDashboard.ts
[ ] web/src/admin/pages/AdminLogin.tsx
[ ] web/src/admin/pages/Dashboard.tsx
[ ] web/src/admin/pages/Users.tsx
[ ] web/src/admin/pages/UserDetails.tsx
[ ] web/src/admin/pages/Transactions.tsx
[ ] web/src/admin/pages/Subscriptions.tsx
[ ] web/src/admin/pages/AIUsage.tsx
[ ] web/src/admin/pages/Settings.tsx
```

### Files to Modify

```
[ ] backend/src/app.ts (add admin routes)
[ ] web/src/App.tsx (add admin route mounting)
[ ] .env (add ADMIN_JWT_SECRET)
```

---

## 12. Dependencies to Add

### Backend

```json
{
  "dependencies": {
    "express-rate-limit": "^7.x"  // Already may exist
  }
}
```

### Frontend

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "lucide-react": "^0.x"
  }
}
```

---

**End of Specification**
