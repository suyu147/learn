# 新用户首次登录画像构建引导 — 实现计划书

## 一、需求概述

新用户注册后首次登录时，系统自动弹出交互式个人画像构建界面（AI 对话式），用户完成画像构建后才能进入主界面。已构建画像的老用户直接进入主界面。用户可选择"稍后完善"跳过 onboarding，后续使用依赖画像的功能时再次提醒。

## 二、现状分析

| 现有模块 | 状态 | 说明 |
|---------|------|------|
| 画像构建 UI | ✅ 已有 | `components/profile/profile-chat.tsx` — AI 对话式画像构建，完成后 2.5s 自动跳转 `/workspace` |
| 画像完整度判断 | ✅ 已有 | `lib/utils/profile-utils.ts` — `isProfileComplete()` 8 个维度填满 6 个即视为完成 |
| 画像数据持久化 | ✅ 已有 | **文件系统存储** `data/learning/{userId}/profile.json`（由 `/api/v1/profile` 读写），Prisma 中的 `LearningProfile` 模型实际未被 API 使用 |
| 认证系统 | ✅ 已有 | 3 种模式（disabled/single/multi），JWT 认证，`lib/store/auth-store.ts` |
| 注册跳转 | ⚠️ 需修改 | 注册成功后直接 `router.push('/chat')`，不检查画像状态 |
| 登录跳转 | ⚠️ 需修改 | 登录成功后直接 `router.push('/chat')`，不检查画像状态 |
| AppShell 守卫 | ⚠️ 需扩展 | `components/providers.tsx` 只做认证守卫，不做画像守卫；且只对 `/auth/*` 页面隐藏 Sidebar |
| 首次用户检测 | ❌ 缺失 | 后端无 `hasProfile` 字段，前端无首次登录判断逻辑 |
| 画像引导页 | ❌ 缺失 | 没有独立的全屏画像构建引导页面 |
| 服务端页面路由保护 | ❌ 缺失 | `middleware.ts` 只保护 API 路由，不保护页面路由，用户可直接输入 URL 绕过客户端守卫 |

## 三、实现方案

### 3.1 总体流程

```
注册/登录成功
    ↓
调用 GET /api/v1/auth/status（扩展返回 hasProfile 字段）
    ↓
hasProfile = false?
    ├─ YES → 重定向到 /onboarding（全屏画像构建页）
    │           ↓
    │       用户完成 AI 对话式画像构建
    │           ↓
    │       isProfileComplete = true
    │           ↓
    │       ① 调用 POST /api/v1/profile/complete（写 DB）
    │           ↓
    │       ② 更新 auth-store.hasProfile = true
    │           ↓
    │       ③ router.push('/chat') 跳转主界面
    │
    ├─ 用户点击"稍后完善"
    │       ↓
    │       ① 调用 POST /api/v1/profile/complete（skip=true，标记跳过）
    │           ↓
    │       ② 更新 auth-store.hasProfile = true
    │           ↓
    │       ③ router.push('/chat') 跳转主界面
    │       ④ 后续使用 SmartLearn 等依赖画像的功能时弹出提醒
    │
    └─ NO → 直接进入 /chat（主界面）
```

### 3.2 后端改动

#### 1. `User` 模型新增 `profileCompletedAt` 字段

文件：`prisma/schema.prisma`

```prisma
model User {
  // ... 现有字段
  profileCompletedAt  DateTime?  @map("profile_completed_at")  // 新增
}
```

- `null` = 未完成画像构建（首次用户）
- 有值 = 已完成画像构建的时间戳
- 优势：比布尔字段更灵活，可追踪完成时间

#### 2. 扩展 `/api/v1/auth/status` 返回值

文件：`app/api/v1/auth/status/route.ts`

响应新增 `hasProfile` 字段：

```typescript
{
  mode: 'multi',
  user: { id, username, role },
  token: '...',
  hasProfile: true | false,  // 新增：基于 User.profileCompletedAt 是否为 null
}
```

后端实现：在返回 user 信息时，同时查询 `User.profileCompletedAt`，不为 null 则 `hasProfile = true`。

#### 3. 新增 `POST /api/v1/profile/complete` 端点

文件：`app/api/v1/profile/complete/route.ts`

标记用户画像构建完成。**userId 从 JWT token 提取，不从请求体传入**，防止越权操作。

```typescript
// 请求：无请求体（或可选 { skipped: boolean } 标记是跳过还是完成）
// 响应：{ success: true, data: { profileCompletedAt: string } }
//
// 内部逻辑：
//   1. 通过 authenticate(request) 从 JWT 获取当前用户 userId
//   2. 将 User.profileCompletedAt 设为 now()
//   3. 返回成功
//
// 安全：userId 来自服务端 JWT 验证，不接受客户端传入
```

#### 4. Prisma 迁移

```bash
npx prisma migrate dev --name add_profile_completed_at
```

### 3.3 前端改动

#### 1. 扩展 auth-store 增加 `hasProfile` 状态

文件：`lib/store/auth-store.ts`

