# Capacitor 生产加固清单（FörderFinder）

> 审查对象：`D:/testProejekt/apps/foerderfinder/web`（Capacitor 8.5 脚手架，android/ 与 ios/ 已生成）
> 审查方式：只读审查，未修改任何项目文件。
> 审查范围：
> - `capacitor.config.ts`
> - `android/app/src/main/AndroidManifest.xml`
> - `android/app/build.gradle`、`android/build.gradle`、`android/variables.gradle`
> - `android/app/src/main/res/`（图标、启动屏、styles、strings）
> - `ios/App/App/Info.plist`、`ios/App/App.xcodeproj/project.pbxproj`（iOS 部署目标）
> - `package.json`

## 结论摘要

项目处于"远程 WebView 壳 + 开发环境 http"阶段，配置本身能支撑本地开发，但**当前状态绝不能直接上架**。最高优先级问题：`server.url` 指向明文 http 且 `cleartext: true` 是全局放行（并非只放行 dev 源）、无网络安全配置、`allowBackup=true` 会把税务类敏感数据随系统备份上云、图标/启动屏仍是 Capacitor 默认占位资源。以下按 A（安全）、B（上架）、C（生产配置）、D（优先级）四节展开。

---

## A. 安全隐患

### A1. cleartext / mixed content（P0）

- `capacitor.config.ts` 第 20–23 行：`server.url = 'http://10.0.2.2:3000'`，`cleartext: true`。
  `server.cleartext: true` 在 Android 上会合并进清单为 **`android:usesCleartextTraffic="true"`，对整个应用全局放行所有明文流量**（注意：该属性来自 Capacitor 库清单合并，因此 `AndroidManifest.xml` 里看不到它，但实际生效）。
- 配置注释（第 25 行）写的是"Allow http:// only for the dev server origin"，**与实现不符**：`cleartext: true` 不是按源限制，任何 `http://` 域名都可被加载，MITM 面比注释描述的大。
- `android.allowMixedContent: false` 只控制 WebView 的"混合内容"（https 页面加载 http 子资源），与 cleartext 放行是两回事，不能互相替代。当前值为 false 是正确方向，上线后应保持。
- 附带说明：`10.0.2.2` 只在 **Android 模拟器**上指向宿主机回环；真机、iOS 均无效（iOS 模拟器需 `localhost`，真机需局域网 IP 或隧道），因此该配置无法覆盖真机联调场景。
- iOS 侧：`Info.plist` 当前**没有任何 `NSAppTransportSecurity` 例外**。ATS 默认拦截明文 http，所以 iOS 上开发联调 http 地址会被拦截（回环地址存在豁免细节，但局域网 IP 明确需要例外）。生产切 https 后 ATS 默认放行，无需例外。

### A2. WebView 加载远程 URL 的风险（P0）

- 远程壳架构（`server.url` 指向服务器）意味着：WebView 内容完全由服务器下发，**服务器一旦被攻破或被篡改，可在 App 内注入任意 JS**；XSS 可以直接调用 Capacitor 原生 bridge（Preferences、文件、剪贴板等插件能力），等于把原生能力暴露给远程页面。缓解：站点侧必须启用严格 CSP、对用户内容做消毒，并在后端收口敏感能力。
- MITM 面：明文阶段任何中间人可改页面内容（与 A1 叠加）；切 https 后仍需保证 TLS 正确（证书有效、无降级），高级别可做证书固定（见 C5/P2）。
- 启动强依赖网络：App 启动即加载远程 URL，无网络/域名解析失败/服务器宕机时用户看到白屏。商店审查员在弱网环境打开会直接扣分，建议至少提供加载失败页与重试（见 C5）。
- 上架审查时，`server.url` 指向的域名必须**公网可达、无需登录即可打开**，否则商店审查阶段无法通过。

### A3. deep link 劫持（P1）

- 当前风险较低：`AndroidManifest.xml` 只有 `MAIN/LAUNCHER` intent-filter（第 20–23 行），**没有 `VIEW` 类深链 filter**；iOS `Info.plist` 也没有 `CFBundleURLTypes`。`strings.xml` 里的 `custom_url_scheme` 目前没有对应注册，不构成攻击面。
- 未来加深链时务必遵守：
  - Android 使用 **App Links**（`https` scheme + `android:autoVerify="true"` + 服务器 `assetlinks.json`），不要注册裸 `http` 或自定义 scheme 的 `VIEW` filter；
  - iOS 使用 **Universal Links**（`associated-domains` + `apple-app-site-association`）；
  - 任何 `exported="true"` 的 Activity 都要确认其 intent-filter 最小化，避免被第三方应用唤起后注入参数。
