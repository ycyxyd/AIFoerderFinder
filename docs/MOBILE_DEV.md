# FörderFinder — 移动端开发指南（MOBILE_DEV）

面向在 FörderFinder（PWA）上进行移动端开发与维护的开发者。本文以中文撰写，
德语领域术语（Förderprogramme、Onboarding、Decision、Regel-Engine 等）与
技术名词（PWA、Service Worker、viewport 等）按原样保留，与
`docs/ARCHITECTURE.md` 配套阅读。

## 1. 项目定位与移动端策略

FörderFinder 是一款 **Compliance-first 的 AI 咨询 PWA**，帮助用户初步判断哪些
deutsche Förderprogramme（如 ALG 1、Bürgergeld、Elterngeld、Wohngeld、BAföG、
Kindergeld 等）与自己的 Situation 基本匹配。

- 目标形态：**PWA**（`display: standalone`），优先移动端使用，桌面端保证可用。
- 核心原则（NON-NEGOTIABLE）：**AI 是 Explain-only，决策由 Regel-Engine 做出**。
  移动端 UI 必须如实呈现这一边界，不得让用户误以为 AI 在“决定”结果。
- 当前状态：**无原生 App、无 Service Worker**。移动端体验基于响应式 Web
  （Tailwind 4 断点），PWA 安装能力只有 manifest + viewport，尚未完整。

## 2. 技术栈（移动端相关）

| 层 | 选型 | 移动端影响 |
|---|---|---|
| 框架 | Next.js 16（App Router）、React 19、TypeScript | 客户端组件（`'use client'`）承载交互；SSR 减少首屏 JS |
| 样式 | Tailwind CSS 4 | 响应式工具类，无额外 UI 库 |
| 表单 | 原生 HTML input/select | 无第三方表单库，移动端键盘/输入行为靠原生类型控制 |
| 存储 | `localStorage` + 可选 Supabase | 无 Cookie/SSR Session，见 §6 |
| AI | Mistral API（Explain-only） | 无 Key 时进入 Demo-Modus（确定性德语 Mock 回答，`usedMock: true`） |
| 数据库 | Supabase（可选） | 未配置时 In-Memory 回退，不影响移动端 UI |

依赖面很小（仅 `next`、`react`、`@supabase/supabase-js`），客户端包体轻量，
对移动网络友好。

## 3. 移动端页面流程（Flow）

用户核心路径（每个页面均已适配窄屏）：

| Route | 页面 | 移动端要点 |
|---|---|---|
| `/` | Landing | Haftungsausschluss 提示框 + CTA“Jetzt prüfen”；窄屏下按钮占满宽度更易点击 |
| `/onboarding` | Facts 采集表单 | 一列布局（`sm:` 以上才两列）；字段含年龄、收入、Vermögen、Beschäftigungsstatus、Pflegegrad 等敏感项 |
| `/results` | 规则引擎结果 | 展示不可变的 Decision-Snapshots（`eligible` / `not_eligible` / `unclear`）；状态徽章 + Gründe 列表 |
| `/chat?decision_id=…` | Explain-only 咨询 | 仅对已有 Decision 做解释，Chat 永不改写 Facts/Decisions |
| `/agb`、`/datenschutz`、`/impressum` | 法律页 | 德语必填页面，移动端阅读排版（行宽、字号）需保持可读 |

路径约束：无 `decision_id` 时 Chat 页不产生新的 Decision；`/results` 为空时引导
回 `/onboarding`。

## 4. PWA 配置现状

- `web/app/manifest.ts`：`name`/`short_name` 为 FörderFinder，`display: standalone`，
  `start_url: '/'`，`lang: 'de'`，`theme_color: '#0f766e'`（teal-700），
  `background_color: '#ffffff'`，`categories: ['finance','government','lifestyle']`。
- `web/app/layout.tsx`：`viewport` 输出 `width=device-width, initial-scale=1`，
  `themeColor: '#0f766e'`；`metadata.manifest` 指向 `/manifest.webmanifest`。
