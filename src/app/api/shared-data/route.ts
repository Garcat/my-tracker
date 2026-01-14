/**
 * Next.js API Route - 服务器端共享数据存储
 * 真正的服务器端持久化方案
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'shared-tracking.json');

// 确保数据目录存在
async function ensureDataDirectory() {
  const dataDir = path.dirname(DATA_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// 确保数据文件存在
async function ensureDataFile() {
  await ensureDataDirectory();

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({
      inputs: [],
      lastUpdated: Date.now(),
      version: 1
    }, null, 2));
  }
}

// GET - 加载共享数据
export async function GET() {
  try {
    await ensureDataFile();
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(content);

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
    await ensureDataFile();
    const existingContent = await fs.readFile(DATA_FILE, 'utf-8');
    const existingData = JSON.parse(existingContent);

    // 更新数据
    const newData = {
      inputs,
      lastUpdated: Date.now(),
      version: (existingData.version || 0) + 1
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2));

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