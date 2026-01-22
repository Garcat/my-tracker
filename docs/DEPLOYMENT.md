# 部署指南 - My Tracker

## 概述

My Tracker 支持多环境部署，自动检测运行环境并选择合适的存储后端：

- **本地开发**: 默认文件系统，可选 Vercel KV（通过 `USE_KV_STORAGE=true`）
- **Vercel 部署**: 自动使用 KV

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 本地开发（文件系统存储）
npm run dev

# 3. 或者使用 KV 存储进行开发
cp env.example .env.local
# 编辑 .env.local 设置 USE_KV_STORAGE=true 和 KV 环境变量
npm run dev
```

## 本地开发

### 环境要求

- Node.js 20.0.0 或更高版本
- npm 或 yarn

### 启动开发服务器

```bash
npm install
npm run dev
```

### 存储选项

#### 选项 1：文件系统存储（默认）

数据存储在 `data/shared-tracking.json` 文件中：
- 自动创建数据目录
- 支持热重载
- 开发时的数据会持久化
- 无需网络连接

#### 选项 2：Vercel KV 存储（推荐）

使用生产环境的 KV 存储进行本地开发：
- 数据与生产环境完全一致
- 实时同步，无需手动迁移
- 更好的测试生产环境行为

**设置步骤：**

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **链接到 Vercel 项目**
   ```bash
   vercel link
   ```

4. **启用 KV（如果还没启用）**
   ```bash
   vercel kv enable
   ```

5. **配置环境变量**
   ```bash
   # 复制环境变量示例文件
   cp env.example .env.local

   # 获取 Vercel KV 环境变量
   vercel env pull .env.local

   # 编辑 .env.local，确保包含以下变量：
   USE_KV_STORAGE=true
   # KV_REST_API_URL 和 KV_REST_API_TOKEN 应该已经被拉取
   ```

   **如果 vercel env pull 没有获取到 KV_REST_API 变量：**
   - 访问 [Vercel 控制台](https://vercel.com)
   - 进入你的项目 → Settings → Environment Variables
   - 查找 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`
   - 手动添加到 `.env.local` 文件

7. **启动开发服务器**
   ```bash
   npm run dev
   ```

**注意事项：**
- 需要网络连接到 Vercel KV
- 会产生少量 KV 使用费用
- 开发数据会写入生产 KV（如果使用同一个项目）
- 建议为开发环境使用单独的 Vercel 项目
- 如果连接失败，检查 KV 环境变量配置

## Vercel 部署

### 1. 准备项目

确保项目已推送到 Git 仓库：

```bash
git add .
git commit -m "feat: add environment-aware storage"
git push origin main
```

### 2. 连接 Vercel

访问 [vercel.com](https://vercel.com) 并导入项目：

1. 点击 "New Project"
2. 选择你的 Git 仓库
3. 配置项目设置

### 3. 配置 Vercel KV

#### 方法一：使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 在项目中启用 KV
vercel kv enable

# 生成环境变量（会自动添加到 Vercel 项目）
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN
```

#### 方法二：手动配置

在 Vercel 控制台中：

1. 进入项目设置 → Environment Variables
2. 添加以下变量：
   - `KV_REST_API_URL`: 从 KV 控制台获取
   - `KV_REST_API_TOKEN`: 从 KV 控制台获取

### 4. 部署

```bash
# 部署到生产环境
vercel --prod
```

或在 Vercel 控制台中点击 "Deploy"

### 5. 验证部署

部署完成后：

1. 访问应用 URL
2. 检查浏览器控制台是否有 KV 错误
3. 尝试添加和保存跟踪号码

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `USE_KV_STORAGE` | 可选 | 设置为 `true` 强制使用 KV 存储（即使在本地开发） |
| `KV_REST_API_URL` | 使用 KV 时必需 | KV REST API 端点 |
| `KV_REST_API_TOKEN` | 使用 KV 时必需 | KV 访问令牌 |
| `NEXT_PUBLIC_API_BASE_URL` | 可选 | API 基础 URL，默认为空 |

## 故障排除

### 本地开发问题

**文件权限错误**
```bash
# 确保 data 目录可写
chmod 755 data/
chmod 644 data/shared-tracking.json
```

**端口占用**
```bash
# 杀掉占用 3000 端口的进程
lsof -ti:3000 | xargs kill -9
```

### Vercel 部署问题

**KV 环境变量缺失**
- 检查 Vercel 项目设置中的环境变量
- 确保变量名正确（区分大小写）

**KV 权限错误**
- 确保 KV 令牌有读写权限
- 检查令牌是否过期

**部署失败**
```bash
# 检查构建日志
vercel logs --follow
```

## 存储策略详情

### 环境检测

代码自动检测运行环境，支持手动覆盖：

```typescript
const useKVStorage = process.env.USE_KV_STORAGE === 'true';
const isVercelEnvironment = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const shouldUseKV = useKVStorage || isVercelEnvironment;
```

### 存储选择

| 场景 | 条件 | 存储方式 | 说明 |
|------|------|----------|------|
| 本地开发（默认） | `USE_KV_STORAGE` 未设置 | 文件系统 | `data/shared-tracking.json` |
| 本地开发（KV） | `USE_KV_STORAGE=true` | Vercel KV | 连接远程 KV |
| Vercel 部署 | Vercel 环境 | Vercel KV | 自动使用 KV |

### 数据一致性

所有存储后端使用相同的：
- 数据结构 (`SharedTrackingData`)
- API 接口
- 版本控制逻辑
- 错误处理机制

## 监控和维护

### 本地开发

- 数据文件：`data/shared-tracking.json`
- 日志输出到控制台

### Vercel 生产环境

- KV 数据通过 Vercel 控制台查看
- 应用日志通过 `vercel logs` 查看

## 开发环境 KV 设置

### 为开发创建单独的 KV 实例

为了避免开发数据污染生产环境，建议：

1. **创建开发项目**
   ```bash
   # 创建新的 Vercel 项目用于开发
   vercel --name my-tracker-dev
   ```

2. **为开发项目启用 KV**
   ```bash
   vercel kv enable --project my-tracker-dev
   ```

3. **配置开发环境变量**
   ```bash
   # 在开发项目的环境变量中设置
   USE_KV_STORAGE=true
   ```

### 环境变量管理

**推荐的项目结构：**
- `my-tracker` (生产) - 使用 KV
- `my-tracker-dev` (开发) - 使用 KV，独立数据

**或者使用分支环境：**
- `main` 分支 - 生产 KV
- `develop` 分支 - 开发 KV

### 切换存储方式

```bash
# 使用文件系统（默认）
unset USE_KV_STORAGE
npm run dev

# 使用 KV 存储
USE_KV_STORAGE=true npm run dev

# 永久设置（添加到 .env.local）
echo "USE_KV_STORAGE=true" >> .env.local
```

## 迁移现有数据

如果从纯文件存储迁移到 KV：

1. 备份 `data/shared-tracking.json`
2. 部署新版本到 Vercel
3. 手动将数据导入 KV（如果需要）

---

*最后更新: 2026-01-22*