- 如果坚持使用自定义 scheme（如 `de.steuerassist.foerderfinder://`），它会被其他恶意 App 注册同名 scheme 劫持，属已知风险，不建议用于敏感流程。

### A4. android:allowBackup（P0）

- `AndroidManifest.xml` 第 5 行 `android:allowBackup="true"`。WebView 的 cookie、localStorage、Capacitor Preferences（含可能保存的 Supabase 会话/token）都属于 App 数据目录，会随系统自动备份上传至 Google Drive/厂商云。
- FörderFinder 处理税务/补贴类个人敏感数据，备份外泄风险不可接受。
- 建议：直接 `android:allowBackup="false"`（最简、最稳），或保留备份但用 `android:dataExtractionRules`（API 31+）排除敏感文件。同时，Google Play 的 **Data safety 表单**要求如实声明这些数据的处理方式。

### A5. exported 组件（P1）

- `MainActivity` `exported="true"` 是 LAUNCHER Activity 的必需项，属正常；`FileProvider` `exported="false"` + `grantUriPermissions` 受限，配置正确。
- 提醒：后续新增任何 Activity/Provider/Service，保持默认不导出；确需导出的，意图过滤器要最小化并做调用方校验。

### A6. 网络安全配置缺失（P0）

- `android/app/src/main/res/xml/` 下只有 `file_paths.xml` 与 `config.xml`，**没有 `network_security_config.xml`**，清单也没有 `android:networkSecurityConfig` 引用。
- 没有网络安全配置意味着：明文放行范围不可控（A1），也无法精细按域名授权。建议按 C2 的示例引入 `network_security_config`，实现"默认禁明文 + 仅白名单 dev 主机放行"。

---

## B. Play Store / App Store 上架风险

### B1. WebView 壳应用政策

