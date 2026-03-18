import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faArrowLeft, faCheck, faEye, faEyeSlash, faLockOpen, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { validatePassword } from '../lib/auth';
import { API_BASE_URL } from '../lib/apiConfig';
import './ResetPassword.css';

const ResetPassword: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Password strength calculation
  const calculatePasswordStrength = (pwd: string): 'weak' | 'medium' | 'strong' | null => {
    if (!pwd) return null;

    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  };

  const passwordStrength = calculatePasswordStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  // Countdown timer for redirect after success
  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (success && countdown === 0) {
      navigate('/login');
    }
  }, [success, countdown, navigate]);

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
      <div className="reset-password-page">
        <div className="reset-password-container">
          {/* Decorative Left Panel */}
          <motion.div
            className="reset-password-decorative"
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
                <FontAwesomeIcon icon={faLockOpen} className="decorative-icon" />
              </div>
              <h2>Invalid Link</h2>
              <p>This password reset link is invalid or has expired. Request a new one to continue.</p>
            </motion.div>
          </motion.div>

          {/* Form Panel */}
          <div className="reset-password-form-panel">
            <div className="form-panel-bg"></div>
            <motion.div
              className="reset-password-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="reset-password-header">
                <motion.div
                  className="reset-password-icon"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                >
                  <FontAwesomeIcon icon={faLock} />
                </motion.div>
                <h1 className="reset-password-title">
                  {t('resetPassword.invalidTokenTitle') || 'Neplatný odkaz'}
                </h1>
                <p className="reset-password-subtitle">
                  {t('resetPassword.invalidTokenMessage') || 'Odkaz pro resetování hesla je neplatný nebo vypršel. Požádejte o nový.'}
                </p>
              </div>
              <motion.div
                className="reset-password-footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <p className="footer-link">
                  <Link to="/forgot-password">
                    {t('resetPassword.requestNew') || 'Požádat o nový odkaz'}
                  </Link>
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        {/* Decorative Left Panel - Hidden on mobile, shown on desktop */}
        <motion.div
          className="reset-password-decorative"
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
              <FontAwesomeIcon icon={success ? faLockOpen : faLock} className="decorative-icon" />
            </div>
            <h2>{success ? 'Password Reset!' : 'Create New Password'}</h2>
            <p>{success ? 'Your password has been successfully reset. You can now log in with your new password.' : 'Choose a strong password that you haven\'t used before. Your password should be at least 8 characters long.'}</p>
          </motion.div>
        </motion.div>

        {/* Form Panel - Right side on desktop, full width on mobile */}
        <div className="reset-password-form-panel">
          <div className="form-panel-bg"></div>
          <motion.div
            className="reset-password-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="reset-password-header">
              <motion.div
                className="reset-password-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                <FontAwesomeIcon icon={success ? faLockOpen : faLock} />
              </motion.div>
              <h1 className="reset-password-title">
                {t('resetPassword.title') || 'Nové'}{' '}
                <span className="gradient-text">{t('resetPassword.titleHighlight') || 'heslo'}</span>
              </h1>
              <p className="reset-password-subtitle">
                {t('resetPassword.subtitle') || 'Zadejte své nové heslo.'}
              </p>
            </div>

            {success ? (
              <motion.div
                className="success-container"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="success-icon-wrapper">
                  <div className="success-rings">
                    <div className="success-ring success-ring-1"></div>
                    <div className="success-ring success-ring-2"></div>
                    <div className="success-ring success-ring-3"></div>
                  </div>
                  <div className="success-icon">
                    <FontAwesomeIcon icon={faCheck} />
                  </div>
                </div>
                <h2 className="success-title">
                  {t('resetPassword.successTitle') || 'Heslo bylo změněno!'}
                </h2>
                <p className="success-message">
                  {t('resetPassword.successMessage') || 'Nyní se můžete přihlásit s novým heslem.'}
                </p>
                <motion.p
                  className="countdown-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {t('resetPassword.redirecting') || 'Přesměrování za'}{' '}
                  <span className="countdown-number">{countdown}</span>{' '}
                  {countdown === 1 ? (t('resetPassword.second') || 'sekundu') : (t('resetPassword.seconds') || 'sekund')}...
                </motion.p>
                <Link to="/login" className="success-button">
                  <FontAwesomeIcon icon={faArrowLeft} />
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

                <form className="reset-password-form" onSubmit={handleSubmit}>
                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label htmlFor="password" className="form-label">
                      <FontAwesomeIcon icon={faLock} />
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

                    {/* Password Strength Meter */}
                    {password && (
                      <motion.div
                        className="password-strength"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="strength-label">
                          <span>{t('resetPassword.strength') || 'Síla hesla'}:</span>
                          <span className={`strength-text ${passwordStrength}`}>
                            {passwordStrength === 'weak' && (t('resetPassword.weak') || 'Slabé')}
                            {passwordStrength === 'medium' && (t('resetPassword.medium') || 'Střední')}
                            {passwordStrength === 'strong' && (t('resetPassword.strong') || 'Silné')}
                          </span>
                        </div>
                        <div className="strength-bar-container">
                          <div className={`strength-bar ${passwordStrength}`}></div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <label htmlFor="confirmPassword" className="form-label">
                      <FontAwesomeIcon icon={faCheck} />
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
                        className={`form-input ${error ? 'error' : ''} ${passwordsMatch ? 'success' : ''}`}
                        placeholder={t('resetPassword.confirmPasswordPlaceholder') || 'Zadejte heslo znovu'}
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                    </div>

                    {/* Password Match Indicator */}
                    {confirmPassword && (
                      <motion.div
                        className={`password-match-indicator ${passwordsMatch ? 'match' : 'no-match'}`}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <FontAwesomeIcon icon={passwordsMatch ? faCheckCircle : faTimesCircle} />
                        <span>
                          {passwordsMatch
                            ? (t('resetPassword.passwordsMatch') || 'Hesla se shodují')
                            : (t('resetPassword.passwordsDontMatch') || 'Hesla se neshodují')
                          }
                        </span>
                      </motion.div>
                    )}
                  </motion.div>

                  <motion.button
                    type="submit"
                    className="reset-password-button"
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
              className="reset-password-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="footer-link">
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

export default ResetPassword;
