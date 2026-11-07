# Pre-commit Hooks 设置指南

## 概述

本项目已配置 pre-commit hooks，要求代码在提交前必须通过 lint 检查，确保代码质量。

## 已安装的工具

- **husky**: Git hooks 管理工具
- **lint-staged**: 只对已暂存文件运行 linter，提高效率

## 配置详情

### package.json 配置

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "eslint"
    ]
  }
}
```

### Git Hooks

- **位置**: `.husky/pre-commit`
- **内容**: `npx lint-staged`
- **作用**: 在提交前运行 lint-staged

## 工作流程

### 1. 安装依赖

```bash
npm install
# 这会自动运行 husky 初始化
```

### 2. 提交代码

```bash
# 添加文件到暂存区
git add .

# 尝试提交（会自动触发 lint 检查）
git commit -m "feat: add new feature"
```

### 3. 如果检查失败

如果代码不符合规则，commit 会被阻止：

**ESLint 失败**:
```
❌ ESLint 检查失败
🔧 自动修复了一些问题
🚫 请手动修复剩余问题后重新提交
```

**TypeScript 编译失败**:
```
❌ TypeScript 编译失败
🔍 请修复类型错误后重新提交
```

**TypeScript 编译失败**:
```
❌ TypeScript 编译失败
🔍 请修复类型错误后重新提交
```

### 4. 修复问题后重新提交

```bash
# 修复 lint 错误
# 重新添加修复的文件
git add .
git commit -m "feat: add new feature"
```

## 跳过检查（仅在紧急情况下）

```bash
# 跳过所有 hooks
git commit -m "fix: urgent fix" --no-verify

# 或设置环境变量
HUSKY=0 git commit -m "fix: urgent fix"
```

## 配置说明

### lint-staged 配置

对以下类型的文件运行多重检查：
- `*.js` - JavaScript 文件
- `*.jsx` - React JavaScript 文件
- `*.ts` - TypeScript 文件
- `*.tsx` - React TypeScript 文件

**检查流程**:
1. **ESLint --fix**: 自动修复可修复的代码风格问题
2. **ESLint**: 检查剩余的代码质量和风格问题
3. **TypeScript 编译**: 检查类型错误，确保代码类型安全

### ESLint 规则

- 自动修复可以自动修复的问题
- 手动修复需要开发者手动修改的问题

## 故障排除

### Hook 不工作

```bash
# 检查 husky 是否正确安装
ls -la .husky/

# 重新初始化 husky
npm run prepare

# 检查权限
ls -la .husky/pre-commit
```

### lint-staged 报错

```bash
# 测试 lint-staged 配置
npx lint-staged --dry-run

# 检查 ESLint 是否正常工作
npm run lint

# 检查 TypeScript 编译
npm run typecheck

# 运行完整构建测试
npm run build
```

### 跳过 hooks

如果需要临时跳过：
```bash
git commit --no-verify -m "紧急修复"
```

## TypeScript 编译检查

### 为什么需要 TypeScript 检查

- **类型安全**: 确保所有变量和函数都有正确的类型
- **早期错误发现**: 在提交前发现类型相关的 bug
- **代码质量**: 维护类型一致性和 API 正确性
- **团队协作**: 确保所有代码符合 TypeScript 标准

### 手动运行检查

```bash
# 只运行 TypeScript 类型检查
npm run typecheck

# 运行完整构建（包括类型检查）
npm run build

# 运行 ESLint
npm run lint
```

### 常见 TypeScript 错误

- **类型未定义**: `Cannot find name 'X'`
- **类型不匹配**: `Type 'X' is not assignable to type 'Y'`
- **属性不存在**: `Property 'X' does not exist on type 'Y'`
- **参数类型错误**: `Expected X parameters, but got Y`

## 最佳实践

1. **频繁提交**: 小步提交，减少冲突
2. **自动修复**: 让 ESLint 自动修复简单问题
3. **团队一致**: 确保所有开发者都安装了 hooks
4. **紧急情况**: 只有在紧急情况下才跳过检查

## 相关文件

- `.husky/pre-commit` - Pre-commit hook
- `.husky/_/husky.sh` - Husky 共享脚本
- `package.json` - 包含 lint-staged 配置