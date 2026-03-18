import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash, faSignInAlt } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faGithub } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LoginData } from '../types/auth';
import { validateEmail } from '../lib/auth';
import PageMeta from '../components/PageMeta';
import './Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithOAuth, loading, user } = useAuth();
  const { t } = useLanguage();

  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const state = location.state as { returnUrl?: string; plan?: unknown } | null;
      if (state?.returnUrl && state?.plan) {
        // Redirect back to configurator with plan data
        navigate(state.returnUrl, { state: { plan: state.plan } });
      } else if (state?.returnUrl) {
        navigate(state.returnUrl);
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate, location]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear general error
    if (error) {
      setError('');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = t('login.errors.emailRequired');
    } else if (!validateEmail(formData.email)) {
      errors.email = t('login.errors.emailInvalid');
    }

    if (!formData.password) {
      errors.password = t('login.errors.passwordRequired');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signIn({ ...formData, mfaCode: mfaCode || undefined });

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || t('auth.loginFailed'));
        if (result.mfaRequired) {
          setMfaRequired(true);
        }
      }
    } catch {
      setError(t('profile.error.unexpected'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const oauthProviders = [
    { name: 'Google', icon: faGoogle, color: '#DB4437', key: 'google' as 'google' },
    { name: 'GitHub', icon: faGithub, color: '#333', key: 'github' as 'github' },
  ];

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      await signInWithOAuth(provider);
    } catch (e) {
      setError(t('auth.oauthError'));
    }
  };

  const isFormDisabled = loading || isSubmitting;

  return (
    <div className="login-page">
      <PageMeta title={t('login.title')} description="Přihlaste se do svého účtu Alatyr Hosting." path="/login" noindex />
      <div className="login-container">
        {/* Decorative Left Panel - Hidden on mobile, shown on desktop */}
        <motion.div
          className="login-decorative"
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
              <FontAwesomeIcon icon={faSignInAlt} className="decorative-icon" />
            </div>
            <h2>Welcome Back!</h2>
            <p>Access your hosting dashboard and manage your servers with ease. Professional VPS hosting at your fingertips.</p>
          </motion.div>
        </motion.div>

        {/* Form Panel - Right side on desktop, full width on mobile */}
        <div className="login-form-panel">
          <div className="form-panel-bg"></div>
          <motion.div
            className="login-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="login-header">
              <motion.div
                className="login-icon"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 15 }}
              >
                <FontAwesomeIcon icon={faSignInAlt} />
              </motion.div>
              <motion.h1
                className="login-title"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                {t('login.title')}
              </motion.h1>
              <motion.p
                className="login-subtitle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {t('login.subtitle')}
              </motion.p>
            </div>

          {/* OAuth Buttons */}
          <motion.div
            className="oauth-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <div className="oauth-buttons">
              {oauthProviders.map((provider, index) => (
                <motion.button
                  key={provider.key}
                  className={`oauth-btn oauth-btn-${provider.key}`}
                  onClick={() => handleOAuthLogin(provider.key)}
                  disabled={isFormDisabled}
                  whileHover={{ scale: isFormDisabled ? 1 : 1.02, y: isFormDisabled ? 0 : -2 }}
                  whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + (index * 0.1), duration: 0.5 }}
                  style={{ '--provider-color': provider.color } as React.CSSProperties}
                >
                  <FontAwesomeIcon icon={provider.icon} className="oauth-icon" />
                  <span className="oauth-text">
                    {t('login.continueWith').replace('{provider}', provider.name)}
                  </span>
                </motion.button>
              ))}
            </div>

            <motion.div
              className="divider"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <span className="divider-text">{t('login.orContinueWithEmail')}</span>
            </motion.div>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
            >
              <label htmlFor="email" className="form-label">
                {t('login.emailLabel')}
              </label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                  placeholder={t('login.emailPlaceholder')}
                  disabled={isFormDisabled}
                  autoFocus
                  autoComplete="email"
                />
              </div>
              {fieldErrors.email && (
                <span className="field-error">{fieldErrors.email}</span>
              )}
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <label htmlFor="password" className="form-label">
                {t('login.passwordLabel')}
              </label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                  placeholder={t('login.passwordPlaceholder')}
                  disabled={isFormDisabled}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isFormDisabled}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
              {fieldErrors.password && (
                <span className="field-error">{fieldErrors.password}</span>
              )}
            </motion.div>

            {mfaRequired && (
              <motion.div
                className="form-group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3, duration: 0.5 }}
              >
                <label htmlFor="mfaCode" className="form-label">
                  2FA kód (z Authenticator aplikace)
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    id="mfaCode"
                    name="mfaCode"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="form-input"
                    placeholder="123 456"
                    disabled={isFormDisabled}
                    autoComplete="one-time-code"
                  />
                </div>
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="login-button"
              disabled={isFormDisabled}
              whileHover={{ scale: isFormDisabled ? 1 : 1.02, y: isFormDisabled ? 0 : -2 }}
              whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
            >
              <FontAwesomeIcon icon={faSignInAlt} />
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </motion.button>
          </form>

          <motion.div
            className="login-footer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            <p className="register-link">
              {t('login.noAccount')} <Link to="/register">{t('login.registerLink')}</Link>
            </p>
            <p className="forgot-password">
              <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
            </p>
          </motion.div>
        </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;