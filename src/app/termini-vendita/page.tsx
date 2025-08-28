import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termini di Vendita - Dream Shop',
  description: 'Termini e condizioni di vendita di Dream Shop',
};

export default function TerminiVenditaPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Termini e condizioni</h1>
          
          <div className="prose prose-lg max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[1] Tempistiche di spedizione</h2>
            <p className="text-gray-700 mb-4">
              I pacchi possono essere spediti tramite diversi metodi di spedizione in base alla provenienza della merce tale informazione sarà sempre indicata nella pagina prodotto. I metodi disponibili. Il luogo di spedizione può variare in base alle offerte correnti e alla disponibilità dei prodotti. Tutti i metodi di spedizione forniscono i relativi codici di tracciamento per cui sarà possibile seguire lo stato della Vostra spedizione tramite il sito del corriere o dall'applicazione 17TRACK.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[1.2]</h3>
            <p className="text-gray-700 mb-4">
              Ricordiamo ai Gentili Clienti che tutti gli articoli presenti sul sito sono originali e provvisti di relativi certificati e bollini di autenticità.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[1.3]</h3>
            <p className="text-gray-700 mb-4">
              Nel caso di mancata consegna, seguito dal rilascio dei corrispettivi avvisi di giacenza, il pacco potrà essere ritirato personalmente presso l'Ufficio Postale designato entro e non oltre i 30 gg, al termine dei quali il pacco verrà rispedito al mittente. In questi casi si potrà richiedere una spedizione supplementare con costi aggiuntivi oppure il rimborso del prodotto al quale verranno sottratti i costi della spedizione iniziale. Qualora il pacco venga smarrito il cliente avrà la possibilità di scegliere un articolo sostitutivo o in caso di mancata disponibilità il rimborso totale del prodotto smarrito, la pratica di smarrimento dovrà essere aperta entro 14 giorni dalla consegna prevista del ordine.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[2] Politica di reso</h2>
            <p className="text-gray-700 mb-4">
              Gli ordini sul sito possono essere annullati finché si trovano in stato di lavorazione e non oltre 30 giorni. Quando l'ordine risulterà inoltrato al fornitore o trascorsi 30 giorni non sarà più possibile richiedere il rimborso.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[2.1]</h3>
            <p className="text-gray-700 mb-4">
              La sostituzione degli articoli può avvenire solo a seguito di danneggiamento previo trasporto o di significativi errori di produzione, quest'ultimi dovranno essere comunicati entro 3 giorni dal ricevimento del prodotto. Per gli oggetti, invece, con leggere imperfezioni non è possibile effettuare il reso.
              Nel caso in cui il box contenitivo venisse danneggiato, a seguito del trasporto o cause terze, non è possibile chiedere la sostituzione e/o il rimborso. In caso di smarrimento ogni pacco è assicurato dando la possibilità al cliente di richiedere una nuova spedizione o il rimborso di quest'ultimo.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[3] Resine</h2>
            <p className="text-gray-700 mb-4">
              Per l'acquisto delle Resine non è possibile effettuare il rimborso delle rate versate e/o di eventuali acconti.
              Qualora non si fosse più interessati all'acquisto della Resina è possibile sospendere la spesa con la perdita totale dell'importo precedentemente versato.
              Nel caso in cui si dovesse cambiare idea, circa l'acquisto del prodotto, non è possibile trasferire il saldo per l'acquisto di un articolo differente.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[3.1] Spedizioni</h3>
            <p className="text-gray-700 mb-4">
              Ogni resina verrà spedita utilizzando l'opzione Tax Free includendo tutti gli oneri doganali, le tempistiche son di circa 60 giorni lavorativi, il codice di tracciamento fornirà un aggiornamento non appena il prodotto si troverà in Europa.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">[3.2]</h3>
            <p className="text-gray-700 mb-4">
              In caso di danneggiamenti alle Resine Dream Shop si occuperà direttamente della riparazione o nel caso in cui sia possibile metterà in contatto il cliente tempestivamente con la ditta di fabbricazione, la quale gestirà il caso secondo le Proprie politiche aziendali o si occuperà direttamente della riparazione, in caso di danni quest'ultimi devono essere comunicati entro 3 giorni dal ricevimento del prodotto.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[4] Pagamenti</h2>
            <p className="text-gray-700 mb-4">
              Il sito Dream Shop offre metodi di pagamento sicuri tramite PayPal o attraverso carte di credito.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[5] Supporto tecnico</h2>
            <p className="text-gray-700 mb-4">
              Per qualsiasi esigenza il team di Dream Shop sarà a vostra completa disposizione. Potete mettervi in contatto tramite le nostre pagine social Facebook ed Instagram oppure all'indirizzo email dreamshopfigure@gmail.com
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[6] Articoli in preorder</h2>
            <p className="text-gray-700 mb-4">
              Tutte le date di uscita indicate nella pagina prodotto sono puramente indicative in quanto soggette a posticipi o ritardi della casa madre.
            </p>
            
            <p className="text-gray-700 mb-4">
              Offriamo ai nostri clienti la possibilità di effettuare preordini per prodotti non ancora disponibili in stock. Effettuando un preordine, accetti le seguenti condizioni:
            </p>

            <p className="text-gray-700 mb-4">
              <strong>Nessuna Garanzia di Consegna:</strong> Non possiamo garantire la consegna dei prodotti preordinati entro una data specifica. La consegna dipende dalla disponibilità del prodotto da parte dei nostri fornitori.
            </p>
            
            <p className="text-gray-700 mb-4">
              <strong>Ritardi e Cancellazioni:</strong> In caso di ritardi significativi o impossibilità di fornitura da parte dei nostri fornitori, ci riserviamo il diritto di cancellare il preordine e rimborsare l'importo pagato.
            </p>
            
            <p className="text-gray-700 mb-4">
              <strong>Svincolo di Responsabilità:</strong> Non siamo responsabili per eventuali danni, perdite o inconvenienti derivanti da ritardi o mancata consegna dei prodotti preordinati.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Limitazione di Responsabilità</h3>
            <p className="text-gray-700 mb-4">
              In nessun caso saremo responsabili per danni indiretti, incidentali, speciali, consequenziali o punitivi, inclusi, senza limitazione, perdita di profitti, dati, uso, avviamento o altre perdite intangibili, derivanti da:
            </p>
            
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>L'uso o l'incapacità di usare il nostro sito web;</li>
              <li>Qualsiasi preordine effettuato tramite il nostro sito web;</li>
              <li>L'inadempimento da parte dei fornitori di consegnare i prodotti preordinati.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">[7] Modifica ai termini e condizioni</h2>
            <p className="text-gray-700 mb-4">
              Ci riserviamo il diritto di modificare questi Termini e Condizioni in qualsiasi momento. Le modifiche entreranno in vigore dal momento della pubblicazione sul nostro sito web. Continuando a utilizzare il nostro sito web dopo tali modifiche, accetti di essere vincolato dai Termini e Condizioni modificati.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Legge Applicabile</h3>
            <p className="text-gray-700 mb-4">
              Questi Termini e Condizioni sono regolati e interpretati secondo le leggi del [Tuo Paese]. Eventuali controversie saranno risolte esclusivamente dai tribunali competenti del [Tuo Paese].
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Contatti</h3>
            <p className="text-gray-700 mb-4">
              Per qualsiasi domanda o chiarimento riguardante questi Termini e Condizioni, puoi contattarci all'indirizzo email: dreamshopfigure@gmail.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}