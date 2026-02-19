import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowLeft, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { resetPassword, validateEmail } from '../lib/auth';
import './Login.css';

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
    <div className="login-page">
      <div className="login-container">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="login-header">
            <motion.div
              className="login-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              <FontAwesomeIcon icon={faEnvelope} />
            </motion.div>
            <h1 className="login-title">
              {t('forgotPassword.title') || 'Zapomenuté heslo'}
            </h1>
            <p className="login-subtitle">
              {t('forgotPassword.subtitle') || 'Zadejte svůj email a my vám pošleme odkaz pro obnovení hesla.'}
            </p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '1.5rem',
                background: 'rgba(40, 167, 69, 0.1)',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <p style={{ color: 'var(--success-color, #28a745)', fontWeight: 600, marginBottom: '0.5rem' }}>
                {t('forgotPassword.successTitle') || 'Email odeslán!'}
              </p>
              <p style={{ color: 'var(--text-secondary, #666)', fontSize: '0.9rem' }}>
                {t('forgotPassword.successMessage') || 'Pokud účet s touto adresou existuje, obdržíte email s instrukcemi pro obnovení hesla.'}
              </p>
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

              <form className="login-form" onSubmit={handleSubmit}>
                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
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
                  className="login-button"
                  disabled={isSubmitting}
                  whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                  {isSubmitting
                    ? (t('forgotPassword.submitting') || 'Odesílám...')
                    : (t('forgotPassword.submit') || 'Odeslat odkaz pro obnovení')
                  }
                </motion.button>
              </form>
            </>
          )}

          <motion.div
            className="login-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="register-link">
              <Link to="/login">
                <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '0.5rem' }} />
                {t('forgotPassword.backToLogin') || 'Zpět na přihlášení'}
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
