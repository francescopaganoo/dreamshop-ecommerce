import { Metadata } from 'next';
import Link from 'next/link';
import CookieSettingsButton from '@/components/CookieSettingsButton';

export const metadata: Metadata = {
  title: 'Cookie Policy | DreamShop',
  description:
    'Cookie Policy di DreamShop: tipologie di cookie utilizzati (necessari, analytics, marketing), finalità, durata e come gestire le preferenze.',
  alternates: {
    canonical: 'https://dreamshop18.com/cookie-policy',
  },
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Ultimo aggiornamento: 18 giugno 2026</p>

          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              La presente Cookie Policy descrive le tecnologie utilizzate dal sito DreamShop (il «Sito»),
              gestito da <strong>DREAM SHOP S.R.L.</strong> (P.IVA 05812850872), e le finalità del loro
              impiego, in conformità al GDPR, alla Direttiva ePrivacy e alle Linee guida del Garante
              Privacy in materia di cookie del 10 giugno 2021.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Cosa sono i cookie</h2>
            <p className="text-gray-700 mb-4">
              I cookie sono piccoli file di testo che i siti visitati inviano al dispositivo
              dell&apos;utente, dove vengono memorizzati per essere ritrasmessi agli stessi siti in
              occasione di visite successive. Utilizziamo anche tecnologie similari (es. pixel,
              localStorage) cui si applicano le medesime regole.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Tipologie di cookie utilizzati</h2>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2.1 Cookie tecnici/necessari</h3>
            <p className="text-gray-700 mb-4">
              Indispensabili per il funzionamento del Sito (carrello, autenticazione, sicurezza,
              memorizzazione delle preferenze sui cookie). Non richiedono il consenso e non possono
              essere disattivati.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2.2 Cookie analitici</h3>
            <p className="text-gray-700 mb-4">
              Ci aiutano a comprendere come gli utenti utilizzano il Sito per migliorarne le prestazioni.
              Vengono installati <strong>solo previo consenso</strong>.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2.3 Cookie di marketing/profilazione</h3>
            <p className="text-gray-700 mb-4">
              Utilizzati per mostrare annunci pertinenti e misurare le campagne pubblicitarie, anche su
              piattaforme di terze parti. Vengono installati <strong>solo previo consenso</strong>.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Elenco dei cookie e servizi terzi</h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm text-left text-gray-700 border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border-b border-gray-200 font-semibold">Servizio / Cookie</th>
                    <th className="px-3 py-2 border-b border-gray-200 font-semibold">Categoria</th>
                    <th className="px-3 py-2 border-b border-gray-200 font-semibold">Finalità</th>
                    <th className="px-3 py-2 border-b border-gray-200 font-semibold">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 border-b border-gray-200">Cookie di sessione/carrello/autenticazione (1ª parte)</td>
                    <td className="px-3 py-2 border-b border-gray-200">Necessari</td>
                    <td className="px-3 py-2 border-b border-gray-200">Funzionamento del Sito, carrello, login</td>
                    <td className="px-3 py-2 border-b border-gray-200">Sessione / fino a 12 mesi</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b border-gray-200">Stripe (<code>__stripe_mid</code>, <code>__stripe_sid</code>)</td>
                    <td className="px-3 py-2 border-b border-gray-200">Necessari</td>
                    <td className="px-3 py-2 border-b border-gray-200">Pagamenti e prevenzione frodi</td>
                    <td className="px-3 py-2 border-b border-gray-200">Sessione / 1 anno</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b border-gray-200">Google Analytics 4 (<code>_ga</code>, <code>_ga_*</code>, <code>_gid</code>)</td>
                    <td className="px-3 py-2 border-b border-gray-200">Analytics</td>
                    <td className="px-3 py-2 border-b border-gray-200">Statistiche di utilizzo del Sito</td>
                    <td className="px-3 py-2 border-b border-gray-200">Fino a 2 anni</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b border-gray-200">Hotjar (<code>_hjSession*</code>, <code>_hjSessionUser*</code>)</td>
                    <td className="px-3 py-2 border-b border-gray-200">Analytics</td>
                    <td className="px-3 py-2 border-b border-gray-200">Analisi del comportamento di navigazione</td>
                    <td className="px-3 py-2 border-b border-gray-200">Da 30 min a 1 anno</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b border-gray-200">Meta/Facebook Pixel (<code>_fbp</code>, <code>fr</code>)</td>
                    <td className="px-3 py-2 border-b border-gray-200">Marketing</td>
                    <td className="px-3 py-2 border-b border-gray-200">Misurazione campagne e retargeting pubblicitario</td>
                    <td className="px-3 py-2">Fino a 3 mesi</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 mb-4 text-sm">
              I cookie analitici e di marketing sono gestiti tramite Google Tag Manager. Le terze parti
              trattano i dati in qualità di titolari/responsabili autonomi; per i dettagli si rinvia alle
              rispettive informative (Google, Hotjar, Meta).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Gestione delle preferenze</h2>
            <p className="text-gray-700 mb-4">
              Al primo accesso viene mostrato un banner che consente di accettare tutti i cookie,
              rifiutare quelli non necessari o personalizzare le scelte. Fino al rilascio del consenso,
              i cookie analitici e di marketing <strong>non vengono installati</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              Puoi modificare le tue preferenze in qualsiasi momento tramite il pulsante{' '}
              <CookieSettingsButton className="text-bred-500 hover:text-bred-600 underline font-medium">
                «Impostazioni cookie»
              </CookieSettingsButton>{' '}
              o tramite l&apos;analogo link presente nel footer del Sito. Puoi inoltre eliminare o bloccare i cookie dalle impostazioni
              del tuo browser; la disattivazione di alcuni cookie potrebbe limitare le funzionalità del Sito.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Ulteriori informazioni</h2>
            <p className="text-gray-700 mb-4">
              Per ogni informazione sul trattamento dei dati personali si rinvia alla{' '}
              <Link href="/privacy-policy" className="text-bred-500 hover:text-bred-600 underline">Privacy Policy</Link>.
              Per contatti:{' '}
              <a href="mailto:dreamshopfigure@gmail.com" className="text-bred-500 hover:text-bred-600 underline">
                dreamshopfigure@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
