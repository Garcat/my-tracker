/**
 * Next.js API Route - 服务器端共享数据存储
 * 使用 Vercel KV 进行持久化存储
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SHARED_KEY = 'shared-tracking-data';

// 数据类型定义
interface SharedTrackingData {
  inputs: string[];
  lastUpdated: number;
  version: number;
}

// 默认数据结构
const DEFAULT_DATA: SharedTrackingData = {
  inputs: [],
  lastUpdated: Date.now(),
  version: 1
};

// 加载共享数据
async function loadSharedData(): Promise<SharedTrackingData> {
  try {
    const data = await kv.get(SHARED_KEY);
    return data ? JSON.parse(data as string) : DEFAULT_DATA;
  } catch (error) {
    console.error('Failed to load from KV:', error);
    return DEFAULT_DATA;
  }
}

// 保存共享数据
async function saveSharedData(data: SharedTrackingData): Promise<boolean> {
  try {
    await kv.set(SHARED_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save to KV:', error);
    return false;
  }
}

// GET - 加载共享数据
export async function GET() {
  try {
    const data = await loadSharedData();

    return NextResponse.json({
      inputs: data.inputs || [],
      lastUpdated: data.lastUpdated,
      version: data.version
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
    const { inputs } = body;

    if (!Array.isArray(inputs)) {
      return NextResponse.json(
        { error: 'Invalid inputs format' },
        { status: 400 }
      );
    }

    // 读取现有数据进行版本检查
    const existingData = await loadSharedData();

    // 更新数据
    const newData = {
      inputs,
      lastUpdated: Date.now(),
      version: (existingData.version || 0) + 1
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