- **缺口（已知，尚未实现）**：
  - **无 Service Worker**：`public/` 下没有 `sw.js`，也没有 `next-pwa` 配置 →
    无离线缓存、无可安装性事件（`beforeinstallprompt`）。
  - **manifest 未声明 `icons`**：`public/icon.svg` 存在但未被引用，缺少
    maskable 图标，安装到主屏幕后图标体验不完整。
  - **无 splash/启动画面优化**：standalone 模式下 iOS/Android 的启动体验未定制。

## 5. 移动端 UI 与交互

- **触控目标**：按钮/链接普遍使用 `px-3 py-2` 起（约 36–40px 高），核心 CTA
  （如“Jetzt prüfen”）约 44px+。新增交互元素建议高度 ≥ 44px，间距 ≥ 8px。
- **表单输入与键盘**：金额/年龄用 `type="number"`（数字键盘），邮箱
  `type="email"`，密码 `type="password"`（`minLength={8}`）；select 用原生
  下拉。⚠️ iOS Safari 对 `font-size < 16px` 的 input 聚焦时会自动缩放页面——
  Onboarding 中 `text-sm`（14px）输入框存在此问题，需真机验证并决定是否提升
  字号或关闭缩放（`maximum-scale=1` 会损害无障碍，不推荐）。
- **安全区（safe-area）**：未使用 `env(safe-area-inset-*)`；底部 Footer 在
  iPhone 横条（Home Indicator）机型上可能被遮挡，属于待办项。
- **深色模式**：`globals.css` 已有 `prefers-color-scheme: dark` 的 CSS 变量，
  但页面多用 Tailwind 浅色类（`bg-slate-50`、`bg-white`），未做系统化适配。
- **语言**：全部 UI 为德语（`<html lang="de">`），无 i18n 框架；新增文案必须
  德语，涉及合规措辞时沿用现有模板（Haftungsausschluss、Hinweis 等）。
- **加载/错误态**：Onboarding 提交有 `loading`/`error` 状态；`/results` 从
  `localStorage` 水合时有“Wird geladen…”占位。弱网下 API 失败需显示德语错误
  并允许重试。

## 6. 数据与状态（移动端视角）

客户端状态全部在浏览器侧，移动端需要理解其生命周期：

- `localStorage['foerderfinder.check']`：最近一次 Prüfung 的 `{ profile, decisions,
  created_at }`，由 Onboarding 写入，`/results` 与 `/chat` 读取（客户端水合）。
- `localStorage['foerderfinder.user_id']`：注册成功后写入，提交决策时随请求携带。
- **Decision Freeze**：Decision 一经 `/api/decisions` 生成即不可变；新数据 →
  新 `decision_id`。移动端刷新/杀进程不会改变已生成的结果。
- **Auth（MVP）**：token 由客户端持有并通过请求头发送；无 Cookie/SSR Session。
  清除站点数据（iOS Safari 的“抹掉网站数据”）会同时清掉 check 与 user_id，
  用户需重新 Onboarding——文档化此行为，必要时在 Results 空态提示。

## 7. 网络与 API（移动端注意）

| API | 用途 | 说明 |
|---|---|---|
| `POST /api/decisions` | 生成 Decision-Snapshots | 唯一写入入口；按 Client-IP 限流 |
| `POST /api/explain` | Explain-only 咨询 | 唯一 LLM 调用；只接收 Decision-Snapshot |
| `GET /api/fundings` | Förderungen 元数据 | 只读 |
| `GET /api/config` | 运行时配置 | 移动端据此隐藏/显示注册 UI（`supabaseConfigured`） |
| `POST /api/auth/signup` / `login` / `GET me` | 可选账户 | 仅 Supabase 配置后可用 |

- **限流**：`/api/explain`、`/api/decisions`、`/api/auth/*` 按 Client-IP 做
  sliding-window 限流（默认 20 次/60 秒，`RATE_LIMIT_MAX` /
  `RATE_LIMIT_WINDOW_MS` 可配）。移动网络（运营商 NAT/CGN）下多用户共享出口
  IP，测试时要留意被误伤的可能。
