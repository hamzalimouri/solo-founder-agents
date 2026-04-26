const TOKEN_KEY = 'sf_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  login: (password: string) =>
    request<{ token: string; expiresAt: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  analytics: {
    overview: (days = 7) => request<OverviewData>(`/api/analytics/overview?days=${days}`),
    agents: (days = 7) => request<AgentStat[]>(`/api/analytics/agents?days=${days}`),
  },

  conversations: {
    list: () => request<ConvSummary[]>('/api/conversations'),
    get: (agentKey: string) => request<ConvDetail>(`/api/conversations/${agentKey}`),
    clear: (agentKey: string) =>
      request<{ cleared: boolean }>(`/api/conversations/${agentKey}`, { method: 'DELETE' }),
  },

  drafts: {
    list: (params?: { type?: string; status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set('type', params.type);
      if (params?.status) q.set('status', params.status);
      if (params?.limit) q.set('limit', String(params.limit));
      return request<DraftSummary[]>(`/api/drafts?${q}`);
    },
    get: (id: string) => request<DraftFull>(`/api/drafts/${id}`),
    update: (id: string, data: Partial<DraftFull>) =>
      request<{ updated: boolean }>(`/api/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/drafts/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    list: (status?: string) => request<Task[]>(`/api/tasks${status ? `?status=${status}` : ''}`),
  },

  settings: {
    get: () => request<Settings>('/api/settings'),
    update: (data: Partial<Settings>) =>
      request<{ updated: boolean }>('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    clearConversations: () => request('/api/settings/clear-conversations', { method: 'POST' }),
    clearDrafts: () => request('/api/settings/clear-drafts', { method: 'POST' }),
    resetSpend: () => request('/api/settings/reset-spend', { method: 'POST' }),
  },
};

// SSE streaming chat
export async function streamChat(
  message: string,
  agentKey: string | null,
  callbacks: {
    onAgent: (a: { key: string; name: string; emoji: string }) => void;
    onText: (t: string) => void;
    onToolStart: (tool: string) => void;
    onDone: (u: { inputTokens: number; outputTokens: number; cost: number }) => void;
    onError: (e: string) => void;
  },
) {
  const token = getToken();
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, agentKey }),
  });

  if (!res.ok || !res.body) {
    callbacks.onError(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        switch (data.type) {
          case 'agent': callbacks.onAgent(data.agent); break;
          case 'text': callbacks.onText(data.text); break;
          case 'tool_start': callbacks.onToolStart(data.tool); break;
          case 'done': callbacks.onDone(data.usage); break;
          case 'error': callbacks.onError(data.message); break;
        }
      } catch { /* ignore parse errors */ }
    }
  }
}

// Types
export interface OverviewData {
  totalSpend: number; totalRequests: number; totalTokens: number;
  averageCostPerRequest: number; yesterdaySpend: number; yesterdayRequests: number;
  spendByDay: { date: string; cost: number; requests: number; tokens: number }[];
  spendByAgent: { agent_key: string; name: string; emoji: string; cost: number; requests: number; tokens: number }[];
  topQueries: { user_message: string; agent_key: string; cost_usd: number; created_at: string }[];
}
export interface AgentStat {
  key: string; name: string; emoji: string;
  totalRequests: number; totalCost: number; totalTokens: number;
  avgInputTokens: number; avgOutputTokens: number; avgDurationMs: number; avgCostPerRequest: number;
  dailyUsage: { date: string; requests: number }[];
  topQueries: { message: string; cost: number }[];
}
export interface ConvSummary {
  id: string; agentKey: string; agentName: string; agentEmoji: string;
  messageCount: number; lastMessage: string; updatedAt: string;
}
export interface ConvDetail {
  agentKey: string; agentName: string; agentEmoji: string;
  messages: { role: string; content: string; timestamp?: string }[];
}
export interface DraftSummary {
  id: string; title: string; contentType: string; status: string | null;
  tags: string | null; createdAt: string | null; preview: string;
  agentKey: string;
}
export interface DraftFull extends DraftSummary { content: string; }
export interface Task {
  id: string; agentKey: string; message: string; status: string | null;
  createdAt: string | null; result?: string | null;
}
export interface Settings {
  businessName: string; businessDesc: string; targetAudience: string;
  productUrl: string; dailyBudget: number; todaySpend: number;
}
