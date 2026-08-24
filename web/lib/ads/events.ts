// ============================================================================
// lib/ads/events.ts — AD EVENT CATALOG (monetization)
//
// Zielgruppe: Förderungssuchende. Sie zahlen i.d.R. KEINE Mitgliedschaft,
// verlassen die App nach erfolgreichem Antrag. Monetarisierung = Werbung an
// definierten, hochwertigen Zeitpunkten (kein Popup-Spam; Frequency Caps).
//
// Jeder Event hat: id, Placement (wo), format (Banner/Interstitial/Native),
// Frequenz-Cap, Berechtigungslogik. Provider (AdMob etc.) implementiert
// lib/ads/provider.ts; UI ruft <AdSlot event="..." /> auf.
// ============================================================================

export type AdFormat = 'banner' | 'interstitial' | 'rewarded' | 'native';

export interface AdEvent {
  id: string;
  /** Wann der Event feuert (Produkt-Sprache). */
  placement: string;
  format: AdFormat;
  /** Min. Sekunden seit letztem AdEvent gleichen Formats (Cooldown). */
  cooldownSeconds: number;
  /** Max. Anzeigen dieses Events pro Sitzung. */
  maxPerSession: number;
  /** Wird nur angezeigt, wenn mind. N Nachrichten/Interaktionen stattfanden. */
  minInteractions?: number;
  /** Deaktivieren ohne Löschen (Standard: aktiv). */
  enabled?: boolean;
  description: string;
}

export const AD_EVENTS: AdEvent[] = [
  {
    id: 'intro_before_form',
    placement: 'Vor dem Ausfüllen des Antragsformulars (Onboarding)',
    format: 'banner',
    cooldownSeconds: 90,
    maxPerSession: 2,
    description: 'Banner auf der Onboarding-Seite, bevor der Nutzer das Formular sieht.',
  },
  {
    id: 'before_assessment',
    placement: 'Vor Anzeige der Gesamteinschätzung (KI-Assistent)',
    format: 'interstitial',
    cooldownSeconds: 120,
    maxPerSession: 1,
    minInteractions: 1,
    description: 'Interstitial, NACHDEM der Nutzer seine Situation beschrieben hat, VOR der Beratung. Höchster Wert.',
  },
  {
    id: 'after_assessment',
    placement: 'Nach Anzeige der Gesamteinschätzung',
    format: 'banner',
    cooldownSeconds: 120,
    maxPerSession: 2,
    description: 'Banner unter der Gesamteinschätzung / über dem Antrags-Fahrplan.',
  },
  {
    id: 'before_results',
    placement: 'Vor Anzeige der Formular-Ergebnisse (Onboarding → Results)',
    format: 'interstitial',
    cooldownSeconds: 180,
    maxPerSession: 1,
    description: 'Interstitial zwischen Formular-Absenden und Ergebnisliste.',
  },
  {
    id: 'chat_followup_3',
    placement: 'Nach der 3. Nachfrage im Chat',
    format: 'banner',
    cooldownSeconds: 180,
    maxPerSession: 2,
    minInteractions: 3,
    description: 'Banner oberhalb des Chat-Eingabefelds nach mehreren Rückfragen.',
  },
  {
    id: 'chat_followup_6',
    placement: 'Nach der 6. Nachfrage im Chat (intensive Nutzung)',
    format: 'rewarded',
    cooldownSeconds: 300,
    maxPerSession: 1,
    minInteractions: 6,
    description: 'Rewarded-Video: Nutzer kann es ansehen, um z.B. eine ausführliche Beratung freizuschalten.',
  },
  {
    id: 'time_elapsed_120s',
    placement: 'Nach 2 Minuten Verweildauer in einer Sitzung',
    format: 'banner',
    cooldownSeconds: 180,
    maxPerSession: 1,
    description: 'Banner, wenn der Nutzer länger liest (hohe Aufmerksamkeit).',
  },
  {
    id: 'application_plan_view',
    placement: 'Beim Aufklappen des Antrags-Fahrplans (detaillierte Schritte)',
    format: 'native',
    cooldownSeconds: 240,
    maxPerSession: 1,
    description: 'Native-Ad Karte im Fahrplan (subtil, im Kontext).',
  },
  {
    id: 'exit_intent',
    placement: 'Beim Verlassen/Wechsel auf eine offizielle Seite',
    format: 'interstitial',
    cooldownSeconds: 600,
    maxPerSession: 1,
    description: 'Interstitial beim Klick auf externe Links (Arbeitsagentur etc.) — letzte Chance.',
  },
];

export function getAdEvent(id: string): AdEvent | undefined {
  return AD_EVENTS.find((e) => e.id === id);
}

/** Events eines Formats (für Provider-Config). */
export function eventsForFormat(format: AdFormat): AdEvent[] {
  return AD_EVENTS.filter((e) => e.format === format && e.enabled !== false);
}
