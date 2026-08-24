'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createSessionState,
  getAdProvider,
  requestAd,
  type AdSessionState,
} from '../lib/ads/provider';

// Module-level session state: shared across AdSlot instances in this tab.
let session: AdSessionState = createSessionState();

/** Notify the session that the user interacted (chat message sent etc.). */
export function bumpAdInteractions(n = 1) {
  session.interactions += n;
}

/** Fire an ad event and return whether an ad should be shown. */
export function fireAdEvent(eventId: string): boolean {
  const decision = requestAd(eventId, session);
  return decision.show;
}

/**
 * AdSlot — renders an ad container at a placement when the provider decides
 * to show one. With the default Noop provider nothing is rendered (zero
 * visual impact); the real provider (AdMob) will render its units here.
 */
export default function AdSlot({ event, className }: { event: string; className?: string }) {
  const [visible, setVisible] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const decision = requestAd(event, session);
    setVisible(decision.show && getAdProvider().isConfigured());
  }, [event]);

  if (!visible) return null;

  return (
    <div
      data-ad-event={event}
      className={
        className ??
        'my-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-400'
      }
    >
      Anzeige ({event})
    </div>
  );
}
