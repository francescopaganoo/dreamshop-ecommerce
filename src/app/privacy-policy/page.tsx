import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | DreamShop',
  description:
    'Informativa sul trattamento dei dati personali (artt. 13-14 GDPR) di DreamShop: titolare, finalità, basi giuridiche, conservazione e diritti dell\'interessato.',
  alternates: {
    canonical: 'https://dreamshop18.com/privacy-policy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Ultimo aggiornamento: 18 giugno 2026</p>

          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              La presente informativa è resa ai sensi degli articoli 13 e 14 del Regolamento (UE)
              2016/679 («GDPR») a tutti coloro che interagiscono con il sito DreamShop
              (di seguito il «Sito») e con i relativi servizi.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Titolare del trattamento</h2>
            <p className="text-gray-700 mb-4">
              Il Titolare del trattamento è <strong>DREAM SHOP S.R.L.</strong>, con sede legale in
              Via Vincenzo Florio 13/L, 95045 Misterbianco (CT), Italia — P.IVA 05812850872.<br />
              Email di contatto per il trattamento dei dati:{' '}
              <a href="mailto:dreamshopfigure@gmail.com" className="text-bred-500 hover:text-bred-600 underline">
                dreamshopfigure@gmail.com
              </a>
            </p>
            <p className="text-gray-700 mb-4">
              Il Titolare non è tenuto alla nomina di un Responsabile della Protezione dei Dati (DPO)
              ai sensi dell&apos;art. 37 GDPR. Per qualsiasi richiesta in materia di privacy è possibile
              scrivere all&apos;indirizzo email sopra indicato.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Tipologie di dati trattati</h2>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Dati anagrafici e di contatto</strong>: nome, cognome, email, telefono, indirizzo di spedizione e fatturazione.</li>
              <li><strong>Dati di account</strong>: credenziali di accesso, cronologia ordini, wishlist, punti fedeltà.</li>
              <li><strong>Dati di pagamento</strong>: gestiti direttamente dai provider di pagamento; il Titolare non memorizza i numeri completi delle carte.</li>
              <li><strong>Dati di navigazione e tecnici</strong>: indirizzo IP, identificativi dei dispositivi, cookie e tecnologie similari (v. <Link href="/cookie-policy" className="text-bred-500 hover:text-bred-600 underline">Cookie Policy</Link>).</li>
              <li><strong>Dati relativi alle comunicazioni</strong>: email inviate al servizio clienti e iscrizione alla newsletter (con prova del consenso: data, ora e indirizzo IP).</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Finalità e basi giuridiche</h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm text-left text-gray-700 border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border-b border-gray-200 font-semibold">Finalità</th>
                    <th className="px-4 py-2 border-b border-gray-200 font-semibold">Base giuridica (art. 6 GDPR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2 border-b border-gray-200">Gestione di ordini, pagamenti, spedizioni e assistenza</td>
                    <td className="px-4 py-2 border-b border-gray-200">Esecuzione del contratto (lett. b)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b border-gray-200">Creazione e gestione dell&apos;account, programma punti, wishlist</td>
                    <td className="px-4 py-2 border-b border-gray-200">Esecuzione del contratto / consenso (lett. b, a)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b border-gray-200">Adempimenti fiscali, contabili e di legge</td>
                    <td className="px-4 py-2 border-b border-gray-200">Obbligo legale (lett. c)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b border-gray-200">Invio della newsletter e comunicazioni promozionali</td>
                    <td className="px-4 py-2 border-b border-gray-200">Consenso (lett. a)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b border-gray-200">Cookie analitici e di marketing</td>
                    <td className="px-4 py-2 border-b border-gray-200">Consenso (lett. a)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b border-gray-200">Sicurezza del Sito e prevenzione frodi</td>
                    <td className="px-4 py-2">Legittimo interesse (lett. f)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Destinatari e responsabili del trattamento</h2>
            <p className="text-gray-700 mb-4">
              Per le finalità sopra indicate i dati possono essere comunicati a soggetti terzi che agiscono
              quali responsabili del trattamento o titolari autonomi, tra cui:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Fornitore di hosting</strong>: Hetzner Online GmbH (Germania, UE).</li>
              <li><strong>Provider di pagamento</strong>: Stripe, PayPal, Satispay, Klarna.</li>
              <li><strong>Corrieri e operatori logistici</strong>: BRT, GLS, Poste Italiane, DHL.</li>
              <li><strong>Provider di email/newsletter</strong>: Brevo (Sendinblue, Francia, UE).</li>
              <li><strong>Strumenti di analisi e marketing</strong>: Google (Google Analytics, Google Tag Manager), Hotjar, Meta Platforms (Facebook Pixel).</li>
              <li>Consulenti, commercialisti e autorità competenti ove previsto dalla legge.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Trasferimento dei dati extra-UE</h2>
            <p className="text-gray-700 mb-4">
              Alcuni fornitori (es. Google, Meta, Stripe, PayPal) possono trattare dati in Paesi al di
              fuori dello Spazio Economico Europeo. In tali casi il trasferimento avviene sulla base di
              garanzie adeguate ai sensi degli artt. 44 e ss. GDPR, in particolare le Clausole
              Contrattuali Standard adottate dalla Commissione Europea e/o meccanismi di adeguatezza
              riconosciuti (es. EU-U.S. Data Privacy Framework).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Periodo di conservazione</h2>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Dati relativi agli ordini e alla fatturazione</strong>: 10 anni, in adempimento agli obblighi fiscali e civilistici.</li>
              <li><strong>Dati dell&apos;account</strong>: fino alla richiesta di cancellazione da parte dell&apos;utente.</li>
              <li><strong>Dati per newsletter/marketing</strong>: fino alla revoca del consenso (disiscrizione).</li>
              <li><strong>Cookie</strong>: secondo i termini indicati nella <Link href="/cookie-policy" className="text-bred-500 hover:text-bred-600 underline">Cookie Policy</Link>.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Diritti dell&apos;interessato</h2>
            <p className="text-gray-700 mb-4">
              In qualità di interessato, ai sensi degli artt. 15-22 GDPR, hai diritto di: accedere ai tuoi
              dati, ottenerne la rettifica o la cancellazione, limitarne od opporti al trattamento,
              richiedere la portabilità dei dati e revocare in qualsiasi momento il consenso prestato
              (senza pregiudicare la liceità del trattamento effettuato prima della revoca).
            </p>
            <p className="text-gray-700 mb-4">
              Per esercitare tali diritti puoi scrivere a{' '}
              <a href="mailto:dreamshopfigure@gmail.com" className="text-bred-500 hover:text-bred-600 underline">
                dreamshopfigure@gmail.com
              </a>. Hai inoltre il diritto di proporre reclamo all&apos;Autorità Garante per la protezione
              dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-bred-500 hover:text-bred-600 underline">www.garanteprivacy.it</a>).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Natura del conferimento dei dati</h2>
            <p className="text-gray-700 mb-4">
              Il conferimento dei dati necessari all&apos;esecuzione del contratto (es. dati per ordine,
              pagamento, spedizione e fatturazione) è obbligatorio: il rifiuto comporta l&apos;impossibilità
              di concludere l&apos;acquisto. Il conferimento dei dati per finalità di marketing e
              newsletter è invece <strong>facoltativo</strong>: il rifiuto o la successiva revoca del
              consenso non pregiudica la fruizione dei servizi di acquisto.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Processo decisionale automatizzato e profilazione</h2>
            <p className="text-gray-700 mb-4">
              Il Titolare <strong>non effettua</strong> processi decisionali automatizzati né attività di
              profilazione ai sensi dell&apos;art. 22 GDPR che producano effetti giuridici sull&apos;interessato.
              Qualora in futuro venissero introdotte tali attività, la presente informativa verrà
              aggiornata e, ove necessario, verrà richiesto un apposito consenso.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">10. Minori</h2>
            <p className="text-gray-700 mb-4">
              Il Sito e i suoi servizi non sono rivolti a minori di 14 anni. I minori non devono fornire
              dati personali senza il consenso di chi esercita la responsabilità genitoriale. Qualora
              venissimo a conoscenza di un trattamento di dati di un minore privo del necessario
              consenso, provvederemo a cancellarli.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">11. Modifiche all&apos;informativa</h2>
            <p className="text-gray-700 mb-4">
              Il Titolare si riserva di modificare o aggiornare la presente informativa, anche in
              conseguenza di variazioni normative. Le modifiche saranno pubblicate su questa pagina con
              l&apos;indicazione della data di ultimo aggiornamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
