import { Metadata } from 'next';
import Link from 'next/link';

// BOZZA TECNICA — non ancora validata da un legale.
// Contiene placeholder [DA COMPLETARE] con i dati societari obbligatori ex art. 49 Cod. Consumo.
// La sezione [3] Resine si fonda sull'esclusione ex art. 59 lett. c): va confermata da un legale,
// perché regge solo se i beni sono realmente personalizzati su specifica del singolo cliente.
export const metadata: Metadata = {
  title: 'Termini di Vendita | DreamShop',
  description: 'Termini e condizioni di vendita di DreamShop. Diritto di recesso, garanzia legale, spedizioni, resi e politiche di acquisto.',
  alternates: {
    canonical: 'https://dreamshop18.com/termini-vendita',
  },
};

export default function TerminiVenditaPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Termini e condizioni di vendita</h1>
          <p className="text-sm text-gray-500 mb-8">Ultimo aggiornamento: 14 luglio 2026</p>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[1] Identità del venditore</h2>
            <p className="text-gray-700 mb-4">
              I prodotti presenti su questo sito sono venduti da <strong>[DA COMPLETARE: ragione sociale]</strong>,
              con sede legale in <strong>[DA COMPLETARE: indirizzo completo]</strong>,
              P.IVA <strong>[DA COMPLETARE]</strong>, iscritta al Registro delle Imprese di <strong>[DA COMPLETARE]</strong> al n. REA <strong>[DA COMPLETARE]</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              Email: dreamshopfigure@gmail.com — PEC: <strong>[DA COMPLETARE]</strong> — Telefono: <strong>[DA COMPLETARE]</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              Le presenti condizioni si applicano ai contratti a distanza conclusi tramite questo sito con i consumatori,
              ai sensi del Codice del Consumo (D.Lgs. 206/2005) e successive modifiche.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[2] Diritto di recesso</h2>
            <p className="text-gray-700 mb-4">
              Hai il diritto di recedere dal contratto, <strong>senza indicarne le ragioni ed entro 14 giorni</strong>.
              Il periodo di recesso decorre dal giorno in cui tu, o un terzo da te designato diverso dal vettore,
              acquisisci il possesso fisico dei beni. Se l&apos;ordine comprende più beni consegnati separatamente,
              il termine decorre dalla consegna dell&apos;ultimo bene.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[2.1] Come esercitare il recesso</h3>
            <p className="text-gray-700 mb-4">
              Puoi esercitare il recesso direttamente online, in qualsiasi momento entro il termine, tramite l&apos;apposita
              funzione digitale disponibile nella tua area riservata: apri l&apos;ordine che ti interessa e usa il pulsante{' '}
              <strong>&laquo;Recedi qui dal contratto&raquo;</strong>. La funzione è raggiungibile dalla sezione{' '}
              <Link href="/account?tab=orders" className="text-blue-600 hover:underline">I miei ordini</Link>.
            </p>
            <p className="text-gray-700 mb-4">
              Dopo l&apos;invio riceverai <strong>senza indebito ritardo</strong>, all&apos;indirizzo email indicato, una conferma di
              ricevimento su supporto durevole contenente il testo della tua dichiarazione di recesso, con la data e
              l&apos;ora della trasmissione. Il recesso si considera validamente esercitato dal momento della trasmissione
              della dichiarazione.
            </p>
            <p className="text-gray-700 mb-4">
              In alternativa, puoi comunicare la tua decisione con qualsiasi dichiarazione esplicita inviata ai recapiti
              indicati al punto [1], anche utilizzando il <strong>modulo di recesso tipo</strong> di cui all&apos;Allegato I,
              parte B, del Codice del Consumo. L&apos;uso di questi canali alternativi non è obbligatorio.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[2.2] Effetti del recesso</h3>
            <p className="text-gray-700 mb-4">
              Se recedi dal contratto, ti rimborseremo tutti i pagamenti ricevuti, compresi i costi di consegna
              (ad eccezione dei costi supplementari derivanti dalla tua eventuale scelta di un tipo di consegna diverso
              dal tipo meno costoso di consegna standard da noi offerto).
            </p>
            <p className="text-gray-700 mb-4">
              Il rimborso sarà effettuato <strong>senza indebito ritardo e comunque entro 14 giorni</strong> dal giorno in cui
              siamo stati informati della tua decisione di recedere, utilizzando lo stesso mezzo di pagamento da te
              usato per la transazione iniziale, salvo diverso accordo. In ogni caso non sosterrai alcun costo quale
              conseguenza del rimborso.
            </p>
            <p className="text-gray-700 mb-4">
              Il rimborso può essere sospeso fino al ricevimento dei beni, oppure fino a quando non avrai dimostrato di
              averli rispediti, se anteriore.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[2.3] Restituzione dei beni</h3>
            <p className="text-gray-700 mb-4">
              Sei tenuto a restituire i beni <strong>entro 14 giorni</strong> dal giorno in cui ci hai comunicato il recesso.
              Il termine è rispettato se rispedisci i beni prima della scadenza dei 14 giorni. Le istruzioni per la
              restituzione, comprensive dell&apos;indirizzo di reso, ti verranno inviate via email dopo la ricezione della
              tua dichiarazione.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>I costi diretti di restituzione dei beni sono a tuo carico.</strong>
            </p>
            <p className="text-gray-700 mb-4">
              Sei responsabile unicamente della diminuzione del valore dei beni risultante da una manipolazione diversa
              da quella necessaria per stabilirne la natura, le caratteristiche e il funzionamento. In tal caso l&apos;importo
              del rimborso potrà essere proporzionalmente ridotto.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[2.4] Eccezioni al diritto di recesso</h3>
            <p className="text-gray-700 mb-4">
              Ai sensi dell&apos;art. 59 del Codice del Consumo, il diritto di recesso è escluso, tra gli altri, per la
              fornitura di beni confezionati su misura o chiaramente personalizzati su tua specifica richiesta, nonché
              per i beni sigillati che non si prestano ad essere restituiti per motivi igienici e che siano stati aperti
              dopo la consegna. L&apos;eventuale esclusione ti viene sempre indicata nella pagina del prodotto prima
              dell&apos;acquisto.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[3] Resine e prodotti personalizzati</h2>
            <p className="text-gray-700 mb-4">
              <strong>[DA VALIDARE CON IL LEGALE]</strong> Le resine realizzate su specifica del cliente rientrano tra i beni
              confezionati su misura o chiaramente personalizzati e, come tali, sono escluse dal diritto di recesso ai
              sensi dell&apos;art. 59, lett. c), del Codice del Consumo. Tale esclusione è indicata nella pagina prodotto
              prima della conclusione dell&apos;ordine.
            </p>
            <p className="text-gray-700 mb-4">
              In caso di rinuncia all&apos;acquisto dopo l&apos;avvio della lavorazione, potremo trattenere le somme corrispondenti
              ai costi già sostenuti e documentati per l&apos;esecuzione dell&apos;ordine; l&apos;eventuale eccedenza ti sarà rimborsata.
              Restano impregiudicati la garanzia legale di conformità e i tuoi diritti in caso di nostro inadempimento.
            </p>
            <p className="text-gray-700 mb-4">
              Ogni resina viene spedita con oneri doganali inclusi; le tempistiche indicative sono di circa 60 giorni
              lavorativi e il codice di tracciamento si aggiorna all&apos;arrivo del prodotto in Europa.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[4] Garanzia legale di conformità</h2>
            <p className="text-gray-700 mb-4">
              Tutti i prodotti venduti sono coperti dalla <strong>garanzia legale di conformità di 2 anni</strong> dalla consegna,
              prevista dagli artt. 128 e seguenti del Codice del Consumo. In caso di difetto di conformità hai diritto,
              senza spese, al ripristino della conformità del bene mediante <strong>riparazione o sostituzione</strong> e, ove
              ricorrano i presupposti di legge, alla <strong>riduzione del prezzo o alla risoluzione del contratto</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              Per attivare la garanzia è sufficiente contattarci ai recapiti indicati al punto [1], descrivendo il
              difetto e allegando, ove possibile, documentazione fotografica. Ti invitiamo a segnalare eventuali danni
              da trasporto il prima possibile, per agevolare la gestione della pratica con il corriere: la tempestività
              della segnalazione <strong>non è tuttavia condizione di validità della garanzia legale</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              Tutti gli articoli presenti sul sito sono originali e provvisti dei relativi certificati e bollini di
              autenticità.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[5] Spedizione e consegna</h2>
            <p className="text-gray-700 mb-4">
              I pacchi sono spediti con metodi diversi in base alla provenienza della merce; l&apos;informazione è sempre
              indicata nella pagina prodotto. Tutti i metodi forniscono un codice di tracciamento. Salvo diverso accordo,
              la consegna avviene entro 30 giorni dalla conclusione del contratto.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Il rischio di perdita o danneggiamento dei beni passa a te solo nel momento in cui tu, o un terzo da te
              designato diverso dal vettore, acquisisci il possesso fisico dei beni</strong> (art. 63 Cod. Consumo). Eventuali
              danni o smarrimenti occorsi durante il trasporto sono pertanto a nostro carico: in tali casi potrai
              scegliere tra la sostituzione del prodotto e il rimborso.
            </p>
            <p className="text-gray-700 mb-4">
              In caso di mancata consegna con rilascio di avviso di giacenza, il pacco può essere ritirato presso il
              punto designato entro 30 giorni, decorsi i quali verrà rispedito al mittente. In questi casi potrai
              richiedere una nuova spedizione con costi aggiuntivi, oppure il rimborso del prodotto.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[6] Prezzi e pagamenti</h2>
            <p className="text-gray-700 mb-4">
              Tutti i prezzi indicati sul sito sono comprensivi di IVA. Le eventuali spese di spedizione e gli altri
              costi aggiuntivi ti sono indicati in modo chiaro prima della conclusione dell&apos;ordine e sono riepilogati
              nella schermata finale di pagamento.
            </p>
            <p className="text-gray-700 mb-4">
              Sono accettati i pagamenti tramite carta di credito, PayPal e gli ulteriori metodi indicati in fase di
              checkout. Il contratto si intende concluso nel momento in cui ricevi la nostra email di conferma d&apos;ordine.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[7] Articoli in preordine</h2>
            <p className="text-gray-700 mb-4">
              Le date di uscita indicate nella pagina prodotto sono <strong>indicative</strong>, in quanto soggette a posticipi
              da parte della casa produttrice. Ti informeremo tempestivamente di eventuali ritardi significativi.
            </p>
            <p className="text-gray-700 mb-4">
              Qualora la fornitura risultasse impossibile, ti comunicheremo la cancellazione del preordine e
              provvederemo al rimborso integrale di quanto versato, senza indebito ritardo.
            </p>
            <p className="text-gray-700 mb-4">
              L&apos;acquisto in preordine non pregiudica il tuo diritto di recesso, che decorre in ogni caso dalla consegna
              del bene.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[8] Assistenza e reclami</h2>
            <p className="text-gray-700 mb-4">
              Per qualsiasi esigenza puoi contattarci ai recapiti indicati al punto [1]. Risponderemo ai reclami senza
              indebito ritardo.
            </p>
            <p className="text-gray-700 mb-4">
              In caso di controversia, hai la facoltà di rivolgerti a un organismo di risoluzione alternativa delle
              controversie (ADR) iscritto negli elenchi ufficiali, senza che ciò pregiudichi il tuo diritto di adire
              l&apos;autorità giudiziaria.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[9] Legge applicabile e foro competente</h2>
            <p className="text-gray-700 mb-4">
              Il contratto è regolato dalla legge italiana. Restano in ogni caso applicabili le disposizioni
              inderogabili più favorevoli previste dalla legge dello Stato membro in cui risiedi abitualmente.
            </p>
            <p className="text-gray-700 mb-4">
              Per le controversie con i consumatori è competente in via <strong>esclusiva e inderogabile</strong> il foro del luogo
              di residenza o domicilio elettivo del consumatore (art. 66-bis Cod. Consumo).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[10] Modifiche ai termini e condizioni</h2>
            <p className="text-gray-700 mb-4">
              Ci riserviamo il diritto di modificare i presenti Termini e Condizioni. Le modifiche non hanno effetto
              retroattivo: <strong>a ciascun ordine si applicano i termini vigenti e da te accettati al momento della
              conclusione del contratto</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
