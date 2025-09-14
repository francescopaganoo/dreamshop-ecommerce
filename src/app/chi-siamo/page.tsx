"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { FaHeart, FaMagic, FaBullseye, FaRocket, FaEnvelope, FaWhatsapp, FaChevronDown } from 'react-icons/fa';

export default function ChiSiamo() {
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };





  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-blue-50 min-h-screen">


      {/* Hero Section */}
      <motion.section
        className="py-20 container mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        <motion.div
          className="text-center mb-16"
          variants={fadeIn}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">La Nostra Storia</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Scopri come siamo diventati il punto di riferimento per i collezionisti di anime e manga
          </p>
        </motion.div>

        <div className="space-y-32">
          {/* Mission Card */}
          <motion.div
            className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white rounded-3xl p-2 shadow-2xl group-hover:shadow-3xl transition-all duration-500">
                  <Image
                    src="/images/chi-siamo-1.webp"
                    alt="La nostra collezione"
                    width={600}
                    height={400}
                    className="w-full h-80 object-cover rounded-2xl"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full px-4 py-2 mb-6">
                <FaBullseye className="w-5 h-5 text-purple-600" />
                <span className="text-purple-800 font-medium text-sm">La nostra missione</span>
              </div>

              <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
                Qualità ed <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Eccellenza</span>
              </h3>

              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                La nostra missione è fornire ai collezionisti una selezione accurata di articoli di alta qualità.
                Tra questi spiccano le nostre <span className="font-semibold text-blue-600">statue in resina</span>, raffinate e ricche di dettagli.
              </p>

              <p className="text-lg text-gray-600 leading-relaxed">
                Offriamo un vasto catalogo delle celebri <span className="font-semibold text-purple-600">figure Bandai</span>,
                note per il design innovativo e la qualità eccezionale, perfette per ogni collezione.
              </p>
            </motion.div>
          </motion.div>

          {/* Offering Card */}
          <motion.div
            className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white rounded-3xl p-2 shadow-2xl group-hover:shadow-3xl transition-all duration-500">
                  <Image
                    src="/images/chi-siamo-2.webp"
                    alt="I nostri prodotti"
                    width={600}
                    height={400}
                    className="w-full h-80 object-cover rounded-2xl"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-100 to-orange-100 rounded-full px-4 py-2 mb-6">
                <FaMagic className="w-5 h-5 text-orange-600" />
                <span className="text-orange-800 font-medium text-sm">La nostra offerta</span>
              </div>

              <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
                Un Mondo di <span className="bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">Possibilità</span>
              </h3>

              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                Non ci fermiamo qui: mettiamo a disposizione anche i popolari <span className="font-semibold text-pink-600">trading card game</span>,
                come Pokémon e Yu-Gi-Oh!, per completare la tua esperienza di gioco.
              </p>

              <p className="text-lg text-gray-600 leading-relaxed">
                Con un occhio sempre attento alle ultime tendenze, abbiamo selezionato un
                <span className="font-semibold text-orange-600"> vastissimo catalogo</span> mirato a soddisfare qualsiasi desiderio.
              </p>
            </motion.div>
          </motion.div>

          {/* Commitment Card */}
          <motion.div
            className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-teal-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white rounded-3xl p-2 shadow-2xl group-hover:shadow-3xl transition-all duration-500">
                  <Image
                    src="/images/chi-siamo-3.webp"
                    alt="Il nostro team"
                    width={600}
                    height={400}
                    className="w-full h-80 object-cover rounded-2xl"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-teal-100 rounded-full px-4 py-2 mb-6">
                <FaHeart className="w-5 h-5 text-teal-600" />
                <span className="text-teal-800 font-medium text-sm">Il nostro impegno</span>
              </div>

              <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
                Al Tuo <span className="bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">Servizio</span>
              </h3>

              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                Siamo qui per aiutarti a trovare i tuoi articoli da collezione preferiti e rendere
                l&apos;esperienza di acquisto <span className="font-semibold text-green-600">facile e veloce</span>.
              </p>

              <p className="text-lg text-gray-600 leading-relaxed">
                Grazie per aver scelto <span className="font-bold text-teal-600">Dream Shop</span>,
                dove la passione per anime e manga prende vita!
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Call to Action */}
      <motion.section
        className="py-20 bg-gray-50"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            {/* Header */}
            <motion.div
              variants={fadeIn}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-bred-100 to-purple-100 rounded-full px-6 py-2 mb-6">
                <FaRocket className="w-5 h-5 text-bred-500" />
                <span className="text-bred-700 font-medium">Inizia la tua avventura</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6 leading-tight">
                Scopri la Nostra
                <span className="bg-gradient-to-r from-bred-500 to-purple-600 bg-clip-text text-transparent"> Collezione</span>
              </h2>

              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Esplora il nostro catalogo completo e trova i pezzi perfetti per la tua collezione.
                <br />
                <span className="font-semibold text-bred-600">Il tuo mondo anime ti aspetta!</span>
              </p>
            </motion.div>

            {/* CTA Cards */}
            <motion.div
              variants={staggerContainer}
              className="grid md:grid-cols-2 gap-8 mb-16"
            >
              {/* Main CTA */}
              <motion.div
                variants={fadeIn}
                className="relative group"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-bred-500 to-purple-500 rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 border border-gray-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-bred-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <FaMagic className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Sfoglia il Catalogo</h3>
                      <p className="text-gray-600 text-sm">Migliaia di prodotti ti aspettano</p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Scopri figure esclusive, statue dettagliate e trading card rari. La tua prossima aggiunta perfetta è qui.
                  </p>
                  <motion.a
                    href="/categories"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-bred-500 to-orange-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 group/btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>Esplora Ora</span>
                    <FaRocket className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
                  </motion.a>
                </div>
              </motion.div>

              {/* Secondary CTA */}
              <motion.div
                variants={fadeIn}
                className="relative group"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 border border-gray-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <FaHeart className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Contattaci</h3>
                      <p className="text-gray-600 text-sm">Siamo qui per aiutarti</p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Hai domande sui prodotti? Cerchi qualcosa di specifico? Il nostro team è pronto ad assisterti.
                  </p>
                  <div className="relative">
                    <motion.button
                      onClick={() => setIsContactDropdownOpen(!isContactDropdownOpen)}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 group/btn"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Scrivici</span>
                      <FaChevronDown className={`w-4 h-4 transition-transform duration-300 ${isContactDropdownOpen ? 'rotate-180' : ''}`} />
                    </motion.button>

                    {/* Dropdown */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{
                        opacity: isContactDropdownOpen ? 1 : 0,
                        y: isContactDropdownOpen ? 0 : -10
                      }}
                      transition={{ duration: 0.2 }}
                      className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 ${
                        isContactDropdownOpen ? 'pointer-events-auto' : 'pointer-events-none'
                      }`}
                    >
                      {/* Email Option */}
                      <motion.a
                        href="mailto:dreamshopfigure@gmail.com"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors duration-200 group"
                        whileHover={{ x: 4 }}
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-200">
                          <FaEnvelope className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors duration-200" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 group-hover:text-blue-600">Email</div>
                          <div className="text-sm text-gray-600">dreamshopfigure@gmail.com</div>
                        </div>
                      </motion.a>

                      {/* Separator */}
                      <div className="border-t border-gray-100"></div>

                      {/* WhatsApp Option */}
                      <motion.a
                        href="https://wa.me/393515029645"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors duration-200 group"
                        whileHover={{ x: 4 }}
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors duration-200">
                          <FaWhatsapp className="w-5 h-5 text-green-600 group-hover:text-white transition-colors duration-200" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 group-hover:text-green-600">WhatsApp</div>
                          <div className="text-sm text-gray-600">Contattaci su WhatsApp</div>
                        </div>
                      </motion.a>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeIn}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
            >
              <p className="text-center text-gray-600 font-medium mb-8">
                Unisciti a migliaia di collezionisti soddisfatti
              </p>

              <div className="grid grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-bred-500 to-purple-500 bg-clip-text text-transparent mb-2">10K+</div>
                  <div className="text-gray-600 text-sm font-medium">Clienti Felici</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent mb-2">500+</div>
                  <div className="text-gray-600 text-sm font-medium">Prodotti</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">4.9★</div>
                  <div className="text-gray-600 text-sm font-medium">Rating</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
