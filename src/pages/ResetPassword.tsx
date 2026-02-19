import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faArrowLeft, faCheck, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { validatePassword } from '../lib/auth';
import { API_BASE_URL } from '../lib/apiConfig';
import './Login.css';

const ResetPassword: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(t('resetPassword.invalidToken') || 'Neplatný nebo chybějící token pro resetování hesla.');
      return;
    }

    if (!password) {
      setError(t('resetPassword.passwordRequired') || 'Zadejte nové heslo');
      return;
    }

    const validation = validatePassword(password, t);
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch') || 'Hesla se neshodují');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || t('resetPassword.error') || 'Resetování hesla se nezdařilo');
      }
    } catch {
      setError(t('profile.error.unexpected') || 'Nastala neočekávaná chyba');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
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
                <FontAwesomeIcon icon={faLock} />
              </motion.div>
              <h1 className="login-title">
                {t('resetPassword.invalidTokenTitle') || 'Neplatný odkaz'}
              </h1>
              <p className="login-subtitle">
                {t('resetPassword.invalidTokenMessage') || 'Odkaz pro resetování hesla je neplatný nebo vypršel. Požádejte o nový.'}
              </p>
            </div>
            <motion.div
              className="login-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="register-link">
                <Link to="/forgot-password">
                  {t('resetPassword.requestNew') || 'Požádat o nový odkaz'}
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

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
              <FontAwesomeIcon icon={faLock} />
            </motion.div>
            <h1 className="login-title">
              {t('resetPassword.title') || 'Nové heslo'}
            </h1>
            <p className="login-subtitle">
              {t('resetPassword.subtitle') || 'Zadejte své nové heslo.'}
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
              <FontAwesomeIcon
                icon={faCheck}
                style={{ color: 'var(--success-color, #28a745)', fontSize: '2rem', marginBottom: '0.75rem' }}
              />
              <p style={{ color: 'var(--success-color, #28a745)', fontWeight: 600, marginBottom: '0.5rem' }}>
                {t('resetPassword.successTitle') || 'Heslo bylo změněno!'}
              </p>
              <p style={{ color: 'var(--text-secondary, #666)', fontSize: '0.9rem' }}>
                {t('resetPassword.successMessage') || 'Nyní se můžete přihlásit s novým heslem.'}
              </p>
              <Link
                to="/login"
                className="login-button"
                style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}
              >
                {t('resetPassword.goToLogin') || 'Přejít na přihlášení'}
              </Link>
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
                  <label htmlFor="password" className="form-label">
                    {t('resetPassword.newPassword') || 'Nové heslo'}
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faLock} className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      className={`form-input ${error ? 'error' : ''}`}
                      placeholder={t('resetPassword.newPasswordPlaceholder') || 'Min. 8 znaků, velké i malé písmeno, číslo'}
                      disabled={isSubmitting}
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label htmlFor="confirmPassword" className="form-label">
                    {t('resetPassword.confirmPassword') || 'Potvrdit heslo'}
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faLock} className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                      className={`form-input ${error ? 'error' : ''}`}
                      placeholder={t('resetPassword.confirmPasswordPlaceholder') || 'Zadejte heslo znovu'}
                      disabled={isSubmitting}
                      autoComplete="new-password"
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
                  transition={{ delay: 0.5 }}
                >
                  <FontAwesomeIcon icon={faCheck} />
                  {isSubmitting
                    ? (t('resetPassword.submitting') || 'Ukládám...')
                    : (t('resetPassword.submit') || 'Nastavit nové heslo')
                  }
                </motion.button>
              </form>
            </>
          )}

          <motion.div
            className="login-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
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

export default ResetPassword;
