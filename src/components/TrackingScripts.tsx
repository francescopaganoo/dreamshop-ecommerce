'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { readConsent, CONSENT_CHANGED_EVENT, type CookiePreferences } from '@/lib/consent';

/**
 * Consent-gated tracking.
 *
 * - Google (GTM/GA): loaded in layout but governed by Google Consent Mode v2,
 *   whose default is "denied" (see layout.tsx). Here we push the "update" once
 *   the user consents, so GA only starts writing cookies after opt-in.
 * - Hotjar (analytics) and Meta Pixel (marketing): NOT loaded until the user
 *   grants the matching category — they are rendered conditionally below.
 */

const HOTJAR_ID = 6545540;
const FB_PIXEL_ID = '881191446642521';

interface DataLayerWindow extends Window {
  dataLayer?: unknown[];
}

function updateConsentMode(prefs: CookiePreferences): void {
  if (typeof window === 'undefined') {
    return;
  }
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  // Mirror Google's gtag() shape: push the arguments list onto the dataLayer.
  w.dataLayer.push([
    'consent',
    'update',
    {
      analytics_storage: prefs.analytics ? 'granted' : 'denied',
      ad_storage: prefs.marketing ? 'granted' : 'denied',
      ad_user_data: prefs.marketing ? 'granted' : 'denied',
      ad_personalization: prefs.marketing ? 'granted' : 'denied',
    },
  ]);
}

export default function TrackingScripts() {
  const [consent, setConsent] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const current = readConsent();
    if (current) {
      setConsent(current);
      updateConsentMode(current);
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CookiePreferences>).detail;
      if (detail) {
        setConsent(detail);
        updateConsentMode(detail);
      }
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
  }, []);

  return (
    <>
      {consent?.analytics && (
        <Script
          id="hotjar-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `,
          }}
        />
      )}

      {consent?.marketing && (
        <Script
          id="facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${FB_PIXEL_ID}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}
    </>
  );
}
