"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasExistingConsent, setHasExistingConsent] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Controlla se l'utente ha già dato il consenso
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
      setHasExistingConsent(false);
    } else {
      setHasExistingConsent(true);
    }

    // Ascolta l'evento personalizzato per aprire le impostazioni
    const handleOpenSettings = () => {
      const existingConsent = localStorage.getItem('cookie-consent');
      if (existingConsent) {
        try {
          setPreferences(JSON.parse(existingConsent));
          setHasExistingConsent(true);
        } catch (e) {
          console.error('Error parsing cookie consent:', e);
        }
      }
      setIsVisible(true);
      setShowSettings(true);
    };

    window.addEventListener('openCookieSettings', handleOpenSettings);
    return () => {
      window.removeEventListener('openCookieSettings', handleOpenSettings);
    };
  }, []);

  const saveConsent = (consentData: typeof preferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(consentData));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);

    // Qui puoi aggiungere la logica per attivare/disattivare i cookie in base alle preferenze
    if (consentData.analytics) {
      // Attiva Google Analytics o altri servizi analytics
      console.log('Analytics cookies enabled');
    }
    if (consentData.marketing) {
      // Attiva cookie di marketing
      console.log('Marketing cookies enabled');
    }
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    saveConsent(allAccepted);
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    saveConsent(necessaryOnly);
  };

  const handleSaveSettings = () => {
    saveConsent(preferences);
  };

  const handleClose = () => {
    if (!hasExistingConsent) {
      // Se non c'è un consenso esistente, rifiuta tutti i cookie (solo necessari)
      const necessaryOnly = {
        necessary: true,
        analytics: false,
        marketing: false,
      };
      saveConsent(necessaryOnly);
    } else {
      // Se c'è già un consenso, chiudi senza modificare
      setIsVisible(false);
      setShowSettings(false);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay trasparente con blur */}
      <div className="fixed inset-0 bg-white/10 z-[9998] backdrop-blur-sm" />

      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6 animate-slide-up">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl border-2 border-bred-500 overflow-hidden">
          {!showSettings ? (
            // Vista principale
            <div className="p-6 md:p-8">
              {/* Header con icona cookie e pulsante chiudi */}
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-bred-500 to-bred-700 rounded-full flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM7 9a1 1 0 100-2 1 1 0 000 2zm3 4a1 1 0 100-2 1 1 0 000 2zm3-4a1 1 0 100-2 1 1 0 000 2z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Utilizziamo i cookie 🍪
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    Usiamo cookie e tecnologie simili per migliorare la tua esperienza sul nostro sito,
                    analizzare il traffico e personalizzare i contenuti. Puoi scegliere quali cookie accettare.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Chiudi"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Informazioni dettagliate */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-bred-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <div>
                      <p className="font-semibold text-gray-900">Necessari</p>
                      <p className="text-gray-600">Essenziali per il funzionamento</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-bred-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                    </svg>
                    <div>
                      <p className="font-semibold text-gray-900">Analytics</p>
                      <p className="text-gray-600">Per migliorare il sito</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-bred-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                    </svg>
                    <div>
                      <p className="font-semibold text-gray-900">Marketing</p>
                      <p className="text-gray-600">Contenuti personalizzati</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pulsanti azione */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-bred-500 hover:bg-bred-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
                >
                  Accetta tutti
                </button>
                <button
                  onClick={handleAcceptNecessary}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 border border-gray-300"
                >
                  Solo necessari
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 bg-white hover:bg-gray-50 text-bred-500 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 border-2 border-bred-500"
                >
                  Personalizza
                </button>
              </div>

              {/* Link privacy policy */}
              <div className="mt-4 text-center text-sm text-gray-600">
                Per maggiori informazioni, leggi la nostra{' '}
                <Link href="/termini-vendita" className="text-bred-500 hover:text-bred-600 underline font-medium">
                  Privacy Policy
                </Link>
              </div>
            </div>
          ) : (
            // Vista impostazioni dettagliate
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Preferenze Cookie
                </h2>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Chiudi"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Cookie necessari */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        Cookie Necessari
                        <span className="text-xs bg-bred-100 text-bred-700 px-2 py-0.5 rounded-full">Sempre attivi</span>
                      </h3>
                      <p className="text-sm text-gray-600">
                        Questi cookie sono essenziali per il funzionamento del sito e non possono essere disattivati.
                        Include funzionalità come il carrello e l&apos;autenticazione.
                      </p>
                    </div>
                    <div className="ml-4">
                      <div className="w-12 h-7 bg-bred-500 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-60">
                        <div className="w-5 h-5 bg-white rounded-full shadow"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cookie analytics */}
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-bred-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">Cookie di Analytics</h3>
                      <p className="text-sm text-gray-600">
                        Ci aiutano a capire come i visitatori interagiscono con il sito raccogliendo informazioni in forma anonima.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                        className={`w-12 h-7 rounded-full flex items-center transition-all duration-200 px-1 ${
                          preferences.analytics ? 'bg-bred-500 justify-end' : 'bg-gray-300 justify-start'
                        }`}
                      >
                        <div className="w-5 h-5 bg-white rounded-full shadow"></div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cookie marketing */}
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-bred-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">Cookie di Marketing</h3>
                      <p className="text-sm text-gray-600">
                        Utilizzati per tracciare i visitatori attraverso i siti web e mostrare annunci pertinenti e coinvolgenti.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, marketing: !prev.marketing }))}
                        className={`w-12 h-7 rounded-full flex items-center transition-all duration-200 px-1 ${
                          preferences.marketing ? 'bg-bred-500 justify-end' : 'bg-gray-300 justify-start'
                        }`}
                      >
                        <div className="w-5 h-5 bg-white rounded-full shadow"></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pulsanti conferma */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 bg-bred-500 hover:bg-bred-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
                >
                  Conferma selezione
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
