# Vercel KV 本地开发设置指南

## 问题描述

你想要在本地开发时连接 Vercel KV 存储，而不是使用文件系统。但当前配置缺少必需的 KV 环境变量。

## 解决方案

### 方法 1：使用 Vercel CLI（推荐）

1. **确保项目已链接到 Vercel**
   ```bash
   vercel link
   ```

2. **启用 KV（如果还没启用）**
   ```bash
   vercel kv enable
   ```

3. **拉取环境变量**
   ```bash
   vercel env pull .env.local
   ```

4. **启用 KV 存储**
   ```bash
   echo "USE_KV_STORAGE=true" >> .env.local
   ```

### 方法 2：手动设置环境变量

如果 CLI 方法不工作，访问 [Vercel 控制台](https://vercel.com)：

1. 进入你的项目
2. 转到 **Settings** → **Environment Variables**
3. 查找以下变量：
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. 将它们添加到你的 `.env.local` 文件：
   ```
   KV_REST_API_URL=https://your-project-url.vercel.app/api/kv
   KV_REST_API_TOKEN=your_token_here
   USE_KV_STORAGE=true
   ```

### 测试连接

启动开发服务器并测试：
```bash
npm run dev
```

访问 `http://localhost:3000/api/shared-data` 应该能正常返回数据。

## 常见问题

### KV 环境变量不存在
- 确保在项目中启用了 KV 存储
- 尝试重新运行 `vercel kv enable`

### 连接失败
- 检查网络连接
- 验证环境变量值正确
- 确保项目有 KV 权限

### 权限问题
- 确保你对 Vercel 项目有编辑权限
- 检查是否使用了正确的项目

## 回退方案

如果 KV 设置有问题，你可以随时回到文件系统存储：
```bash
# 注释掉 USE_KV_STORAGE
sed -i.bak 's/USE_KV_STORAGE=true/# USE_KV_STORAGE=true/' .env.local
```

然后重启开发服务器即可。