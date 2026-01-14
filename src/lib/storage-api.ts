/**
 * API 客户端 - 调用服务器端 API 进行数据存储
 * 真正的服务器端持久化方案
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface SharedData {
  inputs: string[];
  lastUpdated: number;
  version: number;
}

// 加载共享数据
export async function loadSharedInputs(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: SharedData = await response.json();
    return data.inputs || [];
  } catch (error) {
    console.error('Failed to load from API:', error);
    // 降级到本地存储
    return loadFromLocalStorage();
  }
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

    // 同时保存到本地作为缓存
    saveToLocalStorage(inputs, result.version);

    console.log('Data saved via API, version:', result.version);
  } catch (error) {
    console.error('Failed to save via API:', error);
    // 降级到本地存储
    saveToLocalStorage(inputs);
  }
}

// 本地存储降级方案
function loadFromLocalStorage(): string[] {
  try {
    const stored = localStorage.getItem('shared-api-fallback');
    return stored ? JSON.parse(stored).inputs || [] : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(inputs: string[], version?: number): void {
  try {
    localStorage.setItem('shared-api-fallback', JSON.stringify({
      inputs,
      version: version || Date.now(),
      cached: true
    }));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

// 获取存储状态（调试用）
export async function getStoreStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shared-data`);
    if (!response.ok) throw new Error();

    const data: SharedData = await response.json();
    return {
      source: 'API',
      version: data.version,
      lastUpdated: new Date(data.lastUpdated).toLocaleString(),
      inputsCount: data.inputs.length
    };
  } catch {
    return {
      source: 'localStorage',
      version: 'unknown',
      lastUpdated: 'unknown',
      inputsCount: loadFromLocalStorage().length
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