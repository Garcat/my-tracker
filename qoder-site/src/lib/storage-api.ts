/**
 * API 客户端 - 调用服务器端 API 进行数据存储
 * 真正的服务器端持久化方案
 */

import { authHeaders } from '@/lib/auth-api';

const FUNCTION_BASE = '/functions/v1/app';

interface SharedData {
  inputs: string[];
  lastUpdated: number;
  version: number;
  lastTrackingFetchAt: number | null;
}

export interface SharedTrackingState {
  inputs: string[];
  lastTrackingFetchAt: number | null;
}

function readLegacyLastFetchMs(): number | null {
  try {
    const legacy = localStorage.getItem('lastTrackingFetchAt');
    if (!legacy) {
      return null;
    }
    const n = parseInt(legacy, 10);
    return !Number.isNaN(n) ? n : null;
  } catch {
    return null;
  }
}

function readFallbackLastFetchMs(): number | null {
  try {
    const stored = localStorage.getItem('shared-api-fallback');
    if (!stored) {
      return readLegacyLastFetchMs();
    }
    const parsed = JSON.parse(stored) as { lastTrackingFetchAt?: unknown };
    const raw = parsed.lastTrackingFetchAt;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    return readLegacyLastFetchMs();
  } catch {
    return readLegacyLastFetchMs();
  }
}

// 加载共享数据（单号列表 + 最后拉取时间）
export async function loadSharedTrackingState(): Promise<SharedTrackingState> {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: SharedData = await response.json();
    const fetchAt =
      typeof data.lastTrackingFetchAt === 'number' && Number.isFinite(data.lastTrackingFetchAt)
        ? data.lastTrackingFetchAt
        : null;
    return {
      inputs: data.inputs || [],
      lastTrackingFetchAt: fetchAt,
    };
  } catch (error) {
    console.error('Failed to load from API:', error);
    return {
      inputs: loadFromLocalStorage(),
      lastTrackingFetchAt: readFallbackLastFetchMs(),
    };
  }
}

// 加载共享数据（仅单号列表，兼容旧调用）
export async function loadSharedInputs(): Promise<string[]> {
  const state = await loadSharedTrackingState();
  return state.inputs;
}

// 保存共享数据
export async function saveSharedInputs(inputs: string[]): Promise<void> {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ inputs }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // 同时保存到本地作为缓存
    saveToLocalStorage(inputs, result.version);

    console.log('Data saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save via API:', error);
    // 降级到本地存储
    saveToLocalStorage(inputs);
  }
}

/** 将「最后成功拉取物流」时间同步到服务器 */
export async function saveLastTrackingFetchAt(timestamp: number): Promise<void> {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ lastTrackingFetchAt: timestamp }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    localStorage.setItem('lastTrackingFetchAt', String(timestamp));
    try {
      const prevRaw = localStorage.getItem('shared-api-fallback');
      const prev = prevRaw ? (JSON.parse(prevRaw) as Record<string, unknown>) : {};
      localStorage.setItem(
        'shared-api-fallback',
        JSON.stringify({
          ...prev,
          lastTrackingFetchAt: timestamp,
          version: result.version,
          cached: true,
        }),
      );
    } catch {
      // ignore
    }
    console.log('Last fetch time saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save last fetch time via API:', error);
    localStorage.setItem('lastTrackingFetchAt', String(timestamp));
    try {
      const prevRaw = localStorage.getItem('shared-api-fallback');
      const prev = prevRaw ? (JSON.parse(prevRaw) as Record<string, unknown>) : {};
      localStorage.setItem(
        'shared-api-fallback',
        JSON.stringify({
          ...prev,
          lastTrackingFetchAt: timestamp,
          cached: true,
        }),
      );
    } catch {
      // ignore
    }
  }
}

// 本地存储降级方案
function loadFromLocalStorage(): string[] {
  try {
    const stored = localStorage.getItem('shared-api-fallback');
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as { inputs?: unknown };
    return Array.isArray(parsed.inputs) ? parsed.inputs : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(inputs: string[], version?: number): void {
  try {
    const prevRaw = localStorage.getItem('shared-api-fallback');
    let lastTrackingFetchAt: number | null = null;
    if (prevRaw) {
      try {
        const p = JSON.parse(prevRaw) as { lastTrackingFetchAt?: unknown };
        if (typeof p.lastTrackingFetchAt === 'number' && Number.isFinite(p.lastTrackingFetchAt)) {
          lastTrackingFetchAt = p.lastTrackingFetchAt;
        }
      } catch {
        // ignore
      }
    }
    if (lastTrackingFetchAt === null) {
      lastTrackingFetchAt = readLegacyLastFetchMs();
    }
    const payload: {
      inputs: string[];
      version: number;
      cached: boolean;
      lastTrackingFetchAt?: number;
    } = {
      inputs,
      version: version || Date.now(),
      cached: true,
    };
    if (lastTrackingFetchAt !== null) {
      payload.lastTrackingFetchAt = lastTrackingFetchAt;
    }
    localStorage.setItem('shared-api-fallback', JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

// 获取存储状态（调试用）
export async function getStoreStatus() {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) {
      throw new Error();
    }

    const data: SharedData = await response.json();
    return {
      source: 'API',
      version: data.version,
      lastUpdated: new Date(data.lastUpdated).toLocaleString(),
      lastTrackingFetchAt:
        typeof data.lastTrackingFetchAt === 'number'
          ? new Date(data.lastTrackingFetchAt).toLocaleString()
          : null,
      inputsCount: data.inputs.length,
    };
  } catch {
    return {
      source: 'localStorage',
      version: 'unknown',
      lastUpdated: 'unknown',
      lastTrackingFetchAt: 'unknown',
      inputsCount: loadFromLocalStorage().length,
    };
  }
}

/*
使用说明：
1. 共享数据由 Qoder Sites 的 Edge Function 提供：/functions/v1/app/shared-data
2. 数据持久化在站点数据库的 app.tracker_state 表中
3. 支持版本号与最后拉取时间
4. Function 不可用时自动降级到 localStorage
*/
