import { describe, it, expect } from 'vitest';
import { AD_EVENTS, getAdEvent, eventsForFormat } from '../events';
import {
  createSessionState,
  defaultShouldShow,
  recordShown,
  requestAd,
  setAdProvider,
} from '../provider';
import type { AdEvent } from '../events';
import type { AdProvider } from '../provider';

describe('ad event catalog', () => {
  it('defines the monetization placements', () => {
    const ids = AD_EVENTS.map((e) => e.id);
    expect(ids).toContain('before_assessment');
    expect(ids).toContain('after_assessment');
    expect(ids).toContain('intro_before_form');
    expect(ids).toContain('chat_followup_3');
    expect(ids).toContain('time_elapsed_120s');
  });

  it('events have unique ids and sane caps', () => {
    const ids = new Set(AD_EVENTS.map((e) => e.id));
    expect(ids.size).toBe(AD_EVENTS.length);
    for (const e of AD_EVENTS) {
      expect(e.cooldownSeconds).toBeGreaterThan(0);
      expect(e.maxPerSession).toBeGreaterThan(0);
    }
  });

  it('returns interstitial events for format query', () => {
    const interstitials = eventsForFormat('interstitial');
    expect(interstitials.map((e) => e.id)).toContain('before_assessment');
  });
});

describe('defaultShouldShow + session caps', () => {
  const ev = (id: string): AdEvent => getAdEvent(id)!;

  it('blocks by cooldown', () => {
    const s = createSessionState();
    const e = ev('after_assessment');
    s.interactions = 1;
    expect(defaultShouldShow(e, s, 1000).reason).toBe('ok');
    recordShown(s, e, 1000);
    // second attempt within cooldown (cooldown 120s)
    expect(defaultShouldShow(e, s, 1060).reason).toBe('cooldown');
  });

  it('blocks after maxPerSession', () => {
    const s = createSessionState();
    const e = ev('after_assessment'); // maxPerSession 2
    s.interactions = 1;
    s.lastShownByFormat.banner = 0; // far in the past
    expect(defaultShouldShow(e, s, 10000).show).toBe(true);
    recordShown(s, e, 10000);
    expect(defaultShouldShow(e, s, 10200).show).toBe(true);
    recordShown(s, e, 10200);
    expect(defaultShouldShow(e, s, 10400).show).toBe(false);
  });

  it('requires minimum interactions for chat events', () => {
    const s = createSessionState();
    const e = ev('chat_followup_3'); // minInteractions 3
    s.interactions = 2;
    expect(defaultShouldShow(e, s, 1000).show).toBe(false);
    s.interactions = 3;
    expect(defaultShouldShow(e, s, 1000).show).toBe(true);
  });

  it('noop provider never shows ads', () => {
    const s = createSessionState();
    const d = requestAd('before_assessment', s);
    expect(d.show).toBe(false);
    expect(d.reason).toBe('no_provider');
  });

  it('configured provider uses decision logic', () => {
    const fake: AdProvider = {
      name: 'fake',
      isConfigured: () => true,
      shouldShow: (event, session) => defaultShouldShow(event, session),
      unitIdFor: () => 'unit-1',
    };
    setAdProvider(fake);
    const s = createSessionState();
    s.interactions = 1;
    const d = requestAd('before_assessment', s);
    expect(d.show).toBe(true);
    expect(s.shownByEvent.before_assessment).toBe(1);
    // cooldown now active for interstitial
    const d2 = requestAd('before_assessment', s);
    expect(d2.show).toBe(false);
  });
});
