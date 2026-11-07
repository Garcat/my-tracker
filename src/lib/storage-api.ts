/**
 * API 客户端 - 调用服务器端 API 进行数据存储
 * 真正的服务器端持久化方案
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

import { TrackingResult } from '@/types/tracking';

interface SharedData {
  inputs: string[];
  results?: (TrackingResult | null)[];
  lastUpdated: number;
  version: number;
  lastTrackingFetchAt: number | null;
}

export interface SharedTrackingState {
  inputs: string[];
  results: (TrackingResult | null)[];
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

// 加载共享数据（单号列表 + 查询结果 + 最后拉取时间）
export async function loadSharedTrackingState(): Promise<SharedTrackingState> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`);

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
      results: Array.isArray(data.results) ? data.results : [],
      lastTrackingFetchAt: fetchAt,
    };
  } catch (error) {
    console.error('Failed to load from API:', error);
    const fallback = loadFallbackState();
    return {
      inputs: fallback.inputs,
      results: fallback.results,
      lastTrackingFetchAt: fallback.lastTrackingFetchAt,
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
    const response = await fetch(`${API_BASE_URL}/api/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // 同时保存到本地作为缓存（保留已有查询结果）
    saveToLocalStorage(inputs, result.version);

    console.log('Data saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save via API:', error);
    // 降级到本地存储
    saveToLocalStorage(inputs);
  }
}

// 保存查询结果（与 inputs 按下标对齐）
export async function saveSharedResults(results: (TrackingResult | null)[]): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ results }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    saveResultsToLocalStorage(results, result.version);

    console.log('Results saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save results via API:', error);
    saveResultsToLocalStorage(results);
  }
}

// 原子保存一次查询快照：同时写入 results 和 lastTrackingFetchAt，
// 避免与单独的时间/结果 PUT 并发时发生读-改-写覆盖丢失。
export async function saveTrackingSnapshot(
  results: (TrackingResult | null)[],
  timestamp: number,
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ results, lastTrackingFetchAt: timestamp }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    localStorage.setItem('lastTrackingFetchAt', String(timestamp));
    saveResultsToLocalStorage(results, result.version, timestamp);

    console.log('Tracking snapshot saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save tracking snapshot via API:', error);
    localStorage.setItem('lastTrackingFetchAt', String(timestamp));
    saveResultsToLocalStorage(results, undefined, timestamp);
  }
}

/** 将「最后成功拉取物流」时间同步到服务器 */
export async function saveLastTrackingFetchAt(timestamp: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
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

function readFallbackResults(): (TrackingResult | null)[] {
  try {
    const stored = localStorage.getItem('shared-api-fallback');
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as { results?: unknown };
    return Array.isArray(parsed.results)
      ? (parsed.results as (TrackingResult | null)[])
      : [];
  } catch {
    return [];
  }
}

// 从本地降级缓存读取完整状态
function loadFallbackState(): SharedTrackingState {
  return {
    inputs: loadFromLocalStorage(),
    results: readFallbackResults(),
    lastTrackingFetchAt: readFallbackLastFetchMs(),
  };
}

// 读取已有降级缓存的根对象（失败时返回空对象）
function readFallbackRaw(): Record<string, unknown> {
  try {
    const prevRaw = localStorage.getItem('shared-api-fallback');
    return prevRaw ? (JSON.parse(prevRaw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// 解析最后拉取时间（优先降级缓存，兼容旧字段）
function resolveLastFetchMs(prev: Record<string, unknown>): number | null {
  const raw = prev.lastTrackingFetchAt;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return readLegacyLastFetchMs();
}

function saveToLocalStorage(inputs: string[], version?: number): void {
  try {
    const prev = readFallbackRaw();
    const payload: Record<string, unknown> = {
      ...prev,
      inputs,
      version: version || Date.now(),
      cached: true,
    };
    const lastTrackingFetchAt = resolveLastFetchMs(prev);
    if (lastTrackingFetchAt !== null) {
      payload.lastTrackingFetchAt = lastTrackingFetchAt;
    }
    localStorage.setItem('shared-api-fallback', JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

function saveResultsToLocalStorage(
  results: (TrackingResult | null)[],
  version?: number,
  timestamp?: number,
): void {
  try {
    const prev = readFallbackRaw();
    const payload: Record<string, unknown> = {
      ...prev,
      results,
      version: version || Date.now(),
      cached: true,
    };
    const lastTrackingFetchAt = timestamp ?? resolveLastFetchMs(prev);
    if (lastTrackingFetchAt !== null) {
      payload.lastTrackingFetchAt = lastTrackingFetchAt;
    }
    localStorage.setItem('shared-api-fallback', JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save results to localStorage:', error);
  }
}

// 获取存储状态（调试用）
export async function getStoreStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`);
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
1. 设置环境变量：NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
2. 确保 API 路由存在：src/app/api/shared-data/route.ts
3. 支持版本控制和并发检测
4. 自动降级到本地存储

优点：
- 真正的服务器端持久化
- 支持多实例部署
- 版本控制和并发安全
- 自动降级机制

缺点：
- 需要服务器运行
- API 调用有网络延迟
*/
