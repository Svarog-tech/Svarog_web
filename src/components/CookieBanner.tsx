import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCookie, faTimes, faCog } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import './CookieBanner.css';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieBanner: React.FC = () => {
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      // Show banner after a short delay
      setTimeout(() => {
        setShowBanner(true);
      }, 1000);
    } else {
      // Load saved preferences
      try {
        const savedPrefs = JSON.parse(cookieConsent);
        setPreferences(savedPrefs);
      } catch (e) {
        setShowBanner(true);
      }
    }
  }, []);

  const setCookieConsent = (prefs: CookiePreferences) => {
    localStorage.setItem('cookieConsent', JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);

    // Initialize analytics based on preferences
    if (prefs.analytics) {
      // Here you would initialize Google Analytics or other analytics
      console.log('Analytics cookies accepted');
    }

    if (prefs.marketing) {
      // Here you would initialize marketing cookies
      console.log('Marketing cookies accepted');
    }
  };

  const acceptAll = () => {
    setCookieConsent({
      necessary: true,
      analytics: true,
      marketing: true
    });
  };

  const acceptNecessary = () => {
    setCookieConsent({
      necessary: true,
      analytics: false,
      marketing: false
    });
  };

  const saveSettings = () => {
    setCookieConsent(preferences);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="cookie-banner-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="cookie-banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {!showSettings ? (
              // Main banner
              <div className="cookie-banner-content">
                <div className="cookie-banner-header">
                  <FontAwesomeIcon icon={faCookie} className="cookie-icon" />
                  <h3>{t('cookies.title')}</h3>
                </div>

                <p className="cookie-banner-text">
                  {t('cookies.description')}
                </p>

                <div className="cookie-banner-actions">
                  <motion.button
                    className="cookie-btn cookie-btn-primary"
                    onClick={acceptAll}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t('cookies.accept')}
                  </motion.button>

                  <motion.button
                    className="cookie-btn cookie-btn-secondary"
                    onClick={() => setShowSettings(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FontAwesomeIcon icon={faCog} />
                    {t('cookies.settings')}
                  </motion.button>

                  <motion.button
                    className="cookie-btn cookie-btn-text"
                    onClick={acceptNecessary}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t('cookies.decline')}
                  </motion.button>
                </div>
              </div>
            ) : (
              // Settings panel
              <div className="cookie-settings">
                <div className="cookie-settings-header">
                  <h3>{t('cookies.settingsTitle')}</h3>
                  <motion.button
                    className="cookie-close"
                    onClick={() => setShowSettings(false)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </motion.button>
                </div>

                <div className="cookie-categories">
                  <div className="cookie-category">
                    <div className="cookie-category-header">
                      <label className="cookie-toggle">
                        <input
                          type="checkbox"
                          checked={preferences.necessary}
                          disabled
                          onChange={() => {}}
                        />
                        <span className="cookie-toggle-slider"></span>
                      </label>
                      <div>
                        <h4>{t('cookies.necessary')}</h4>
                        <p>{t('cookies.necessaryDescription')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="cookie-category">
                    <div className="cookie-category-header">
                      <label className="cookie-toggle">
                        <input
                          type="checkbox"
                          checked={preferences.analytics}
                          onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                        />
                        <span className="cookie-toggle-slider"></span>
                      </label>
                      <div>
                        <h4>{t('cookies.analytics')}</h4>
                        <p>{t('cookies.analyticsDescription')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="cookie-category">
                    <div className="cookie-category-header">
                      <label className="cookie-toggle">
                        <input
                          type="checkbox"
                          checked={preferences.marketing}
                          onChange={(e) => setPreferences(prev => ({ ...prev, marketing: e.target.checked }))}
                        />
                        <span className="cookie-toggle-slider"></span>
                      </label>
                      <div>
                        <h4>{t('cookies.marketing')}</h4>
                        <p>{t('cookies.marketingDescription')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cookie-settings-actions">
                  <motion.button
                    className="cookie-btn cookie-btn-primary"
                    onClick={saveSettings}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t('cookies.saveSettings')}
                  </motion.button>

                  <motion.button
                    className="cookie-btn cookie-btn-secondary"
                    onClick={acceptAll}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t('cookies.acceptAll')}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;