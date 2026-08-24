// ============================================================================
// lib/ads/provider.ts — pluggable ad provider.
//
// Der Provider entscheidet, OB/WELCHE Werbung zu einem Event gezeigt wird
// (Frequency Caps, Cooldowns, Sitzungs-Zähler). Aktuell: NoopProvider, der
// nie Werbung liefert — bis ein echter Schlüssel (AdMob App ID) konfiguriert
// wird. Integration später via @capacitor-community/admob (nativ) bzw.
// Google AdSense/AdMob Web-SDK (WebView/PWA).
// ============================================================================

import { AD_EVENTS, type AdEvent, type AdFormat } from './events';

export interface AdDecision {
  show: boolean;
  event: AdEvent;
  reason: 'cooldown' | 'cap' | 'not_enabled' | 'no_provider' | 'ok';
}

export interface AdProvider {
  name: string;
  /** True wenn ein echter Ad-Netzwerk-Key konfiguriert ist. */
  isConfigured(): boolean;
  /** Wird vor jedem Event aufgerufen; kann eigene Logik ergänzen. */
  shouldShow(event: AdEvent, session: AdSessionState): AdDecision;
  /** Ausgeliefertes Format (z.B. Banner-Unit-ID). */
  unitIdFor(event: AdEvent): string | null;
}

export interface AdSessionState {
  interactions: number;
  elapsedSeconds: number;
  /** Anzahl der gezeigten Anzeigen pro Event-ID in dieser Sitzung. */
  shownByEvent: Record<string, number>;
  /** Zeitstempel (epoch s) der letzten Anzeige pro Format. */
  lastShownByFormat: Partial<Record<AdFormat, number>>;
}

export function createSessionState(): AdSessionState {
  return { interactions: 0, elapsedSeconds: 0, shownByEvent: {}, lastShownByFormat: {} };
}

// ---------------------------------------------------------------------------
// Noop provider — placeholder bis AdMob konfiguriert ist.
// ---------------------------------------------------------------------------

class NoopProvider implements AdProvider {
  name = 'noop';
  isConfigured(): boolean {
    return false;
  }
  shouldShow(_event: AdEvent): AdDecision {
    return { show: false, event: _event, reason: 'no_provider' };
  }
  unitIdFor(_event: AdEvent): string | null {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Default decision logic — nutzbar, sobald ein echter Provider existiert.
// ---------------------------------------------------------------------------

export function defaultShouldShow(
  event: AdEvent,
  session: AdSessionState,
  nowSec = Math.floor(Date.now() / 1000)
): AdDecision {
  if (event.enabled === false) return { show: false, event, reason: 'not_enabled' };
  if (session.interactions < (event.minInteractions ?? 0)) {
    return { show: false, event, reason: 'cap' };
  }
  const shown = session.shownByEvent[event.id] ?? 0;
  if (shown >= event.maxPerSession) return { show: false, event, reason: 'cap' };
  const last = session.lastShownByFormat[event.format];
  if (last !== undefined && nowSec - last < event.cooldownSeconds) {
    return { show: false, event, reason: 'cooldown' };
  }
  return { show: true, event, reason: 'ok' };
}

export function recordShown(session: AdSessionState, event: AdEvent, nowSec = Math.floor(Date.now() / 1000)) {
  session.shownByEvent[event.id] = (session.shownByEvent[event.id] ?? 0) + 1;
  session.lastShownByFormat[event.format] = nowSec;
}

let provider: AdProvider = new NoopProvider();

/** Später von der AdMob-Integration aufgerufen. */
export function setAdProvider(p: AdProvider) {
  provider = p;
}

export function getAdProvider(): AdProvider {
  return provider;
}

/** Client-API: Entscheidung + (falls ok) markieren. */
export function requestAd(eventId: string, session: AdSessionState): AdDecision {
  const event = AD_EVENTS.find((e) => e.id === eventId);
  if (!event) return { show: false, event: undefined as unknown as AdEvent, reason: 'not_enabled' };
  const decision = provider.shouldShow(event, session);
  if (decision.show) recordShown(session, event);
  return decision;
}
