"use client";

import { motion } from 'framer-motion';
import { FaCoins, FaGift, FaShoppingCart, FaCalculator, FaStar, FaRocket } from 'react-icons/fa';
import Link from 'next/link';

export default function ProgrammaPunti() {
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

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-yellow-50 min-h-screen">
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
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-full px-6 py-2 mb-6">
            <FaCoins className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 font-medium">Programma Fedeltà</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Accumula Punti, <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Risparmia</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ogni acquisto ti premia! Scopri come funziona il nostro programma punti e inizia a risparmiare sui tuoi prossimi ordini.
          </p>
        </motion.div>

        {/* How it works - Main Cards */}
        <div className="space-y-20">
          {/* Card 1 - Guadagna Punti */}
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
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white rounded-3xl p-8 shadow-2xl group-hover:shadow-3xl transition-all duration-500">
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="w-32 h-32 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                        <FaShoppingCart className="w-16 h-16 text-white" />
                      </div>
                      <motion.div
                        className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <span className="text-white font-bold text-lg">+1</span>
                      </motion.div>
                    </div>
                  </div>
                  <div className="text-center mt-8">
                    <div className="text-6xl font-black bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                      1€ = 1 Punto
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-full px-4 py-2 mb-6">
                <FaShoppingCart className="w-5 h-5 text-orange-600" />
                <span className="text-orange-800 font-medium text-sm">Come guadagnare</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
                Ogni Euro Speso <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Ti Premia</span>
              </h2>

              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                Il meccanismo è semplice: per <span className="font-semibold text-yellow-600">ogni euro speso</span> sul nostro store,
                guadagni automaticamente <span className="font-semibold text-orange-600">1 punto fedeltà</span>.
              </p>

              <p className="text-lg text-gray-600 leading-relaxed">
                I punti vengono accreditati sul tuo account dopo il completamento dell&apos;ordine.
                Puoi controllare il tuo saldo punti in qualsiasi momento dalla tua area personale.
              </p>
            </motion.div>
          </motion.div>

          {/* Card 2 - Valore Punti */}
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
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white rounded-3xl p-8 shadow-2xl group-hover:shadow-3xl transition-all duration-500">
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="w-32 h-32 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                        <FaGift className="w-16 h-16 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-8">
                    <div className="text-5xl md:text-6xl font-black bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                      100 Punti = 1€
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="w-full lg:w-1/2"
              variants={fadeIn}
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full px-4 py-2 mb-6">
                <FaGift className="w-5 h-5 text-emerald-600" />
                <span className="text-emerald-800 font-medium text-sm">Valore dei punti</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
                Converti in <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">Sconti Reali</span>
              </h2>

              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                Ogni punto ha un valore di <span className="font-semibold text-green-600">0,01€</span>.
                Questo significa che con <span className="font-semibold text-emerald-600">100 punti</span> ottieni 1€ di sconto!
              </p>

              <p className="text-lg text-gray-600 leading-relaxed">
                Puoi utilizzare i tuoi punti durante il checkout per ridurre il totale del tuo ordine.
                I punti non hanno scadenza finché il tuo account è attivo.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Calculator Section */}
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
            <motion.div
              variants={fadeIn}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full px-6 py-2 mb-6">
                <FaCalculator className="w-5 h-5 text-purple-600" />
                <span className="text-purple-800 font-medium">Esempi Pratici</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                Quanto <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Risparmi?</span>
              </h2>
            </motion.div>

            {/* Examples Grid */}
            <motion.div
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-6 mb-12"
            >
              {/* Example 1 */}
              <motion.div
                variants={scaleIn}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">50€</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Ordine da 50€</h3>
                  <div className="space-y-2 text-gray-600">
                    <p>Guadagni: <span className="font-bold text-yellow-600">50 punti</span></p>
                    <p>Valore: <span className="font-bold text-green-600">0,50€</span></p>
                  </div>
                </div>
              </motion.div>

              {/* Example 2 */}
              <motion.div
                variants={scaleIn}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">100€</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Ordine da 100€</h3>
                  <div className="space-y-2 text-gray-600">
                    <p>Guadagni: <span className="font-bold text-yellow-600">100 punti</span></p>
                    <p>Valore: <span className="font-bold text-green-600">1,00€</span></p>
                  </div>
                </div>
              </motion.div>

              {/* Example 3 */}
              <motion.div
                variants={scaleIn}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">200€</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Ordine da 200€</h3>
                  <div className="space-y-2 text-gray-600">
                    <p>Guadagni: <span className="font-bold text-yellow-600">200 punti</span></p>
                    <p>Valore: <span className="font-bold text-green-600">2,00€</span></p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Summary Box */}
            <motion.div
              variants={fadeIn}
              className="bg-gradient-to-r from-bred-500 to-purple-600 rounded-2xl p-8 text-white text-center"
            >
              <FaStar className="w-12 h-12 mx-auto mb-4 text-yellow-300" />
              <h3 className="text-2xl font-bold mb-4">Riepilogo del Programma</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-3xl font-black mb-2">1€ = 1 Punto</div>
                  <p className="text-white/80">Ogni euro speso</p>
                </div>
                <div>
                  <div className="text-3xl font-black mb-2">0,01€</div>
                  <p className="text-white/80">Valore di ogni punto</p>
                </div>
                <div>
                  <div className="text-3xl font-black mb-2">100 Punti = 1€</div>
                  <p className="text-white/80">Conversione facile</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="py-20"
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
            className="max-w-3xl mx-auto text-center"
          >
            <motion.div variants={fadeIn}>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-bred-100 to-purple-100 rounded-full px-6 py-2 mb-6">
                <FaRocket className="w-5 h-5 text-bred-500" />
                <span className="text-bred-700 font-medium">Inizia Ora</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                Pronto a <span className="bg-gradient-to-r from-bred-500 to-purple-600 bg-clip-text text-transparent">Guadagnare Punti?</span>
              </h2>

              <p className="text-xl text-gray-600 mb-8">
                Crea un account o accedi per iniziare ad accumulare punti con ogni acquisto!
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/categories"
                    className="inline-flex items-center gap-2 bg-bred-500 hover:bg-bred-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <FaShoppingCart className="w-5 h-5" />
                    <span>Inizia lo Shopping</span>
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/account"
                    className="inline-flex items-center gap-2 bg-white text-gray-800 font-bold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200"
                  >
                    <FaCoins className="w-5 h-5 text-yellow-500" />
                    <span>Vedi i Tuoi Punti</span>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
