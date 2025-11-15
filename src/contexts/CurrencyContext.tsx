import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Currency = 'CZK' | 'EUR' | 'USD';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatPrice: (amount: number) => string;
  convertPrice: (amount: number, fromCurrency?: Currency) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Exchange rates (base: CZK)
const EXCHANGE_RATES = {
  CZK: 1,
  EUR: 0.041, // 1 CZK = 0.041 EUR
  USD: 0.044  // 1 CZK = 0.044 USD
};

// Currency symbols and formatting
const CURRENCY_CONFIG = {
  CZK: { symbol: 'Kč', position: 'after' },
  EUR: { symbol: '€', position: 'after' },
  USD: { symbol: '$', position: 'before' }
};

// Detect user currency based on location/browser
const detectCurrency = (): Currency => {
  // Check localStorage first
  const stored = localStorage.getItem('currency') as Currency;
  if (stored && ['CZK', 'EUR', 'USD'].includes(stored)) {
    return stored;
  }

  // Detect from browser language/location
  const browserLang = navigator.language.toLowerCase();

  // Czech language/region detection
  if (browserLang.includes('cs') || browserLang.includes('cz')) {
    return 'CZK';
  }

  // European languages that commonly use EUR
  const eurCountries = ['de', 'fr', 'es', 'it', 'nl', 'be', 'at', 'fi', 'pt', 'ie', 'gr', 'sk', 'si', 'ee', 'lv', 'lt'];
  if (eurCountries.some(country => browserLang.includes(country))) {
    return 'EUR';
  }

  // Default to USD for other regions
  return 'USD';
};

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>('CZK');

  useEffect(() => {
    const detectedCurrency = detectCurrency();
    setCurrencyState(detectedCurrency);
  }, []);

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('currency', newCurrency);
  };

  const convertPrice = (amount: number, fromCurrency: Currency = 'CZK'): number => {
    // Convert from base currency to CZK first, then to target currency
    const amountInCZK = amount / EXCHANGE_RATES[fromCurrency];
    const convertedAmount = amountInCZK * EXCHANGE_RATES[currency];
    return Math.round(convertedAmount);
  };

  const formatPrice = (amount: number): string => {
    const convertedAmount = convertPrice(amount);
    const config = CURRENCY_CONFIG[currency];

    // Format number with proper separators
    const formattedNumber = new Intl.NumberFormat('cs-CZ').format(convertedAmount);

    if (config.position === 'before') {
      return `${config.symbol}${formattedNumber}`;
    } else {
      return `${formattedNumber} ${config.symbol}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, convertPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};