```typescript
interface AuthState {
  // ... 现有字段
  hasProfile: boolean;  // 新增，默认 false

  // initAuth 从 /api/v1/auth/status 读取 hasProfile
  // 新增 setHasProfile(hasProfile: boolean) 方法，供 onboarding 完成后调用
  // logout() 方法中必须重置 hasProfile = false，防止下一位用户继承前一位用户的画像状态
}
```

#### 2. 修改 AppShell 增加画像守卫 + onboarding 页面无 Sidebar

文件：`components/providers.tsx`

在认证守卫之后增加画像守卫逻辑，并将 `/onboarding` 加入无 Sidebar 白名单：

```typescript
const isAuthPage = pathname.startsWith('/auth/');
const isOnboardingPage = pathname.startsWith('/onboarding');

// --- 画像守卫 ---
// 已认证 + 画像未完成 + 不在 onboarding 页面 → 重定向到 /onboarding
if (isInitialized && user && !hasProfile && !isOnboardingPage && !isAuthPage) {
  redirectTo = '/onboarding';
}
// 已认证 + 画像已完成 + 在 onboarding 页面 → 重定向到 /chat
if (isInitialized && user && hasProfile && isOnboardingPage) {
  redirectTo = '/chat';
}

// --- 渲染逻辑 ---
// /auth/* 和 /onboarding 页面不渲染 Sidebar
if (isAuthPage || isOnboardingPage) {
  return <>{children}</>;
}
```

> **注意：服务端路由保护限制** — 当前 `middleware.ts` 只保护 API 路由，不保护页面路由。用户直接在地址栏输入 `/chat` 可绕过客户端画像守卫。这是 Next.js App Router 客户端守卫的固有局限。要完全防止绕过，需要在 middleware.ts 中扩展 matcher 覆盖页面路由并查询 DB 检查 `hasProfile`，但这会增加每个页面请求的 DB 查询开销。当前方案以客户端守卫为主，后续如有需要再增加 middleware 层面的保护。

#### 3. 新建 `/onboarding` 页面

文件：`app/onboarding/page.tsx`

- 全屏布局（无 Sidebar），居中展示画像构建 UI
- 复用现有 `ProfileChat` 组件，`mode="onboarding"` 传入
- 顶部进度指示器（显示画像完成度百分比，基于 `calculateProfileCompleteness()`）
- "稍后完善"按钮：调用 `POST /api/v1/profile/complete`（标记跳过）→ 更新 store → 跳转 `/chat`
- 画像完成时的完整流程（严格时序）：

```
① ProfileChat.onComplete 回调触发
② 调用 POST /api/v1/profile/complete（等待响应成功）
③ 调用 auth-store.setHasProfile(true)
④ router.push('/chat')
```

时序保证：步骤 ②③ 必须在 ④ 之前完成，否则 AppShell 画像守卫可能把用户重定向回 `/onboarding`，形成死循环。因此 onboarding 页面中不在 ② 之前执行任何路由跳转。

#### 4. 修改 `ProfileChat` 组件支持 onboarding 模式

文件：`components/profile/profile-chat.tsx`

新增 props：

```typescript
interface ProfileChatProps {
  mode?: 'embedded' | 'onboarding';  // embedded=现有嵌入模式, onboarding=全屏引导模式
  onComplete?: () => void;            // 画像完成回调（仅 onboarding 模式使用）
}
```

关键行为变更：

| 行为 | embedded 模式（默认） | onboarding 模式 |
|------|---------------------|-----------------|
| 容器高度 | 固定 `h-[500px]` | 自适应全屏 `flex-1` |
| 画像完成后自动跳转 | ✅ 2.5s 后跳转 `/workspace` | ❌ **禁用**，改为触发 `onComplete` 回调 |
| 画像完成提示 | 内嵌绿色横幅 | 由外部 onboarding 页面控制 |
| "新建对话"按钮 | 显示 | 隐藏（onboarding 期间不允许重置） |

**禁用内部自动跳转的实现**：当 `mode === 'onboarding'` 时，`useEffect` 中 `profileComplete` 变为 true 后不执行 `router.push('/workspace')`，而是调用 `onComplete?.()`。

#### 5. 修改注册/登录页跳转逻辑

文件：`app/auth/register/page.tsx`, `app/auth/login/page.tsx`

注册/登录成功后，从 auth-store 读取 `hasProfile` 决定跳转目标：

```typescript
const hasProfile = useAuthStore((s) => s.hasProfile);

// 注册/登录成功后
router.push(hasProfile ? '/chat' : '/onboarding');
```

## 四、文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | User 新增 `profileCompletedAt` 字段 |
| `app/api/v1/auth/status/route.ts` | 修改 | 返回 `hasProfile` 字段 |
| `app/api/v1/profile/complete/route.ts` | 新增 | 标记画像完成 API（userId 从 JWT 取，非请求体） |
| `lib/store/auth-store.ts` | 修改 | 新增 `hasProfile` 状态 + `setHasProfile` 方法 |
| `components/providers.tsx` | 修改 | AppShell 增加画像守卫 + `/onboarding` 无 Sidebar |
| `app/onboarding/page.tsx` | 新增 | 全屏画像构建引导页 |
| `components/profile/profile-chat.tsx` | 修改 | 支持 onboarding 模式，禁用内部自动跳转 |
| `app/auth/login/page.tsx` | 修改 | 登录后根据画像状态跳转 |
| `app/auth/register/page.tsx` | 修改 | 注册后根据画像状态跳转 |

