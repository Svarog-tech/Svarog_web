import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useLanguage, Language } from '../contexts/LanguageContext';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const toggleRef = useRef<HTMLButtonElement>(null);

  const languages = [
    { code: 'cs' as Language, name: 'Čeština', flag: '🇨🇿' },
    { code: 'en' as Language, name: 'English', flag: '🇬🇧' }
  ];

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    setIsOpen(false);
  };

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isOpen && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.right - 200 // 200px is the min-width of dropdown
      });
    }
  }, [isOpen]);

  return (
    <>
      <div className="language-switcher">
        <motion.button
          ref={toggleRef}
          className="language-toggle"
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="language-code">{currentLanguage.code === 'cs' ? 'CZ' : 'EN'}</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={`language-chevron ${isOpen ? 'open' : ''}`}
          />
        </motion.button>
      </div>

      {/* Render dropdown and backdrop in a portal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="language-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
              />

              {/* Dropdown */}
              <motion.div
                className="language-dropdown"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`
                }}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {languages.map((lang) => (
                  <motion.button
                    key={lang.code}
                    className={`language-option ${lang.code === language ? 'active' : ''}`}
                    onClick={() => handleLanguageChange(lang.code)}
                    whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="language-flag">{lang.flag}</span>
                    <span className="language-name">{lang.name}</span>
                    {lang.code === language && (
                      <motion.div
                        className="language-check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                      >
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default LanguageSwitcher;