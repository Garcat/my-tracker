/**
 * Next.js API Route - 服务器端共享数据存储
 * 灵活存储策略：支持文件系统和 Vercel KV
 * - 本地开发：默认文件系统，可通过 USE_KV_STORAGE=true 切换到 KV
 * - Vercel 部署：自动使用 KV
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from 'redis';

// 检测存储策略
// 优先级：USE_KV_STORAGE > VERCEL 环境检测
const useKVStorage = process.env.USE_KV_STORAGE === 'true';
const isVercelEnvironment = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const shouldUseKV = useKVStorage || isVercelEnvironment;

const SHARED_KEY = 'shared-tracking-data';

// 创建 Redis 客户端（如果使用 KV 存储）
let redisClient: ReturnType<typeof createClient> | null = null;

function getRedisClient() {
  if (!redisClient && shouldUseKV && process.env.KV_REDIS_URL) {
    redisClient = createClient({
      url: process.env.KV_REDIS_URL
    });

    // 连接事件处理
    redisClient.on('error', (err: unknown) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
  }
  return redisClient;
}
// 数据类型定义
interface SharedTrackingData {
  inputs: string[];
  lastUpdated: number;
  version: number;
  /** 最近一次 Submit 成功拉取物流的时间戳（毫秒） */
  lastTrackingFetchAt: number | null;
}

// 默认数据结构
const DEFAULT_DATA: SharedTrackingData = {
  inputs: [],
  lastUpdated: Date.now(),
  version: 1,
  lastTrackingFetchAt: null,
};

function normalizeSharedData(raw: unknown): SharedTrackingData {
  const d = raw as Partial<SharedTrackingData>;
  const fetchAt = d.lastTrackingFetchAt;
  return {
    inputs: Array.isArray(d.inputs) ? d.inputs : [],
    lastUpdated: typeof d.lastUpdated === 'number' ? d.lastUpdated : Date.now(),
    version: typeof d.version === 'number' ? d.version : 1,
    lastTrackingFetchAt:
      typeof fetchAt === 'number' && Number.isFinite(fetchAt) ? fetchAt : null,
  };
}

// 加载共享数据
async function loadSharedData(): Promise<SharedTrackingData> {
  if (shouldUseKV) {
    // 使用 Redis 客户端连接到 Vercel KV
    try {
      const client = getRedisClient();
      if (!client) {
        throw new Error('Redis client not available');
      }

      // 确保连接
      if (!client.isOpen) {
        await client.connect();
      }

      const data = await client.get(SHARED_KEY);
      return data ? normalizeSharedData(JSON.parse(data)) : DEFAULT_DATA;
    } catch (error) {
      console.error('Failed to load from Redis KV:', error);
      return DEFAULT_DATA;
    }
  } else {
    // 本地开发环境：使用文件系统
    try {
      const filePath = path.join(process.cwd(), 'data', 'shared-tracking.json');
      const fileContents = await fs.readFile(filePath, 'utf8');
      return normalizeSharedData(JSON.parse(fileContents));
    } catch (error) {
      console.error('Failed to load from file:', error);
      return DEFAULT_DATA;
    }
  }
}

// 保存共享数据
async function saveSharedData(data: SharedTrackingData): Promise<boolean> {
  if (shouldUseKV) {
    // 使用 Redis 客户端连接到 Vercel KV
    try {
      const client = getRedisClient();
      if (!client) {
        throw new Error('Redis client not available');
      }

      // 确保连接
      if (!client.isOpen) {
        await client.connect();
      }

      await client.set(SHARED_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save to Redis KV:', error);
      return false;
    }
  } else {
    // 本地开发环境：使用文件系统
    try {
      const filePath = path.join(process.cwd(), 'data', 'shared-tracking.json');
      const dirPath = path.dirname(filePath);

      // 确保目录存在
      await fs.mkdir(dirPath, { recursive: true });

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save to file:', error);
      return false;
    }
  }
}

// GET - 加载共享数据
export async function GET() {
  try {
    const data = await loadSharedData();

    return NextResponse.json({
      inputs: data.inputs || [],
      lastUpdated: data.lastUpdated,
      version: data.version,
      lastTrackingFetchAt: data.lastTrackingFetchAt,
    });
  } catch (error) {
    console.error('Failed to load shared data:', error);
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    );
  }
}

// PUT - 保存共享数据
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputs, lastTrackingFetchAt } = body as {
      inputs?: string[];
      lastTrackingFetchAt?: number;
    };

    const hasInputs = inputs !== undefined;
    const hasFetchAt = lastTrackingFetchAt !== undefined;

    if (!hasInputs && !hasFetchAt) {
      return NextResponse.json(
        { error: 'Provide inputs and/or lastTrackingFetchAt' },
        { status: 400 }
      );
    }

    if (hasInputs && !Array.isArray(inputs)) {
      return NextResponse.json(
        { error: 'Invalid inputs format' },
        { status: 400 }
      );
    }

    if (
      hasFetchAt &&
      (typeof lastTrackingFetchAt !== 'number' || !Number.isFinite(lastTrackingFetchAt))
    ) {
      return NextResponse.json(
        { error: 'Invalid lastTrackingFetchAt' },
        { status: 400 }
      );
    }

    // 读取现有数据进行版本检查
    const existingData = await loadSharedData();

    // 更新数据
    const newData: SharedTrackingData = {
      inputs: hasInputs ? inputs! : existingData.inputs,
      lastUpdated: hasInputs ? Date.now() : existingData.lastUpdated,
      version: (existingData.version || 0) + 1,
      lastTrackingFetchAt: hasFetchAt
        ? lastTrackingFetchAt!
        : existingData.lastTrackingFetchAt,
    };
    const success = await saveSharedData(newData);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      version: newData.version
    });
  } catch (error) {
    console.error('Failed to save shared data:', error);
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  }
}