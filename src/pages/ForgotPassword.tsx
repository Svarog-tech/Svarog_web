import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowLeft, faPaperPlane, faKey, faCheck } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { resetPassword, validateEmail } from '../lib/auth';
import './ForgotPassword.css';

const ForgotPassword: React.FC = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('login.errors.emailRequired') || 'Zadejte emailovou adresu');
      return;
    }

    if (!validateEmail(email)) {
      setError(t('login.errors.emailInvalid') || 'Neplatná emailová adresa');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetPassword(email);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || t('forgotPassword.error') || 'Nepodařilo se odeslat email');
      }
    } catch {
      setError(t('profile.error.unexpected') || 'Nastala neočekávaná chyba');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        {/* Decorative Left Panel - Hidden on mobile, shown on desktop */}
        <motion.div
          className="forgot-password-decorative"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="decorative-bg">
            <div className="decorative-grid"></div>
            <div className="decorative-orb decorative-orb-1"></div>
            <div className="decorative-orb decorative-orb-2"></div>
            <div className="decorative-orb decorative-orb-3"></div>
            <div className="decorative-particles">
              {[...Array(15)].map((_, i) => (
                <span
                  key={i}
                  className="decorative-particle"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <motion.div
            className="decorative-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="decorative-icon-wrapper">
              <div className="decorative-rings">
                <div className="decorative-ring decorative-ring-1"></div>
                <div className="decorative-ring decorative-ring-2"></div>
                <div className="decorative-ring decorative-ring-3"></div>
              </div>
              <FontAwesomeIcon icon={faKey} className="decorative-icon" />
            </div>
            <h2>Password Recovery</h2>
            <p>Don't worry! It happens to the best of us. Enter your email and we'll send you a link to reset your password.</p>
          </motion.div>
        </motion.div>

        {/* Form Panel - Right side on desktop, full width on mobile */}
        <div className="forgot-password-form-panel">
          <div className="form-panel-bg"></div>
          <motion.div
            className="forgot-password-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="forgot-password-header">
              <motion.div
                className="forgot-password-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                <FontAwesomeIcon icon={faKey} />
              </motion.div>
              <h1 className="forgot-password-title">{t('forgotPassword.title') || 'Zapomenuté heslo'}</h1>
              <p className="forgot-password-subtitle">{t('forgotPassword.subtitle') || 'Zadejte svůj email a my vám pošleme odkaz pro obnovení hesla.'}</p>
            </div>

            {success ? (
              <motion.div
                className="forgot-password-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="success-checkmark-wrapper"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <div className="checkmark-circle"></div>
                  <div className="checkmark-icon-wrapper">
                    <FontAwesomeIcon icon={faCheck} />
                  </div>
                </motion.div>
                <motion.p
                  className="success-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {t('forgotPassword.successTitle') || 'Email odeslán!'}
                </motion.p>
                <motion.p
                  className="success-message"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {t('forgotPassword.successMessage') || 'Pokud účet s touto adresou existuje, obdržíte email s instrukcemi pro obnovení hesla.'}
                </motion.p>
              </motion.div>
            ) : (
              <>
                {error && (
                  <motion.div
                    className="error-message"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.div>
                )}

                <form className="forgot-password-form" onSubmit={handleSubmit}>
                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <label htmlFor="email" className="form-label">
                      {t('login.emailLabel') || 'Email'}
                    </label>
                    <div className="input-wrapper">
                      <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        className={`form-input ${error ? 'error' : ''}`}
                        placeholder={t('login.emailPlaceholder') || 'vas@email.cz'}
                        disabled={isSubmitting}
                        autoFocus
                        autoComplete="email"
                      />
                    </div>
                  </motion.div>

                  <motion.button
                    type="submit"
                    className={`forgot-password-submit ${isSubmitting ? 'loading' : ''}`}
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>
                      {isSubmitting
                        ? (t('forgotPassword.submitting') || 'Odesílám...')
                        : (t('forgotPassword.submit') || 'Odeslat odkaz pro obnovení')
                      }
                    </span>
                  </motion.button>
                </form>
              </>
            )}

            <motion.div
              className="forgot-password-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="back-to-login">
                <Link to="/login">
                  <FontAwesomeIcon icon={faArrowLeft} />
                  {t('forgotPassword.backToLogin') || 'Zpět na přihlášení'}
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
