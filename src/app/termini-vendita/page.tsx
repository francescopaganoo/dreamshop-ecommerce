import { Metadata } from 'next';
import Link from 'next/link';

// BOZZA TECNICA — non ancora validata da un legale.
//
// DATI SOCIETARI: completi (ragione sociale, sede, P.IVA/CF, RI Catania REA 435724,
// capitale sociale, PEC, telefono). Società pluripersonale, non in liquidazione.
//
// PUNTI ANCORA APERTI (da confermare prima della pubblicazione):
//  - [5] Giacenza: il testo rinvia al termine indicato dal corriere perché SDA/BRT/GLS
//    usano termini diversi (in genere 5-10 gg lavorativi). Se si vuole un numero fisso,
//    va verificato sui contratti con i corrieri.
//  - [2.3] Stima del costo di restituzione: da inserire (art. 49 c.1 lett. i Cod. Consumo),
//    soprattutto per le resine spedite dall'estero.
//  - [6.1] Acconto: manca la disciplina del caso in cui il saldo non venga mai pagato
//    (termine, sorte dell'acconto). Attenzione: una clausola di trattenuta automatica
//    sarebbe potenzialmente vessatoria ex art. 33 c.2 lett. e).
//  - [9] ADR: nessun organismo specifico indicato, clausola volutamente generica.
//  - [3] L'esclusione del recesso ex art. 59 lett. c) regge SOLO se le resine sono
//    realmente realizzate su specifica del singolo cliente, non se sono pezzi a
//    catalogo prodotti su ordinazione. Da validare con un legale.
//  - Capitale sociale: indicato come € 5.000,00. Se non è interamente versato va
//    specificata la somma effettivamente versata (art. 2250 c.c.).
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
          <p className="text-sm text-gray-500 mb-8">Ultimo aggiornamento: 2 agosto 2026</p>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[1] Identità del venditore</h2>
            <p className="text-gray-700 mb-4">
              I prodotti presenti su questo sito sono venduti da <strong>DREAM SHOP S.R.L.</strong>,
              con sede legale in <strong>Via Vincenzo Florio 13/L, 95045 Misterbianco (CT), Italia</strong>,
              P.IVA e Codice Fiscale <strong>05812850872</strong>, iscritta al Registro delle Imprese di
              Catania al n. REA <strong>435724</strong>, capitale sociale <strong>€ 5.000,00</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              Email per l&apos;assistenza:{' '}
              <a href="mailto:dreamshopfigure@gmail.com" className="text-blue-600 hover:underline">dreamshopfigure@gmail.com</a>{' '}
              — PEC per le comunicazioni e i reclami formali:{' '}
              <a href="mailto:dreamshop18@pec.it" className="text-blue-600 hover:underline">dreamshop18@pec.it</a>{' '}
              — Telefono: <a href="tel:+393515029645" className="text-blue-600 hover:underline">+39 351 502 9645</a>{' '}
              (raggiungibile anche via WhatsApp).
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
              indicati al punto [1], anche utilizzando il <strong>modulo di recesso tipo</strong> riportato al punto [13].
              L&apos;uso di questi canali alternativi non è obbligatorio.
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
              Sei tenuto a restituire i beni <strong>entro 14 giorni</strong> dal giorno in cui ci hai comunicato il recesso,
              all&apos;indirizzo <strong>DREAM SHOP S.R.L., Via Vincenzo Florio 13/L, 95045 Misterbianco (CT), Italia</strong>.
              Il termine è rispettato se rispedisci i beni prima della scadenza dei 14 giorni. Le istruzioni operative
              per la restituzione ti verranno inviate via email dopo la ricezione della tua dichiarazione.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>I costi diretti di restituzione dei beni sono a tuo carico</strong> e variano in funzione del corriere
              e del servizio che sceglierai.
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
              Poiché il recesso è escluso, l&apos;ordine può essere annullato dopo l&apos;avvio della lavorazione solo con il
              nostro consenso. In tal caso, di comune accordo, potremo trattenere le sole somme corrispondenti ai costi
              già sostenuti e documentati per l&apos;esecuzione dell&apos;ordine, rimborsandoti l&apos;eccedenza; sei sempre libero di
              non accettare tale soluzione e mantenere l&apos;ordine in essere. Restano in ogni caso impregiudicati la
              garanzia legale di conformità e i tuoi diritti in caso di nostro inadempimento.
            </p>
            <p className="text-gray-700 mb-4">
              Ogni resina viene spedita con oneri doganali inclusi nel prezzo; le tempistiche di produzione e consegna
              sono indicative e pari a circa <strong>60 giorni lavorativi</strong>, e il codice di tracciamento si aggiorna
              all&apos;arrivo del prodotto in Europa. Questo termine, indicato nella pagina prodotto e da te accettato al
              momento dell&apos;ordine, costituisce il &laquo;diverso accordo&raquo; di cui al punto [5].
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
              I prodotti a catalogo di marchi ufficiali sono originali e corredati, ove previsti dal produttore, dei
              relativi certificati o bollini di autenticità. Le resine di cui al punto [3] sono invece realizzate
              artigianalmente su specifica del cliente e non sono accompagnate da bollini di autenticità: le loro
              caratteristiche sono descritte nella relativa pagina prodotto.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[5] Spedizione e consegna</h2>
            <p className="text-gray-700 mb-4">
              Le spedizioni sono affidate ai corrieri <strong>SDA, BRT e GLS</strong>, con metodi che variano in base alla
              provenienza della merce; l&apos;informazione è sempre indicata nella pagina prodotto. Tutti i metodi forniscono
              un codice di tracciamento.
            </p>
            <p className="text-gray-700 mb-4">
              Salvo diverso accordo, la consegna avviene <strong>entro 30 giorni</strong> dalla conclusione del contratto.
              Costituiscono diverso accordo, espressamente indicato nella pagina prodotto e da te accettato al momento
              dell&apos;ordine, i termini più lunghi previsti per le <strong>resine</strong> (punto [3]) e per gli articoli in{' '}
              <strong>preordine</strong> (punto [7]), la cui consegna è legata rispettivamente ai tempi di lavorazione e
              alla data di uscita comunicata dalla casa produttrice.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Il rischio di perdita o danneggiamento dei beni passa a te solo nel momento in cui tu, o un terzo da te
              designato diverso dal vettore, acquisisci il possesso fisico dei beni</strong> (art. 63 Cod. Consumo). Eventuali
              danni o smarrimenti occorsi durante il trasporto sono pertanto a nostro carico: in tali casi potrai
              scegliere tra la sostituzione del prodotto e il rimborso.
            </p>
            <p className="text-gray-700 mb-4">
              In caso di mancata consegna con rilascio di avviso di giacenza, il pacco può essere ritirato presso il
              punto designato <strong>entro il termine indicato dal corriere nell&apos;avviso stesso</strong>, decorso il quale
              verrà rispedito al mittente. In questi casi potrai richiedere una nuova spedizione, con i relativi costi
              aggiuntivi a tuo carico, oppure il rimborso del prodotto; in quest&apos;ultima ipotesi le spese di spedizione
              già sostenute non sono rimborsabili, salvo che la mancata consegna dipenda da causa a noi imputabile.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[6] Prezzi e pagamenti</h2>
            <p className="text-gray-700 mb-4">
              Tutti i prezzi indicati sul sito sono comprensivi di IVA. Le eventuali spese di spedizione e gli altri
              costi aggiuntivi ti sono indicati in modo chiaro prima della conclusione dell&apos;ordine e sono riepilogati
              nella schermata finale di pagamento.
            </p>
            <p className="text-gray-700 mb-4">
              Sono accettati i pagamenti tramite <strong>carta di credito e di debito</strong> (circuito Stripe),{' '}
              <strong>PayPal</strong>, <strong>Apple Pay</strong>, <strong>Google Pay</strong>, <strong>Satispay</strong> e{' '}
              <strong>Klarna</strong>. I metodi effettivamente disponibili per il tuo ordine ti vengono mostrati in fase di
              checkout. L&apos;eventuale pagamento dilazionato tramite Klarna è regolato dalle condizioni contrattuali del
              relativo fornitore, che accetti direttamente nei suoi confronti.
            </p>
            <p className="text-gray-700 mb-4">
              Il contratto si intende concluso nel momento in cui ricevi la nostra email di conferma d&apos;ordine.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[6.1] Acquisto con acconto</h3>
            <p className="text-gray-700 mb-4">
              Per alcuni prodotti è possibile concludere l&apos;ordine versando un <strong>acconto</strong> anziché l&apos;intero
              prezzo. La disponibilità di questa modalità, l&apos;importo dell&apos;acconto e l&apos;importo del saldo residuo ti sono
              indicati <strong>nella pagina del prodotto</strong>, prima della conclusione dell&apos;ordine, e sono riepilogati
              nella conferma d&apos;ordine.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Il prodotto viene spedito soltanto dopo il pagamento integrale del prezzo</strong>: fino al versamento
              del saldo l&apos;ordine resta sospeso e la merce non viene consegnata al corriere. Le istruzioni per il
              pagamento del saldo ti vengono comunicate ai recapiti indicati nell&apos;ordine.
            </p>
            <p className="text-gray-700 mb-4">
              Il termine di 14 giorni per il recesso, quando applicabile, decorre in ogni caso dalla consegna del bene e
              non dal versamento dell&apos;acconto.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[6.2] Spedizioni all&apos;estero e oneri doganali</h3>
            <p className="text-gray-700 mb-4">
              Per le spedizioni dirette verso Paesi extra-UE, eventuali <strong>dazi doganali, imposte e oneri di importazione
              sono a carico dell&apos;acquirente</strong> e vengono richiesti dalle autorità del Paese di destinazione al momento
              dello sdoganamento. Fa eccezione quanto previsto al punto [3] per le resine, il cui prezzo è già
              comprensivo degli oneri doganali.
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

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[8] Programma punti</h2>
            <p className="text-gray-700 mb-4">
              Gli acquisti effettuati con un account registrato maturano punti fedeltà, convertibili in uno sconto da
              utilizzare in fase di checkout. Le modalità di accumulo e il valore di conversione sono descritti nella
              pagina <Link href="/programma-punti" className="text-blue-600 hover:underline">Programma punti</Link>.
            </p>
            <p className="text-gray-700 mb-4">
              I punti <strong>non hanno scadenza</strong> finché il tuo account resta attivo. In caso di reso o di recesso, i
              punti eventualmente utilizzati per l&apos;ordine <strong>ti vengono riaccreditati</strong>, mentre i punti maturati con
              quell&apos;ordine vengono corrispondentemente stornati.
            </p>
            <p className="text-gray-700 mb-4">
              I punti non sono convertibili in denaro, non sono cedibili a terzi e non danno diritto ad alcun rimborso
              in denaro.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[9] Assistenza e reclami</h2>
            <p className="text-gray-700 mb-4">
              Per qualsiasi esigenza puoi scriverci a{' '}
              <a href="mailto:dreamshopfigure@gmail.com" className="text-blue-600 hover:underline">dreamshopfigure@gmail.com</a>{' '}
              o contattarci agli altri recapiti indicati al punto [1]. Per i <strong>reclami formali</strong> ti invitiamo a
              utilizzare la PEC{' '}
              <a href="mailto:dreamshop18@pec.it" className="text-blue-600 hover:underline">dreamshop18@pec.it</a>.
              Risponderemo senza indebito ritardo.
            </p>
            <p className="text-gray-700 mb-4">
              In caso di controversia, hai la facoltà di rivolgerti a un organismo di risoluzione alternativa delle
              controversie (ADR) iscritto negli elenchi ufficiali, senza che ciò pregiudichi il tuo diritto di adire
              l&apos;autorità giudiziaria.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[10] Legge applicabile e foro competente</h2>
            <p className="text-gray-700 mb-4">
              Il contratto è regolato dalla legge italiana. Restano in ogni caso applicabili le disposizioni
              inderogabili più favorevoli previste dalla legge dello Stato membro in cui risiedi abitualmente.
            </p>
            <p className="text-gray-700 mb-4">
              Per le controversie con i consumatori è competente in via <strong>esclusiva e inderogabile</strong> il foro del luogo
              di residenza o domicilio elettivo del consumatore (art. 66-bis Cod. Consumo).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[11] Modifiche ai termini e condizioni</h2>
            <p className="text-gray-700 mb-4">
              Ci riserviamo il diritto di modificare i presenti Termini e Condizioni. Le modifiche non hanno effetto
              retroattivo: <strong>a ciascun ordine si applicano i termini vigenti e da te accettati al momento della
              conclusione del contratto</strong>.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[12] Trattamento dei dati personali</h2>
            <p className="text-gray-700 mb-4">
              Il trattamento dei dati personali raccolti nell&apos;ambito del rapporto contrattuale è descritto nella{' '}
              <Link href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link> e nella{' '}
              <Link href="/cookie-policy" className="text-blue-600 hover:underline">Cookie Policy</Link>.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[13] Modulo di recesso tipo</h2>
            <p className="text-gray-700 mb-4">
              Ai sensi dell&apos;Allegato I, parte B, del Codice del Consumo. Compila e restituisci il presente modulo solo
              se desideri recedere dal contratto: il suo utilizzo <strong>non è obbligatorio</strong> e puoi recedere più
              semplicemente dalla tua area riservata, come indicato al punto [2.1].
            </p>
            <div className="border border-gray-300 rounded-md p-6 bg-gray-50 text-gray-700 mb-4">
              <p className="mb-3">
                Destinatario: <strong>DREAM SHOP S.R.L.</strong>, Via Vincenzo Florio 13/L, 95045 Misterbianco (CT), Italia
                — email: dreamshopfigure@gmail.com — PEC: dreamshop18@pec.it
              </p>
              <p className="mb-3">
                Con la presente io/noi (*) notifico/notifichiamo (*) il recesso dal mio/nostro (*) contratto di vendita
                dei seguenti beni/servizi (*):
              </p>
              <p className="mb-3">_______________________________________________</p>
              <p className="mb-3">Ordinato il (*) / ricevuto il (*): ____________________</p>
              <p className="mb-3">Nome del/dei consumatore/i: ____________________</p>
              <p className="mb-3">Indirizzo del/dei consumatore/i: ____________________</p>
              <p className="mb-3">
                Firma del/dei consumatore/i (solo se il presente modulo è notificato in versione cartacea):
                ____________________
              </p>
              <p className="mb-3">Data: ____________________</p>
              <p className="text-sm text-gray-500">(*) Cancellare la dicitura inutile.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
