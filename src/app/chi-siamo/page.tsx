"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function ChiSiamo() {
  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3
      }
    }
  };

  return (
    <div className="bg-white">



      {/* Hero Section */}
      <motion.section 
        className="py-16 md:py-24 container mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        <motion.div 
          className="max-w-4xl mx-auto text-center mb-16"
          variants={fadeIn}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">DreamShop18</h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Benvenuto su Dream Shop, il tuo punto di riferimento per il collezionismo di anime e manga!
            Siamo un&apos;azienda leader nel settore, appassionati per l&apos;animazione giapponese e del mondo manga, che si impegna ad offrire prodotti esclusivi a prezzi competitivi.
          </p>
        </motion.div>

        {/* Image and Text Sections */}
        <div className="space-y-24">
          {/* First Section */}
          <motion.div 
            className="flex flex-col md:flex-row items-center gap-8 md:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div 
              className="w-full md:w-1/2 rounded-lg overflow-hidden shadow-xl"
              variants={fadeIn}
            >
              <Image 
                src="/images/chi-siamo-1.webp" 
                alt="La nostra collezione" 
                width={600} 
                height={400} 
                className="w-full h-auto object-cover"
              />
            </motion.div>
            <motion.div 
              className="w-full md:w-1/2"
              variants={fadeIn}
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-4">La nostra missione</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                La nostra missione è fornire ai collezionisti una selezione accurata di articoli di alta qualità.
                Tra questi spiccano le nostre statue in resina, raffinate e ricche di dettagli, ideali per soddisfare anche i collezionisti più esigenti.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Offriamo, inoltre, un vasto catalogo delle celebri figure Bandai, note per il loro design innovativo e la qualità eccezionale, perfette per arricchire ogni collezione.
              </p>
            </motion.div>
          </motion.div>

          {/* Second Section */}
          <motion.div 
            className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div 
              className="w-full md:w-1/2 rounded-lg overflow-hidden shadow-xl"
              variants={fadeIn}
            >
              <Image 
                src="/images/chi-siamo-2.webp" 
                alt="I nostri prodotti" 
                width={600} 
                height={400} 
                className="w-full h-auto object-cover"
              />
            </motion.div>
            <motion.div 
              className="w-full md:w-1/2"
              variants={fadeIn}
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-4">La nostra offerta</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Ma non ci fermiamo qui: mettiamo a disposizione anche i popolari trading card game, come Pokémon e Yu-Gi-Oh!, per completare la tua esperienza di gioco e collezionismo.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Con un occhio sempre attento alle ultime tendenze del mercato e alle richieste dei nostri clienti, abbiamo selezionato accuratamente un vastissimo catalogo, mirato a soddisfare qualsiasi desiderio.
              </p>
            </motion.div>
          </motion.div>

          {/* Third Section */}
          <motion.div 
            className="flex flex-col md:flex-row items-center gap-8 md:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div 
              className="w-full md:w-1/2 rounded-lg overflow-hidden shadow-xl"
              variants={fadeIn}
            >
              <Image 
                src="/images/chi-siamo-3.webp" 
                alt="Il nostro team" 
                width={600} 
                height={400} 
                className="w-full h-auto object-cover"
              />
            </motion.div>
            <motion.div 
              className="w-full md:w-1/2"
              variants={fadeIn}
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Il nostro impegno</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Siamo qui per aiutarti a trovare i tuoi articoli da collezione preferiti e rendere l&apos;esperienza di acquisto in modo facile e veloce.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Grazie per aver scelto Dream Shop, dove passione per anime e manga prende vita!
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Call to Action */}
      <motion.section 
        className="py-16 bg-bred-50"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Scopri la nostra collezione</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Esplora il nostro catalogo completo e trova i pezzi perfetti per la tua collezione.
          </p>
          <a 
            href="/categories" 
            className="inline-block bg-bred-500 hover:bg-bred-600 text-white font-bold py-3 px-8 rounded-md transition-colors duration-300"
          >
            Sfoglia il catalogo
          </a>
        </div>
      </motion.section>
    </div>
  );
}
