/**
 * Vercel 存储方案示例
 * 使用 Vercel 的文件系统或 KV 存储
 */

// 如果使用 Vercel 文件系统
export const vercelFileStorage = `
/**
 * Vercel 文件系统存储 (仅适用于 Vercel Functions)
 */
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join('/tmp', 'shared-tracking.json'); // Vercel 临时目录

export async function loadSharedInputs(): Promise<string[]> {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.inputs || [];
  } catch {
    return [];
  }
}

export async function saveSharedInputs(inputs: string[]): Promise<void> {
  const data = {
    inputs,
    lastUpdated: Date.now()
  };
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}
`;

// 如果使用 Vercel KV (Redis)
export const vercelKVStorage = `
/**
 * Vercel KV 存储 (推荐)
 */
import { kv } from '@vercel/kv';

const SHARED_KEY = 'shared-tracking-inputs';

export async function loadSharedInputs(): Promise<string[]> {
  try {
    const data = await kv.get(SHARED_KEY);
    return data ? JSON.parse(data).inputs : [];
  } catch {
    return [];
  }
}

export async function saveSharedInputs(inputs: string[]): Promise<void> {
  const data = {
    inputs,
    lastUpdated: Date.now()
  };
  await kv.set(SHARED_KEY, JSON.stringify(data));
}

// 订阅功能已移除 - 单用户模式不需要
`;

// 如果使用 Vercel Postgres
export const vercelPostgresStorage = `
/**
 * Vercel Postgres 存储
 */
import { sql } from '@vercel/postgres';

export async function loadSharedInputs(): Promise<string[]> {
  const result = await sql\`SELECT inputs FROM shared_data LIMIT 1\`;
  return result.rows[0]?.inputs || [];
}

export async function saveSharedInputs(inputs: string[]): Promise<void> {
  await sql\`UPDATE shared_data SET inputs = \${inputs}, updated_at = NOW()\`;
}
`;

export default {
  vercelFileStorage,
  vercelKVStorage,
  vercelPostgresStorage
};