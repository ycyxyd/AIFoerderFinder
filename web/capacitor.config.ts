import type { CapacitorConfig } from '@capacitor/cli';

/**
 * FörderFinder — Capacitor configuration (Android + iOS).
 *
 * MVP strategy: remote WebView. The native shell loads the PWA from a URL,
 * reusing ALL server-side logic (rule engine, Supabase, AI, rate limiting).
 * No offline bundling yet.
 *
 * - Dev on Android emulator: 10.0.2.2 = host machine loopback (the Next.js
 *   server running on the host at :3000). cleartext: true is required for
 *   http:// during dev; switch to https:// and cleartext: false for release.
 * - Production: set server.url to the deployed PWA (e.g. https://app.example.de).
 * - HarmonyOS is a separate ArkTS Web shell (not this config).
 */
const config: CapacitorConfig = {
  appId: 'de.steuerassist.foerderfinder',
  appName: 'FörderFinder',
  webDir: 'out',
  server: {
    url: 'http://10.0.2.2:3000',
    // Network security config (res/xml/network_security_config.xml) permits
    // cleartext ONLY to the dev host 10.0.2.2; everything else is blocked.
    cleartext: false,
  },
  android: {
    // Allow http:// only for the dev server origin; tighten for release.
    allowMixedContent: false,
  },
};

export default config;