- **弱网**：无全局请求重试/超时策略；移动端优先保证表单本地可编辑，提交失败
  保留已填内容（状态在组件内）。
- **Demo-Modus**：未配置 `MISTRAL_API_KEY` 时 Explain 返回确定性德语 Mock，
  接口字段含 `usedMock: true`——移动端无需特殊处理，但 UI 应保持同样的
  Haftungsausschluss 语气。

## 8. 性能清单

- 客户端依赖极少，首屏 JS 小；避免引入重量级 UI/动画库。
- 无重型图片资源（`public/` 仅 SVG），图片体积风险低。
- `localStorage` 中的 check 数据随字段增多会膨胀，写入/读取前评估大小。
- 关注项：首次加载（LCP）、表单提交往返延迟；`pnpm build` 与
  `pnpm typecheck` 作为常规门禁。
- Chat 页连续追问会累积请求；移动端应关注每次 Explain 的响应时间与 token
  上限（`MISTRAL_MAX_TOKENS`，默认 800）。

## 9. 兼容性与真机调试

- 目标设备：iOS Safari（16+）、Android Chrome（现代版本）；桌面为次要。
- 开发时局域网真机访问：
  ```sh
  pnpm dev --hostname 0.0.0.0   # 默认只绑定 127.0.0.1，真机需换绑
  ```
- 真机测试清单：
  - Onboarding 数字/邮箱输入时键盘类型与页面缩放行为（iOS 14px 输入框）。
  - `display: standalone` 下从主屏幕启动的导航与返回行为（无浏览器地址栏）。
  - 杀进程/切后台后回到 `/results` 的状态恢复（localStorage 水合）。
  - 弱网/离线：无 Service Worker 时离线即不可用，行为要可预期（显示错误而非白屏）。
  - 底部 Footer 在 iPhone 横条机型上的留白。
  - 深色模式下的对比度（当前适配不完整，属已知限制）。
- 自动化：`pnpm test`（Vitest：Engine + Intent + RateLimit + Response Filter）、
  `pnpm typecheck`、`pnpm build`、`pnpm lint`。

## 10. 合规要点（移动端相关）

- **Haftungsausschluss**：Landing 与 Onboarding 均有“Keine Rechts-, Steuer-
  oder Förderberatung”提示；提交前必须勾选接受（Checkbox），未勾选会阻止提交。
- **DSGVO Art. 9**：`Pflegegrad`、疾病等健康数据属特殊类别（besondere
  Kategorien），需要 Einwilligung 与 Löschkonzept；移动端敏感字段输入时要
  明确告知用途（现有文案：„Alle Angaben werden nur für die Prüfung verwendet“）。
- **`accepted_terms` / `accepted_terms_at`**：注册接口强制 `accepted_terms: true`，
  时间戳写入 `users`，是法律上的 Pflicht-Nachweis。
- 法律页（`/agb`、`/datenschutz`、`/impressum`）在移动端导航中必须可达
  （Footer 链接），不得因空间而省略。

## 11. 已知问题与路线图（移动端）

| 项 | 现状 | 建议 |
|---|---|---|
| Service Worker / 离线 | 无 | 引入轻量 SW，缓存静态资源与最近一次 check |
| PWA 安装图标 | manifest 无 `icons` | 提供 192/512 maskable 图标并接入 manifest |
| iOS 输入缩放 | `text-sm` 输入框 14px | 真机验证；必要时提升输入字号 ≥ 16px |
| 安全区 | 未处理 | Footer 与底部 CTA 增加 `env(safe-area-inset-bottom)` |
| 深色模式 | 仅 CSS 变量 | 系统化适配或显式锁定浅色 |
| Auth | token 客户端持有 | 评估 Cookie/SSR Session 流，改善移动端会话体验 |
| 审计 | `audit_logs` 仅 console.log | 接入 Supabase 表（见 `docs/SUPABASE_SETUP.md`） |

## 12. 常用命令

