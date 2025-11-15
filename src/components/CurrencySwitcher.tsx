import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useCurrency, Currency } from '../contexts/CurrencyContext';
import './CurrencySwitcher.css';

const CurrencySwitcher: React.FC = () => {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);

  const currencies = [
    { code: 'CZK' as Currency, name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
    { code: 'EUR' as Currency, name: 'Euro', symbol: '€', flag: '🇪🇺' },
    { code: 'USD' as Currency, name: 'US Dollar', symbol: '$', flag: '🇺🇸' }
  ];

  const currentCurrency = currencies.find(curr => curr.code === currency) || currencies[0];

  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setIsOpen(false);
  };

  return (
    <div className="currency-switcher">
      <motion.button
        className="currency-toggle"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="currency-symbol">{currentCurrency.symbol}</span>
        <span className="currency-code">{currentCurrency.code}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`currency-chevron ${isOpen ? 'open' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="currency-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              className="currency-dropdown"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {currencies.map((curr) => (
                <motion.button
                  key={curr.code}
                  className={`currency-option ${curr.code === currency ? 'active' : ''}`}
                  onClick={() => handleCurrencyChange(curr.code)}
                  whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="currency-flag">{curr.flag}</span>
                  <div className="currency-info">
                    <span className="currency-name">{curr.name}</span>
                    <span className="currency-detail">{curr.symbol} {curr.code}</span>
                  </div>
                  {curr.code === currency && (
                    <motion.div
                      className="currency-check"
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
      </AnimatePresence>
    </div>
  );
};

export default CurrencySwitcher;