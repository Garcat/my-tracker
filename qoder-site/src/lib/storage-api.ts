/**
 * API 客户端 - 调用站点 Function 进行数据存储
 * 数据持久化在 Qoder Sites 数据库的 app.tracker_state 表中
 */

import { authHeaders } from '@/lib/auth-api';
import { ParcelMap, TrackingResult } from '@/types/tracking';

const FUNCTION_BASE = '/functions/v1/app';

interface SharedData {
  inputs: string[];
  results?: (TrackingResult | null)[];
  parcels?: ParcelMap;
  lastUpdated: number;
  version: number;
  lastTrackingFetchAt: number | null;
}

export interface SharedTrackingState {
  inputs: string[];
  results: (TrackingResult | null)[];
  parcels: ParcelMap;
  lastTrackingFetchAt: number | null;
}

function normalizeParcelMap(value: unknown): ParcelMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const parcels: ParcelMap = {};
  for (const [code, parcel] of Object.entries(value)) {
    if (
      typeof code === 'string' &&
      code &&
      parcel &&
      typeof parcel === 'object' &&
      !Array.isArray(parcel)
    ) {
      parcels[code] = parcel as ParcelMap[string];
    }
  }
  return parcels;
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
      results: Array.isArray(data.results) ? data.results : [],
      parcels: normalizeParcelMap(data.parcels),
      lastTrackingFetchAt: fetchAt,
    };
  } catch (error) {
    console.error('Failed to load from API:', error);
    const fallback = loadFallbackState();
    return {
      inputs: fallback.inputs,
      results: fallback.results,
      parcels: fallback.parcels,
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
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
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

// 合并保存单号列表与查询结果：一次 PUT 写入两者，
// 避免两次写入之间出现 inputs 与 results 下标错位的中间态。
export async function saveSharedState(
  inputs: string[],
  results: (TrackingResult | null)[],
): Promise<void> {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ inputs, results }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    saveStateToLocalStorage(inputs, results, result.version);

    console.log('Shared state saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save shared state via API:', error);
    saveStateToLocalStorage(inputs, results);
  }
}

// 保存单个/多个运单的包裹信息：后端按运单号合并，
// 并只保留仍存在于当前 inputs 中的运单。返回是否成功。
export async function saveParcels(parcels: ParcelMap): Promise<boolean> {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ parcels }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    try {
      const prev = readFallbackRaw();
      const merged = {
        ...normalizeParcelMap(prev.parcels),
        ...parcels,
      };
      localStorage.setItem(
        'shared-api-fallback',
        JSON.stringify({
          ...prev,
          parcels: merged,
          version: result.version,
          cached: true,
        }),
      );
    } catch {
      // ignore cache failures
    }
    return true;
  } catch (error) {
    console.error('Failed to save parcels via API:', error);
    return false;
  }
}

// 原子保存一次查询快照：同时写入 inputs、results 和 lastTrackingFetchAt，
// 一次 PUT 落库，避免多次读-改-写相互覆盖。
export async function saveTrackingSnapshot(
  inputs: string[],
  results: (TrackingResult | null)[],
  timestamp: number,
): Promise<void> {
  try {
    const response = await fetch(`${FUNCTION_BASE}/shared-data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ inputs, results, lastTrackingFetchAt: timestamp }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    localStorage.setItem('lastTrackingFetchAt', String(timestamp));
    saveStateToLocalStorage(inputs, results, result.version, timestamp);

    console.log('Tracking snapshot saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save tracking snapshot via API:', error);
    localStorage.setItem('lastTrackingFetchAt', String(timestamp));
    saveStateToLocalStorage(inputs, results, undefined, timestamp);
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
  const prev = readFallbackRaw();
  return {
    inputs: loadFromLocalStorage(),
    results: readFallbackResults(),
    parcels: normalizeParcelMap(prev.parcels),
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

// 本地缓存一次写入 inputs 与 results，保证降级数据也是对齐的
function saveStateToLocalStorage(
  inputs: string[],
  results: (TrackingResult | null)[],
  version?: number,
  timestamp?: number,
): void {
  try {
    const prev = readFallbackRaw();
    const payload: Record<string, unknown> = {
      ...prev,
      inputs,
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
    console.error('Failed to save state to localStorage:', error);
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
      resultsCount: Array.isArray(data.results) ? data.results.length : 0,
    };
  } catch {
    return {
      source: 'localStorage',
      version: 'unknown',
      lastUpdated: 'unknown',
      lastTrackingFetchAt: 'unknown',
      inputsCount: loadFromLocalStorage().length,
      resultsCount: readFallbackResults().length,
    };
  }
}
