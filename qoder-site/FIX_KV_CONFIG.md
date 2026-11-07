# 🔧 修复 Vercel KV 配置指南

## 问题诊断

当前错误 `SyntaxError: Unexpected end of JSON input` 是因为：

1. **错误的 API URL**: `KV_REST_API_URL="https://susan1213.vercel.app/"`
2. **这不是 KV REST API 端点**，而是普通的 Vercel 部署 URL

## 正确的 KV REST API URL 格式

根据 Vercel 官方文档，KV REST API URL 应该是：

### 格式 1: Vercel KV Storage
```
https://<project>.<region>.kv.vercel-storage.com
```

**示例**:
- `https://my-app.us.kv.vercel-storage.com`
- `https://my-tracker.eu.kv.vercel-storage.com`

### 格式 2: Upstash 后端 (如果使用)
```
https://<database-id>.upstash.io
```

**示例**:
- `https://abc123.upstash.io`

## 如何获取正确的环境变量

### 方法 1: Vercel 控制台（推荐）

1. **访问 Vercel 控制台**
   - 打开: https://vercel.com
   - 选择项目: `my-tracker`

2. **查看环境变量**
   - Settings → Environment Variables
   - 查找: `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`

3. **如果变量不存在**
   - 确保 KV 已启用: Storage → KV
   - 启用后会自动创建环境变量

### 方法 2: Vercel CLI

```bash
# 确保项目已链接
vercel link

# 拉取环境变量
vercel env pull .env.local

# 检查是否获取到 KV 变量
cat .env.local | grep KV_REST
```

### 方法 3: 手动配置

如果上述方法都不工作，从已部署的应用日志中查找：

1. 部署到 Vercel（即使失败）
2. 查看函数日志，可能包含正确的环境变量信息

## 修复步骤

1. **备份当前配置**
   ```bash
   cp .env.local .env.local.backup
   ```

2. **更新环境变量**
   编辑 `.env.local`:
   ```bash
   # 错误的（当前）:
   KV_REST_API_URL="https://susan1213.vercel.app/"

   # 正确的格式示例:
   KV_REST_API_URL="https://my-tracker.kv.vercel-storage.com"
   KV_REST_API_TOKEN="你的真实_token_从控制台获取"
   ```

3. **启用 KV 存储**
   ```bash
   USE_KV_STORAGE=true
   ```

4. **重启开发服务器**
   ```bash
   npm run dev
   ```

5. **测试连接**
   ```bash
   curl http://localhost:3000/api/shared-data
   ```

## 常见错误及解决方案

### 错误: `SyntaxError: Unexpected end of JSON input`
**原因**: API URL 不正确或认证失败
**解决**: 检查 URL 格式，确保使用 `.kv.vercel-storage.com` 或 `.upstash.io`

### 错误: `ENOTFOUND`
**原因**: 域名无法解析
**解决**: 使用正确的 KV REST API 域名

### 错误: `Missing required environment variables`
**原因**: 缺少 `KV_REST_API_TOKEN`
**解决**: 从 Vercel 控制台获取 token

## 验证配置

创建测试脚本来验证：

```javascript
// test-kv-connection.js
const { createClient } = require('@vercel/kv');

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

async function test() {
  try {
    await kv.set('test', 'working');
    const result = await kv.get('test');
    console.log('✅ KV 连接成功:', result);
  } catch (error) {
    console.log('❌ KV 连接失败:', error.message);
  }
}

test();
```

运行测试：
```bash
node test-kv-connection.js
```

## 当前配置状态

| 变量 | 当前值 | 状态 |
|------|--------|------|
| `KV_REST_API_URL` | `https://susan1213.vercel.app/` | ❌ 错误 |
| `KV_REST_API_TOKEN` | 设置 | ✅ 可能正确 |
| `USE_KV_STORAGE` | `true` | ✅ 启用 |

## 回退方案

如果 KV 配置仍然有问题，可以回退到文件系统：

```bash
# 注释掉 KV 配置
sed -i.bak 's/USE_KV_STORAGE=true/# USE_KV_STORAGE=true/' .env.local
```

这样应用会使用本地文件存储，完全正常工作。