```sh
pnpm dev                        # 开发（http://127.0.0.1:3000）
pnpm dev --hostname 0.0.0.0     # 局域网真机调试
pnpm test                       # Vitest（Engine + Intent）
pnpm typecheck                  # tsc --noEmit
pnpm build                      # 生产构建
pnpm lint                       # ESLint
node scripts/validate-fundings.mjs  # data/foerderungen/*.json 审查门禁
```

---

# 原生移动端（Capacitor / 鸿蒙）—— 开发与发布路线

> 上述 §1–§12 是 PWA 现状审计（Harness 2026-08-23 产出）。以下为原生
> 包壳架构方案（Hermes 补充），用于 Android / iOS / HarmonyOS 三平台。

## 13. 原生包壳架构

- **Android + iOS：Capacitor 包壳**（`@capacitor/core` + `@capacitor/android` +
  `@capacitor/ios`）。`capacitor.config.ts` 用 `server.url` 指向已部署的 PWA
  （远程 WebView，MVP 不做离线打包），复用时全部现有服务端逻辑：
  Regel-Engine / Supabase / AI / 限流 / 法律页。
- **HarmonyOS NEXT：ArkTS Web 容器壳**。鸿蒙 NEXT 不兼容 Android APK；用
  ArkTS `Web` 组件加载同一套 H5 资源（打包进应用或加载远程 URL），
  后续可接 HUAWEI Ads Kit。
- **核心不变**：决策永远由服务端 Regel-Engine 产生，AI 只解释；
  移动壳不引入任何"本地判案"逻辑。

## 14. 三平台开发/测试/发布路径

| 平台 | 工具链 | 构建方式 | 测试方式 | 发布商店 |
|---|---|---|---|---|
| Android | Java 17 ✅、Gradle 7.5 ✅、Android SDK 35 ✅、AVD `ff_test` ✅ | `npx cap add android` + `./gradlew assembleDebug`（本机） | 模拟器（已装 Android 35 镜像）/ adb 真机 | Google Play（需开发者账号，$25） |
| iOS | ❌ 无 macOS/Xcode | **Codemagic / Eas Build 云构建**（Windows 无法本地构建） | 云构建产物 → 模拟器（Mac）或 TestFlight | App Store（需 Apple ID + 证书） |
| HarmonyOS | DevEco Studio（需安装）+ 华为开发者实名账号 | ArkTS 工程（DevEco 构建 HAP/APP） | DevEco 模拟器 / 真机 | AppGallery Connect |

## 15. 变现架构

- **原生 IAP 铁律**：iOS / Android 应用内购买（会员解锁）必须走
  **Apple StoreKit / Google Play Billing**（平台条款禁止 Stripe 做原生 IAP）。
  插件：`@capacitor-community/apple-sign-in`、Play Billing 插件（或
  RevenueCat 聚合）。
- **Web / PWA 端付费**：Stripe（用户已提供账号信息后接入，
  `stripe` Node SDK + `@stripe/stripe-js` 前端）。
- **广告**：Android 用 **Google AdMob**（`@capacitor-community/admob`）；
  HarmonyOS 用 **HUAWEI Ads Kit**；iOS 需 **App Tracking Transparency（ATT）**
  弹窗（`@capacitor-community/app-tracking-transparency`）。
- **免费额度模式**（来自原始想法）：免费用户看激励视频广告解锁 AI 对话；
  会员免广告 + 无限对话。

## 16. 风险与限制

- **iOS 无法在 Windows 本地构建** → 必须用 Codemagic / Eas Build 云构建
  （免费额度足够 MVP）。
- **鸿蒙**：需要华为开发者实名账号 + DevEco Studio（约 4–6GB）；模拟器/
  真机测试需华为生态。
- **Android 上架**：需要签名密钥（keystore，妥善保管）、隐私政策、
  应用分类与数据安全表单。
- **PWA 审计缺口**（§4/§9）需在包壳前补齐：Service Worker、manifest
  icons、iOS 输入字号 ≥16px、safe-area 处理 —— 否则包壳后体验不完整。

