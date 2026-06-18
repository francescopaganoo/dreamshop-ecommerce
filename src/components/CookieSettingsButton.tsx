'use client';

interface CookieSettingsButtonProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Re-opens the cookie preferences banner. Mirrors the footer trigger
 * (CookieConsent listens for the `openCookieSettings` event).
 */
export default function CookieSettingsButton({ className, children }: CookieSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('openCookieSettings'))}
      className={className}
    >
      {children}
    </button>
  );
}
