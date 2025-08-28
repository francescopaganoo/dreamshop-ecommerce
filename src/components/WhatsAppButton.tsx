"use client";

import { FaWhatsapp } from 'react-icons/fa';

export default function WhatsAppButton() {
  return (
    <a
      href="https://web.whatsapp.com/send?phone=393515029645&text="
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-4 sm:bottom-6 sm:right-6 z-40 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
      aria-label="Contattaci su WhatsApp"
    >
      <FaWhatsapp className="w-5 h-5 sm:w-6 sm:h-6" />
    </a>
  );
}