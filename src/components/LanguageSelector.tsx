"use client";

import { FaGlobe, FaChevronDown } from 'react-icons/fa';
import { useState, useRef, useEffect } from 'react';

const languages = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

declare global {
  interface Window {
    google: {
      translate: {
        TranslateElement: {
          new(options: any, elementId: string): void;
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
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('it');
  const [isTranslateLoaded, setIsTranslateLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Load Google Translate script only once
    if (!window.google?.translate && !isTranslateLoaded) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement({
          pageLanguage: 'it',
          includedLanguages: 'en,fr,de,es,pt,ru,ja,zh,ar',
          autoDisplay: false,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
        }, 'google_translate_element');
        setIsTranslateLoaded(true);
      };
      
      document.head.appendChild(script);
    }

    // Add custom styles to hide Google branding and style the widget
    const style = document.createElement('style');
    style.innerHTML = `
      #google_translate_element { display: none !important; }
      .goog-te-banner-frame { display: none !important; }
      .goog-te-menu-frame { display: none !important; }
      body { top: 0 !important; }
      .skiptranslate { display: none !important; }
    `;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    };
  }, [isTranslateLoaded]);

  const handleLanguageChange = (langCode: string) => {
    setCurrentLang(langCode);
    setIsOpen(false);

    if (langCode === 'it') {
      // Restore original language
      const translateFrame = document.querySelector('.goog-te-menu-frame');
      if (translateFrame) {
        // Find and click the "Original" option
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
      return;
    }

    // Wait for Google Translate to load
    const waitForTranslate = () => {
      if (window.google?.translate) {
        // Programmatically trigger translation
        const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (selectElement) {
          selectElement.value = langCode;
          selectElement.dispatchEvent(new Event('change'));
        } else {
          // Fallback: try to trigger translation manually
          const translateElements = document.querySelectorAll('*:not(script):not(style):not(noscript)');
          translateElements.forEach((element) => {
            if (element.textContent && element.children.length === 0) {
              // This is a text node, we would need translation API here
              // For now, we'll use a simpler approach
            }
          });
        }
      } else if (isTranslateLoaded) {
        setTimeout(waitForTranslate, 100);
      }
    };

    waitForTranslate();
  };

  const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0];

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center text-white hover:text-gray-200 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-white/10"
          aria-label="Seleziona lingua"
        >
          <FaGlobe className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium hidden sm:inline">{currentLanguage.flag}</span>
          <FaChevronDown className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
            <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
              Traduci pagina
            </div>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-3 ${
                  currentLang === lang.code ? 'bg-gray-50 text-bred-600' : 'text-gray-700'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Hidden Google Translate element */}
      <div id="google_translate_element" style={{ display: 'none' }}></div>
    </>
  );
}