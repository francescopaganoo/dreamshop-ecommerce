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
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

declare global {
  interface Window {
    doGTranslate: (langPair: string) => void;
    googleTranslateElementInit2: () => void;
    gt_translate_script: HTMLScriptElement;
    google: {
      translate: {
        TranslateElement: {
          new(config: {
            pageLanguage: string;
            autoDisplay: boolean;
          }, elementId: string): void;
        };
      };
    };
  }
}

export default function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('it');
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
    // Helper functions from GTranslate
    function fireEvent(element: HTMLElement, event: string) {
      try {
        // Check if we're in an old IE environment
        if ('fireEvent' in element && typeof (element as HTMLElement & { fireEvent: (event: string, evt: Event) => void }).fireEvent === 'function') {
          const evt = document.createEvent('Event');
          evt.initEvent(event, true, true);
          (element as HTMLElement & { fireEvent: (event: string, evt: Event) => void }).fireEvent('on' + event, evt);
        } else {
          const evt = document.createEvent('HTMLEvents');
          evt.initEvent(event, true, true);
          element.dispatchEvent(evt);
        }
      } catch (e) {
        console.error('Error firing event:', e);
      }
    }

    function getCurrentLang() {
      const keyValue = document.cookie.match('(^|;) ?googtrans=([^;]*)(;|$)');
      return keyValue ? keyValue[2].split('/')[2] : null;
    }

    // Main doGTranslate function from GTranslate
    window.doGTranslate = function(langPair: string) {
      const lang = langPair.split('|')[1];
      
      if (getCurrentLang() == null && lang == langPair.split('|')[0]) return;
      
      let teCombo: HTMLSelectElement | undefined;
      const selects = document.getElementsByTagName('select');
      
      for (let i = 0; i < selects.length; i++) {
        if (selects[i].className.indexOf('goog-te-combo') != -1) {
          teCombo = selects[i] as HTMLSelectElement;
          break;
        }
      }

      const gtElement = document.getElementById('google_translate_element2');
      
      if (gtElement == null || gtElement.innerHTML.length == 0 || !teCombo || teCombo.length == 0 || teCombo.innerHTML.length == 0) {
        setTimeout(() => window.doGTranslate(langPair), 500);
      } else {
        teCombo.value = lang;
        fireEvent(teCombo, 'change');
        // Update React state after successful translation
        setCurrentLang(lang);
      }
    };

    // Google Translate initialization function
    window.googleTranslateElementInit2 = function() {
      new window.google.translate.TranslateElement({
        pageLanguage: 'it',
        autoDisplay: false
      }, 'google_translate_element2');
      
      // After Google Translate loads, check if there's a saved language and apply it
      setTimeout(() => {
        const cookieLang = getCurrentLang();
        if (cookieLang && cookieLang !== 'it' && languages.find(l => l.code === cookieLang)) {
          setCurrentLang(cookieLang);
          // Re-apply the translation
          window.doGTranslate(`it|${cookieLang}`);
        }
      }, 1000);
    };

    // Add hidden Google Translate element and CSS
    if (!document.getElementById('google_translate_element2')) {
      const gtElement = document.createElement('div');
      gtElement.id = 'google_translate_element2';
      gtElement.style.display = 'none';
      document.body.appendChild(gtElement);
    }

    // Add GTranslate CSS
    if (!document.querySelector('.gtranslate-style')) {
      const style = document.createElement('style');
      style.className = 'gtranslate-style';
      style.textContent = `
        div.skiptranslate,#google_translate_element2{display:none!important}
        body{top:0!important}
        font font{background-color:transparent!important;box-shadow:none!important;position:initial!important}
        .goog-te-banner-frame{display:none!important}
        .goog-te-menu-frame{display:none!important}
      `;
      document.head.appendChild(style);
    }

    // Check for saved language preference on component mount
    const cookieLang = getCurrentLang();
    if (cookieLang && languages.find(l => l.code === cookieLang)) {
      setCurrentLang(cookieLang);
      
      // If there's a saved non-Italian language, load Google Translate
      if (cookieLang !== 'it') {
        if (!window.gt_translate_script) {
          const script = document.createElement('script');
          script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit2';
          window.gt_translate_script = script;
          document.body.appendChild(script);
        }
      }
    }

    // Monitor cookie changes (in case other parts of the app change language)
    const checkLanguageChange = () => {
      const cookieLang = getCurrentLang();
      if (cookieLang && cookieLang !== currentLang) {
        setCurrentLang(cookieLang);
      } else if (!cookieLang && currentLang !== 'it') {
        setCurrentLang('it');
      }
    };

    const intervalId = setInterval(checkLanguageChange, 1000);
    return () => clearInterval(intervalId);
  }, [currentLang]);

  const handleLanguageChange = (langCode: string) => {
    setCurrentLang(langCode);
    setIsOpen(false);

    if (langCode === 'it') {
      // Reset to original language
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'googtrans=/auto/it; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Add a small delay before reload to ensure cookies are cleared
      setTimeout(() => {
        window.location.reload();
      }, 100);
      return;
    }

    // Load Google Translate if not loaded
    if (!window.gt_translate_script) {
      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit2';
      window.gt_translate_script = script;
      document.body.appendChild(script);
    }

    // Trigger translation using GTranslate logic
    setTimeout(() => {
      window.doGTranslate(`it|${langCode}`);
    }, 200);
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
    </>
  );
}