## 五、边界情况处理

| 场景 | 处理 |
|------|------|
| disabled/single 模式 | 这两种模式下用户是自动登录的默认用户（如 `local-admin`），为避免干扰体验，**默认不触发 onboarding**。仅在 multi 模式下强制 onboarding。disabled/single 模式的用户仍可手动访问 `/profile` 构建画像。 |
| 用户在 onboarding 页面刷新 | 从服务端重新获取 `hasProfile`（通过 `initAuth`），未完成则停留在 onboarding；已完成则被 AppShell 守卫重定向到 `/chat` |
| 用户在 onboarding 页面关闭浏览器 | `profileCompletedAt` 未写入 DB，下次登录仍进入 onboarding；但画像对话数据已通过 `ProfileChat` 实时保存到文件系统 |
| 画像构建中途退出后再次进入 | 画像部分数据已保存在文件系统 `data/learning/{userId}/profile.json`，onboarding 可选择"继续上次"或"重新开始" |
| 老用户已有画像数据但 `profileCompletedAt` 为 null | 需要一次性数据迁移脚本（见第六节） |
| 用户点击"稍后完善"跳过 onboarding | 标记 `profileCompletedAt = now()`，后续进入依赖画像的页面时弹出提醒横幅。**触发条件**：当 `profileCompletedAt` 有值（即跳过了 onboarding）但 `isProfileComplete(profile.dimensions)` 返回 `false` 时，在进入 `/smartlearn`、`/workspace` 等画像依赖页面时弹出"完善画像以获得更好体验"的提醒横幅。画像已真正完成的用户不会看到此提醒。 |
| 用户直接在地址栏输入 `/chat` 绕过 onboarding | 客户端 AppShell 守卫会在首次渲染时重定向到 `/onboarding`。但若 JS 尚未执行，页面可能短暂闪现。完全防止需扩展 middleware（当前不实施，见 3.3 第 2 点说明） |

## 六、老用户数据迁移

画像数据实际存储在文件系统 `data/learning/{userId}/profile.json` 中，而非 Prisma 的 `LearningProfile` 表。迁移脚本需要扫描文件系统，而非查询数据库。

迁移脚本伪代码：

```typescript
// scripts/migrate-profile-completed.ts

import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { isProfileComplete } from '@/lib/utils/profile-utils';

const prisma = new PrismaClient();
const DATA_DIR = 'data/learning';

async function migrate() {
  // 1. 扫描 data/learning/ 下所有用户目录
  const userDirs = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let updated = 0;

  for (const userId of userDirs) {
    // 2. 检查是否已有 profileCompletedAt（跳过已处理的）
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.profileCompletedAt) continue;

    // 3. 读取 profile.json
    const profilePath = join(DATA_DIR, userId, 'profile.json');
    try {
      const raw = readFileSync(profilePath, 'utf-8');
      const profile = JSON.parse(raw);

      // 4. 确认 profile.json 结构：dimensions 应在 profile.dimensions 下
      //    如果 dimensions 在根级别，自动适配
      const dimensions = profile.dimensions ?? profile;

      // 5. 用 isProfileComplete 检查维度完整度
      if (isProfileComplete(dimensions)) {
        await prisma.user.update({
          where: { id: userId },
          data: { profileCompletedAt: new Date() },
        });
        updated++;
      }
    } catch {
      // 文件不存在或解析失败，跳过
    }
  }

  console.log(`Migration complete. Updated ${updated} users.`);
}

migrate();
```

运行方式：

```bash
npx tsx scripts/migrate-profile-completed.ts
```

## 七、实施步骤（建议顺序）

1. **Prisma 迁移**：schema 新增 `profileCompletedAt` 字段 + 生成迁移
2. **后端 API**：修改 auth/status 返回 `hasProfile`、新增 profile/complete（userId 从 JWT 取）
3. **auth-store 扩展**：新增 `hasProfile` 状态 + `setHasProfile` 方法
4. **ProfileChat 扩展**：支持 onboarding 模式，禁用内部自动跳转，触发 `onComplete` 回调
5. **onboarding 页面**：新建全屏引导页 + 进度指示器 + "稍后完善"按钮 + 严格时序的完成流程
6. **AppShell 画像守卫**：增加重定向逻辑 + `/onboarding` 无 Sidebar 白名单
7. **登录/注册页跳转**：根据 `hasProfile` 状态跳转
8. **老用户数据迁移**：扫描文件系统回填 `profileCompletedAt`
9. **端到端测试**：新用户流程 + 老用户流程 + multi 模式 + disabled/single 模式 + 跳过 onboarding 场景
