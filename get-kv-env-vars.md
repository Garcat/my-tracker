# 获取 Vercel KV 环境变量的完整指南

## KV_REST_API_URL 和 KV_REST_API_TOKEN 的获取方法

### 方法 1: 使用 Vercel CLI（推荐）

```bash
# 1. 登录 Vercel（如果还没登录）
vercel login

# 2. 链接到你的项目（如果还没链接）
vercel link

# 3. 启用 KV（如果还没启用）
vercel kv enable

# 4. 拉取环境变量到本地 .env.local 文件
vercel env pull .env.local

# 5. 检查是否获取到 KV 变量
cat .env.local | grep KV_REST
```

### 方法 2: 从 Vercel 控制台手动获取

1. **访问 Vercel 控制台**
   - 打开浏览器访问: https://vercel.com
   - 登录你的账户

2. **选择项目**
   - 点击你的项目名称（my-tracker）

3. **进入环境变量设置**
   - 点击左侧菜单的 **Settings**
   - 点击 **Environment Variables**

4. **查找 KV 变量**
   - 在环境变量列表中查找：
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
   - 如果找不到，说明 KV 可能还没启用

5. **如果 KV 变量不存在**
   - 返回项目主页
   - 点击 **Storage** 标签
   - 点击 **KV** （如果还没启用）
   - 按照提示启用 KV 存储
   - 启用后，环境变量会自动创建

6. **复制变量值**
   - 点击每个变量查看其值
   - 复制 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 的值

### 方法 3: 检查现有部署

如果你的项目已经部署到 Vercel，你也可以：

1. 进入已部署的项目
2. 点击 **Settings** → **Environment Variables**
3. 查看生产环境的 KV 变量值

## 设置到本地开发环境

获取到变量值后，添加到你的 `.env.local` 文件：

```bash
# 编辑 .env.local 文件
nano .env.local

# 添加以下内容（替换为实际值）：
USE_KV_STORAGE=true
KV_REST_API_URL=https://your-actual-kv-url.vercel.app/api/kv
KV_REST_API_TOKEN=your-actual-kv-token
```

## 验证设置

```bash
# 重启开发服务器
npm run dev

# 测试 API
curl http://localhost:3000/api/shared-data

# 如果看到数据而不是错误，说明 KV 连接成功
```

## 常见问题

### Q: 为什么找不到 KV_REST_API_URL 变量？
A: 确保在项目中启用了 KV 存储。去 Storage 标签页启用 KV。

### Q: vercel env pull 不工作？
A: 确保项目已链接（`vercel link`）且你有项目访问权限。

### Q: 变量值看起来像占位符？
A: 某些情况下变量值可能需要在部署后才能看到实际值。

### Q: 还是无法连接？
A: 检查网络连接，确认变量值正确，尝试重新部署项目。

## 备用方案

如果实在无法获取 KV 变量，你可以继续使用文件系统存储：

```bash
# 在 .env.local 中注释掉或删除
# USE_KV_STORAGE=true
```

这样会自动使用本地文件存储，功能完全正常。