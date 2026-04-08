const ADMIN_API_BASE = '/api/admin';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  last_login_at?: string;
  created_at?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  banned_at?: string;
  ban_reason?: string;
  plan?: string;
  subscription_status?: string;
  expires_at?: string;
  product_count?: number;
  total_replies?: number;
}

export interface UserDetails {
  user: User & {
    banned_by?: number;
    billing?: string;
    started_at?: string;
  };
  stats: {
    product_count: number;
    total_replies: number;
    replies_today: number;
    replies_this_week: number;
  };
  recent_transactions: Transaction[];
}

export interface Transaction {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  payment_ref?: string;
  metadata?: any;
  created_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  plan: string;
  billing: string;
  status: string;
  started_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface AIUsageLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  request_type: string;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms?: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: any;
  description?: string;
  updated_at?: string;
}

export interface DashboardData {
  users: {
    total: number;
    active: number;
    banned: number;
    new_today: number;
    new_this_week: number;
  };
  subscriptions: {
    free: number;
    pro_monthly: number;
    pro_yearly: number;
    mrr: number;
  };
  ai: {
    requests_today: number;
    requests_this_month: number;
    avg_latency_ms: number;
  };
  transactions: {
    today: { count: number; amount: number };
    this_month: { count: number; amount: number };
  };
}

export interface CreateAdminPayload {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'super_admin';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class AdminApiClient {
  private getCsrfToken(): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const match = document.cookie.match(/(?:^|; )sia_csrf=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private isSafeMethod(method: string): boolean {
    const normalized = method.toUpperCase();
    return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
  }

  private shouldAttemptRefresh(endpoint: string): boolean {
    const excluded = ['/auth/login', '/auth/refresh', '/auth/logout'];
    return !excluded.some((path) => endpoint.startsWith(path));
  }

  private async refreshSession(): Promise<boolean> {
    try {
      const response = await fetch(`${ADMIN_API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuthRedirect: boolean = false,
    allowRetry: boolean = true
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const csrfToken = this.getCsrfToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (!this.isSafeMethod(method) && csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (
      response.status === 401 &&
      !skipAuthRedirect &&
      allowRetry &&
      this.shouldAttemptRefresh(endpoint)
    ) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        return this.request<T>(endpoint, options, skipAuthRedirect, false);
      }
    }

    // Handle 401 after refresh attempt - but not for login endpoint
    if (response.status === 401 && !skipAuthRedirect) {
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth - skip auth redirect for login since 401 means invalid credentials
  async login(email: string, password: string) {
    return this.request<{ admin: AdminUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      true // skipAuthRedirect - 401 here means invalid credentials, not session expired
    );
  }

  async getMe(skipAuthRedirect: boolean = false) {
    return this.request<{ admin: AdminUser }>('/auth/me', {}, skipAuthRedirect);
  }

  async logout() {
    return this.request<{ message: string }>(
      '/auth/logout',
      { method: 'POST' },
      true
    );
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  }

  async changeEmail(currentPassword: string, newEmail: string) {
    return this.request<{ message: string }>('/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newEmail }),
    });
  }

  async createAdminUser(payload: CreateAdminPayload) {
    return this.request<{ message: string; admin: AdminUser }>('/auth/create-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Users
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    plan?: string;
    sort?: string;
    order?: string;
  } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request<PaginatedResponse<User>>(`/users${query ? `?${query}` : ''}`);
  }

  async getUser(id: number) {
    return this.request<UserDetails>(`/users/${id}`);
  }

  async banUser(id: number, reason?: string) {
    return this.request<{ message: string }>(`/users/${id}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async unbanUser(id: number) {
    return this.request<{ message: string }>(`/users/${id}/unban`, {
      method: 'PATCH',
    });
  }

  async getUserUsage(id: number, days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{ data: { date: string; reply_count: number }[] }>(
      `/users/${id}/usage${query}`
    );
  }

  async getUserTransactions(id: number) {
    return this.request<{ data: Transaction[] }>(`/users/${id}/transactions`);
  }

  // Transactions
  async getTransactions(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    user_id?: number;
    from?: string;
    to?: string;
  } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request<PaginatedResponse<Transaction>>(
      `/transactions${query ? `?${query}` : ''}`
    );
  }

  async getTransactionStats() {
    return this.request<any>('/transactions/stats');
  }

  async approveTransaction(id: number, reason?: string) {
    return this.request<{ message: string; transaction: Transaction; subscription: Subscription }>(
      `/transactions/${id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }

  async rejectTransaction(id: number, reason: string) {
    return this.request<{ message: string; transaction: Transaction }>(
      `/transactions/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }

  // Subscriptions
  async getSubscriptions(params: {
    page?: number;
    limit?: number;
    plan?: string;
    status?: string;
  } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request<PaginatedResponse<Subscription>>(
      `/subscriptions${query ? `?${query}` : ''}`
    );
  }

  async updateSubscription(userId: number, data: {
    plan?: string;
    billing?: string;
    status?: string;
    expires_at?: string;
    reason?: string;
  }) {
    return this.request<{ subscription: Subscription }>(`/subscriptions/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async grantPro(userId: number, duration: string, reason?: string) {
    return this.request<{ message: string; subscription: Subscription }>(
      `/subscriptions/${userId}/grant-pro`,
      {
        method: 'POST',
        body: JSON.stringify({ duration, reason }),
      }
    );
  }

  async revokePro(userId: number, reason?: string) {
    return this.request<{ message: string; subscription: Subscription }>(
      `/subscriptions/${userId}/revoke-pro`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }

  // AI Usage
  async getAIUsage(params: {
    page?: number;
    limit?: number;
    user_id?: number;
    status?: string;
    request_type?: string;
    from?: string;
    to?: string;
  } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request<PaginatedResponse<AIUsageLog>>(
      `/ai-usage${query ? `?${query}` : ''}`
    );
  }

  async getAIUsageStats() {
    return this.request<any>('/ai-usage/stats');
  }

  async getAIUsageCosts() {
    return this.request<any>('/ai-usage/costs');
  }

  // Settings
  async getSettings() {
    return this.request<{ settings: SystemSetting[] }>('/settings');
  }

  async updateSetting(key: string, value: any) {
    return this.request<{ message: string }>(`/settings/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  }

  // Dashboard
  async getDashboard() {
    return this.request<DashboardData>('/dashboard');
  }

  async getUserGrowth(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{ data: { date: string; count: number }[] }>(
      `/dashboard/users${query}`
    );
  }

  async getRevenueMetrics(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{ data: { date: string; amount: number; count: number }[] }>(
      `/dashboard/revenue${query}`
    );
  }

  async getAIMetrics(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{ data: { date: string; total_requests: number }[] }>(
      `/dashboard/ai${query}`
    );
  }

  // Audit Logs
  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    admin_id?: number;
    action?: string;
    entity_type?: string;
    from?: string;
    to?: string;
  } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request<PaginatedResponse<any>>(
      `/dashboard/audit-logs${query ? `?${query}` : ''}`
    );
  }
}

export const adminApi = new AdminApiClient();
