"use client";

import { FaGlobe } from 'react-icons/fa';
import { useEffect } from 'react';

declare global {
  interface Window {
    google: {
      translate: {
        TranslateElement: {
          new(options: {
            pageLanguage: string;
            includedLanguages: string;
            layout: number;
            autoDisplay: boolean;
          }, elementId: string): void;
          InlineLayout: {
            SIMPLE: number;
          };
        };
      };
    };
    googleTranslateElementInit: () => void;
  }
}

export default function LanguageSelector() {
  useEffect(() => {
    // Check if Google Translate is already loaded
    if (window.google && window.google.translate) {
      initializeTranslate();
      return;
    }

    // Load Google Translate script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    
    // Define the initialization function
    window.googleTranslateElementInit = () => {
      initializeTranslate();
    };
    
    // Append script to head
    document.head.appendChild(script);

    function initializeTranslate() {
      const element = document.getElementById('google_translate_element');
      if (element && window.google && window.google.translate) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'it',
          includedLanguages: 'en,fr,de,es,pt,ru,ja,zh,ar',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      } else {
        // Retry after a short delay
        setTimeout(initializeTranslate, 500);
      }
    }

    // Custom styling for Google Translate widget
    const style = document.createElement('style');
    style.innerHTML = `
      #google_translate_element {
        display: inline-block;
      }
      
      #google_translate_element .goog-te-combo {
        background: transparent;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
        outline: none;
        transition: all 0.3s ease;
      }
      
      #google_translate_element .goog-te-combo:hover {
        border-color: #d1d5db;
        background: #f9fafb;
      }
      
      #google_translate_element .goog-te-combo:focus {
        border-color: #dc2626;
        ring: 2px;
        ring-color: rgba(220, 38, 38, 0.1);
      }
      
      .goog-te-gadget {
        font-family: inherit !important;
        font-size: 0 !important;
      }
      
      .goog-te-gadget .goog-te-combo {
        margin: 0 !important;
        vertical-align: top;
      }
      
      .goog-logo-link {
        display: none !important;
      }
      
      .goog-te-gadget {
        color: transparent !important;
      }
      
      .goog-te-gadget .goog-te-combo {
        color: #374151 !important;
      }
      
      .skiptranslate > div {
        display: none !important;
      }
      
      /* Hide Google Translate banner */
      .goog-te-banner-frame {
        display: none !important;
      }
      
      body {
        top: 0 !important;
      }
      
      #google_translate_element .goog-te-gadget-simple {
        background-color: transparent;
        border: none;
        font-size: 0;
        display: inline-block;
        padding: 0;
        border-radius: 0;
        cursor: pointer;
      }
      
      #google_translate_element .goog-te-gadget-simple a {
        text-decoration: none;
        color: #374151;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: white;
        transition: all 0.3s ease;
      }
      
      #google_translate_element .goog-te-gadget-simple a:hover {
        border-color: #d1d5db;
        background: #f9fafb;
      }
      
      #google_translate_element .goog-te-gadget-simple .goog-te-menu-value span {
        color: #374151;
        font-size: 0.875rem;
      }
      
      #google_translate_element .goog-te-gadget-simple .goog-te-menu-value span:first-child {
        display: none;
      }
      
      @media (max-width: 768px) {
        #google_translate_element .goog-te-gadget-simple a {
          padding: 0.4rem 0.6rem;
          font-size: 0.8rem;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      // Cleanup
      if (style.parentNode) {
        document.head.removeChild(style);
      }
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="flex items-center">
      <div className="flex items-center mr-2 text-white">
        <FaGlobe className="w-4 h-4" />
      </div>
      <div id="google_translate_element" className="text-sm"></div>
    </div>
  );
}