- **Google Play**：纯"网站镜像"的 WebView 壳有被拒风险。审查要点：App 需提供网站之外的实质功能（本地登录态、原生能力、离线兜底、推送等），网页内容本身须合规且可独立运营。相关解读见 [TWA App Rejected on Google Play? Switch to WebView](https://primetestlab.com/blog/twa-app-rejected-google-play-switch-to-webview)。
- **App Store**：Guideline 4.2（Minimum Functionality）明确限制"thin HTML/web wrapper"类应用，纯外壳、无实质原生体验会被拒（见 [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 4.2 节）。Capacitor 使用 WKWebView（合规），但建议在壳内加入离线启动页、原生深链、推送等体验再提交。
- 两家商店都会实际打开 App 验收：**生产域名必须公网可达且稳定**，不能临时指到内网/本地地址。

### B2. targetSdk 要求

- 当前 `targetSdkVersion = 36`（`variables.gradle`），已满足 Google Play 现行要求：新应用与更新自 2025-08-31 起须 target API 35+，2026-08 起须 36（见 [Google Play 目标 API 级别要求](https://support.google.com/googleplay/android-developer/answer/11926878) 与 [Android Developers 说明](https://developer.android.google.cn/google/play/requirements/target-sdk)）。
- 注意：这是持续义务，每年随新版 Android 发布都会滚动提高；发布前用 Play Console 的 target API 检查再确认一次。

### B3. 图标/启动屏缺失

- `res/mipmap-*/ic_launcher*.png`、`drawable/ic_launcher_background.xml`、`splash.png`（port/land 各密度）目前均为 **Capacitor 默认占位资源**，未替换为品牌资产。商店审查对默认 Capacitor 图标/启动屏会直接要求整改，甚至拒绝。
- Android 启动屏还有一层：`Theme.SplashScreen`（`styles.xml` 第 19–21 行）引用 `@drawable/splash`，替换 splash.png 时需同步核对。

### B4. 数据安全与隐私（P0 上架材料）

- 应用经 Supabase 处理个人信息，商店上架**必须**提供隐私政策（Play 对收集个人数据的应用强制要求隐私政策 URL；App Store 同样要求 + 隐私标签/营养标签）。
- 德国市场还须满足 **DSGVO/GDPR** 要求（数据最小化、处理记录、用户删除权等），建议由法务确认后再上架。
- 若未来涉及支付/金融服务功能，需另行核对 Google Play "Financial services" 政策；当前"补贴查询"定位不触发，但品牌名含 Steuerassist，需留意边界。

### B5. 签名与版本

- `versionCode 1 / versionName 1.0`（`build.gradle` 第 10–11 行）对首发正常，后续每次上架递增。
- **release 构建未配置签名**（`buildTypes.release` 无 `signingConfig`），当前 release 包无法直接提交 Play；需生成 keystore、配置 `signingConfigs.release`，并建议启用 **Play App Signing** 上传 key 换 Play 管理签名。
- 建议以 **AAB（Android App Bundle）** 格式分发（Play 要求新应用使用 AAB）。
- `minifyEnabled false` 保持即可（Capacitor 项目开启 R8 需额外配 ProGuard 规则，收益低、风险高）。

---

## C. 生产配置建议

### C1. https 切换清单（Android + iOS）

1. 部署生产域名（示例 `https://app.example.de`），确认 TLS 证书有效、支持 HSTS。
2. 修改 `capacitor.config.ts`：

```ts
const config: CapacitorConfig = {
  appId: 'de.steuerassist.foerderfinder',
  appName: 'FörderFinder',
  webDir: 'out',
  server: {
    url: 'https://app.example.de', // 生产域名
    cleartext: false,              // 禁明文
  },
  android: {
    allowMixedContent: false,      // 保持：禁 https 页加载 http 子资源
  },
};
```

3. 开发配置与生产配置分离：用 `npx cap sync android --config capacitor.config.dev.ts` 等方式保留一个 dev 配置（`url: http://10.0.2.2:3000`、`cleartext: true`），**生产配置永不包含明文**。
4. `npx cap sync` 后核对合并清单：确认 `usesCleartextTraffic` 不再为 true（若已引入 network_security_config，则以其为准）。
5. iOS：生产 https 无需 ATS 例外，确认 `Info.plist` 无多余例外后交付。
6. 全站检查混合内容：站点资源（脚本、图片、API、Supabase）全部 https，CSP 头只允许 https 源。

### C2. network_security_config 示例（Android）

`android/app/src/main/res/xml/network_security_config.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- 默认（含生产）：禁止所有明文流量 -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- 仅开发：放行模拟器 -> 宿主机 dev server；上线前移除真机调试条目 -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <!-- 真机调试时可临时加入局域网 IP，如 192.168.x.x；发布包必须删除 -->
    </domain-config>
</network-security-config>
```

在 `AndroidManifest.xml` 的 `<application>` 上引用：

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

要点：显式设置 `networkSecurityConfig` 后，`usesCleartextTraffic` 属性被忽略，以 XML 为准——这是比"全局开关"更可控的做法；`base-config` 禁明文 + 仅 dev 主机白名单，正好解决 A1 的"注释与实现不符"问题。参考 [Android 网络安全配置文档](https://developer.android.com/training/articles/security-config)。

### C3. 图标与 splash 要求

推荐用官方工具一键生成：[@capacitor/assets](https://capacitorjs.com/docs/guides/splash-screens-and-icons)（从一张 1024×1024 源图生成 Android/iOS 全部尺寸），避免手改各密度。

- **Android launcher 图标**（当前为默认占位，需替换）：
  - 传统 mipmap：mdpi 48×48、hdpi 72×72、xhdpi 96×96、xxhdpi 144×144、xxxhdpi 192×192；
  - 自适应图标（API 26+，`mipmap-anydpi-v26`）：画布 108×108 dp，中心安全区约 66 dp 直径（前景不能超出）；
  - 前景/背景分离：`ic_launcher_foreground` + `ic_launcher_background`。
- **Play Store 上架素材**：应用图标 512×512 PNG（32 位）、Feature graphic 1024×500。
- **iOS**：App Store 图标 1024×1024（不可含透明通道）；`Assets.xcassets` 中 AppIcon 全套尺寸由 `@capacitor/assets` 生成；若未替换，同样会被 App Store 拒或要求整改。
- **Android 启动屏**：`splash.png` 各密度（port/land，mdpi→xxxhdpi，竖屏约 2:3 比例）+ `Theme.SplashScreen` 主题背景色；替换时保持各密度比例一致。
- **iOS 启动屏**：`LaunchScreen` storyboard（`UILaunchStoryboardName`），建议改为纯色/品牌背景，避免白屏感。

### C4. minSdk / targetSdk 建议（对照 Capacitor 8 官方要求）

- 当前值（`variables.gradle`）：`minSdkVersion 24`、`compileSdkVersion 36`、`targetSdkVersion 36` —— **与 Capacitor 8 官方默认完全一致**（Capacitor 8：Android minSdk 24 / Android 7.0，compile & target 36；iOS 侧请以 [Capacitor 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup) 与 [升级 8.0 指南](https://next.capacitorjs.com/docs/updating/8-0) 为准，配套 Xcode 16.x、Node 22+）。
- 结论：**不需要改动**。保持与 Capacitor 官方支持的 SDK 组合同步即可；不要为了覆盖老设备下调 minSdk（24 已覆盖 Android 7.0+，占比足够），也不要让 targetSdk 落后于 Play 滚动要求。
- 构建环境：AGP 8.13.0（`android/build.gradle` 第 10 行），要求 **JDK 17+**（建议 21 与 Android Studio Ladybug+ 一致）。
- iOS 部署目标当前为 **15.0**（`project.pbxproj`），高于 Capacitor 支持下限，无需改动；上架前用最新 Xcode 重新构建确认即可。

### C5. 其他生产建议

- **CSP 头**：站点侧强制 `Content-Security-Policy`（`default-src 'self' https:; object-src 'none'; frame-ancestors 'none'` 等），这是远程壳架构下防 XSS→bridge 滥用的第一道防线（A2）。
- **离线兜底**：为无网络启动提供错误页 + 重试；长期可评估 Capacitor 离线打包（移除 `server.url`、走 `webDir`）或 [Capacitor Live Update](https://capacitorjs.com/docs/apis/update) 灰度下发，降低对服务器的单点依赖。
- **证书固定（P2）**：对生产域名做 TLS 固定（Android network_security_config `<pin-set>` 或 iOS 第三方库），成本与运维复杂度较高，量级允许时再上。
- **Supabase 安全**：`@supabase/supabase-js` 在客户端持有 anon key——密钥本身是公开设计，但**行级安全（RLS）与策略才是真实防线**，上架前应审计所有表的 RLS 是否闭合，且不在前端暴露 service_role key。
- **密钥管理**：任何服务端密钥不得进入 WebView 可读取的资源；敏感逻辑放后端（项目已通过复用服务端规则引擎/限流承担，符合该方向）。

---

## D. 优先级排序

| 级别 | 事项 | 说明 |
|---|---|---|
| **P0（必须，上架/安全阻断）** | 1. `server.url` 切 https 生产域名、`cleartext: false`（A1/C1） | 明文全局放行 = 直接 MITM 面，必须先关 |
| | 2. 引入 `network_security_config`（base 禁明文 + dev 白名单）（A6/C2） | 把"全局放行"收窄为"按域名白名单" |
| | 3. `android:allowBackup` 收紧（false 或 dataExtractionRules）（A4） | 税务类敏感数据不得随系统备份上云 |
| | 4. 替换默认图标/启动屏（B3/C3） | Play/App Store 审查硬门槛 |
| | 5. release 签名配置 + AAB + Play App Signing（B5） | 无签名无法提交 Play |
| | 6. 隐私政策（DSGVO）+ Play Data safety / App Store 隐私标签（B4） | 收集个人数据必备上架材料 |
| **P1（强烈建议）** | 7. 生产域名公网可达、弱网/失败页兜底（A2/C5） | 审查员会实际打开 App 验收 |
| | 8. 站点 CSP + 输入消毒，防 XSS→bridge（A2/C5） | 远程壳架构的核心防线 |
| | 9. 深链采用 App Links / Universal Links + 验证（A3） | 现无深链，落地时按规范做 |
| | 10. dev/prod 配置分离（`--config`），防误提交开发地址（C1） | 杜绝"上线后仍指向 10.0.2.2"事故 |
| | 11. targetSdk 保持 ≥ 商店滚动要求，随 Capacitor 官方升级（B2/C4） | 当前 36 达标，需持续跟踪 |
| | 12. 核对 iOS 端无 ATS 例外残留、部署目标与 Xcode 对齐（A1/C4） | 交付前回归确认 |
| **P2（可选）** | 13. TLS 证书固定（C5） | 成本高，量级够再上 |
| | 14. Capacitor Live Update / 离线打包（C5） | 提升体验与审查观感 |
| | 15. Play Integrity / 反作弊接入（C5） | 有商业化/风控需求时再评估 |
| | 16. Supabase RLS 审计 + anon key 最小化（C5） | 属于 web 侧但影响 App 数据安全 |
| | 17. 清理 iOS 模板遗留字段（如 `UIRequiredDeviceCapabilities=armv7`）并核对方向支持（B5） | 低风险收尾项 |

---

## 参考链接

- [Capacitor 环境要求（Environment Setup）](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor 升级到 8.0 指南（Updating to 8.0）](https://next.capacitorjs.com/docs/updating/8-0)
- [How to Upgrade Your Capacitor App to Capacitor 8（Capawesome）](https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8/)
- [Google Play 目标 API 级别要求](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Android Developers：Meet Google Play's target API level requirement](https://developer.android.google.cn/google/play/requirements/target-sdk)
- [Android 网络安全配置（Network security config）](https://developer.android.com/training/articles/security-config)
- [Android 自动备份（Auto Backup）](https://developer.android.com/guide/topics/data/autobackup)
- [Capacitor 图标与启动屏（@capacitor/assets）](https://capacitorjs.com/docs/guides/splash-screens-and-icons)
- [App Store Review Guidelines（4.2 Minimum Functionality）](https://developer.apple.com/app-store/review/guidelines/)
- [TWA App Rejected on Google Play? Switch to WebView](https://primetestlab.com/blog/twa-app-rejected-google-play-switch-to-webview)
