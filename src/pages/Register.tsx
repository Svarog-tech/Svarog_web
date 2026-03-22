import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faEye, faEyeSlash, faUserPlus, faShieldHalved, faBolt, faRocket } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faGithub } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RegistrationData, OAuthProvider } from '../types/auth';
import { validateRegistrationData } from '../lib/auth';
import PageMeta from '../components/PageMeta';
import './Register.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth, loading, user } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<'email' | 'details'>('email');
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    agreeToTerms: false
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  // Read affiliate referral code from cookie
  const getAffiliateCookie = (): string | null => {
    const match = document.cookie.match(/affiliate_ref=([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Calculate password strength
  const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' | null => {
    if (!password) return null;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Update password strength
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

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

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = t('register.emailRequired');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setStep('details');
  };

  const validateForm = (): boolean => {
    const validation = validateRegistrationData(formData, t);
    const errors = { ...validation.errors };

    if (formData.password !== confirmPassword) {
      errors.confirmPassword = t('registration.errors.passwordMismatch');
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
      const referralCode = getAffiliateCookie();
      const registrationData = referralCode
        ? { ...formData, referred_by: referralCode }
        : formData;
      const result = await signUp(registrationData);

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || t('auth.loginFailed'));
      }
    } catch (error: unknown) {
      setError(t('profile.error.unexpected'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setFieldErrors({});
    setError('');
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    try {
      await signInWithOAuth(provider);
    } catch (error: unknown) {
      console.error(`OAuth ${provider} registration failed:`, error);
      setError(t('auth.loginFailed'));
    }
  };

  const oauthProviders = [
    { name: 'Google', icon: faGoogle, color: '#DB4437', key: 'google' as OAuthProvider },
    { name: 'GitHub', icon: faGithub, color: '#333', key: 'github' as OAuthProvider }
  ];

  const isFormDisabled = loading || isSubmitting;

  return (
    <div className="register-page">
      <PageMeta title={t('register.title')} description="Vytvořte si účet u Alatyr Hosting." path="/register" noindex />
      <div className="register-container">
        {/* Decorative Panel - Left Side */}
        <motion.div
          className="register-decorative"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          {/* Animated Background */}
          <div className="decorative-bg">
            <div className="decorative-grid"></div>
            <div className="decorative-orb decorative-orb-1"></div>
            <div className="decorative-orb decorative-orb-2"></div>
            <div className="decorative-orb decorative-orb-3"></div>

            {/* Wave SVG Lines */}
            <svg className="decorative-waves" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="decorativeLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.3)" stopOpacity="0" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.3)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.3)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,300 Q300,250 600,300 T1200,300" stroke="url(#decorativeLineGrad)" strokeWidth="1" fill="none" className="decorative-wave-line" />
              <path d="M0,350 Q300,300 600,350 T1200,350" stroke="url(#decorativeLineGrad)" strokeWidth="1" fill="none" className="decorative-wave-line delay-1" />
              <path d="M0,400 Q300,350 600,400 T1200,400" stroke="url(#decorativeLineGrad)" strokeWidth="1" fill="none" className="decorative-wave-line delay-2" />
            </svg>

            {/* Floating Particles */}
            <div className="decorative-particles">
              {[...Array(15)].map((_, i) => (
                <span key={i} className="decorative-particle" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`
                }} />
              ))}
            </div>
          </div>

          {/* Decorative Content */}
          <motion.div
            className="decorative-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <motion.div
              className="decorative-icon"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
            >
              <FontAwesomeIcon icon={faRocket} />
            </motion.div>
            <motion.h2
              className="decorative-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              Join Alatyr Hosting
            </motion.h2>
            <motion.p
              className="decorative-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              Start your journey with professional hosting services designed for modern applications
            </motion.p>

            <motion.div
              className="decorative-features"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <div className="decorative-feature">
                <div className="decorative-feature-icon">
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
                <div className="decorative-feature-text">
                  <strong>Secure & Reliable</strong>
                  <span>Enterprise-grade security for your data</span>
                </div>
              </div>
              <div className="decorative-feature">
                <div className="decorative-feature-icon">
                  <FontAwesomeIcon icon={faBolt} />
                </div>
                <div className="decorative-feature-text">
                  <strong>Lightning Fast</strong>
                  <span>NVMe SSD storage for peak performance</span>
                </div>
              </div>
              <div className="decorative-feature">
                <div className="decorative-feature-icon">
                  <FontAwesomeIcon icon={faUserPlus} />
                </div>
                <div className="decorative-feature-text">
                  <strong>Easy Setup</strong>
                  <span>Get started in minutes, not hours</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Form Panel - Right Side */}
        <div className="register-form-panel">
          <motion.div
            className="register-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
          <div className="register-header">
            <motion.div
              className="register-icon"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 15 }}
            >
              <FontAwesomeIcon icon={faUserPlus} />
            </motion.div>
            <motion.h1
              className="register-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {t('register.title')}
            </motion.h1>
            <motion.p
              className="register-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              {t('register.subtitle')}
            </motion.p>
          </div>

          {/* Multi-Step Indicator */}
          <motion.div
            className="step-indicator"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <div className={`step-dot ${step === 'email' ? 'active' : ''}`}></div>
            <div className={`step-dot ${step === 'details' ? 'active' : ''}`}></div>
          </motion.div>

          {step === 'email' && (
            <>
              <motion.div
                className="oauth-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
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
                      transition={{ delay: 0.9 + (index * 0.1), duration: 0.5 }}
                      style={{ '--provider-color': provider.color } as React.CSSProperties}
                    >
                      <FontAwesomeIcon icon={provider.icon} className="oauth-icon" />
                      <span className="oauth-text">
                        {t('register.continueWithGoogle').replace('Google', provider.name)}
                      </span>
                    </motion.button>
                  ))}
                </div>

                <motion.div
                  className="divider"
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 1.1, duration: 0.5 }}
                >
                  <span className="divider-text">{t('register.orEmail')}</span>
                </motion.div>
              </motion.div>

              <form className="register-form email-step" onSubmit={handleEmailSubmit}>
                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                >
                  <label htmlFor="email" className="form-label">
                    {t('register.email')}
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
                      placeholder={t('register.emailPlaceholder')}
                      disabled={isFormDisabled}
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                  {fieldErrors.email && (
                    <span className="field-error">{fieldErrors.email}</span>
                  )}
                </motion.div>

                <motion.button
                  type="submit"
                  className="register-button"
                  disabled={isFormDisabled}
                  whileHover={{ scale: isFormDisabled ? 1 : 1.02, y: isFormDisabled ? 0 : -2 }}
                  whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.5 }}
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                  {t('register.continueWithEmail')}
                </motion.button>
              </form>
            </>
          )}

          {step === 'details' && (
            <>
              <motion.button
                type="button"
                className="back-button"
                onClick={handleBackToEmail}
                disabled={isFormDisabled}
                whileHover={{ scale: isFormDisabled ? 1 : 1.05 }}
                whileTap={{ scale: isFormDisabled ? 1 : 0.95 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                ← {t('register.back')}
              </motion.button>

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

              <form className="register-form details-step" onSubmit={handleSubmit}>
                <div className="form-row">
                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label htmlFor="firstName" className="form-label">
                      {t('register.firstName')}
                    </label>
                    <div className="input-wrapper">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className={`form-input ${fieldErrors.firstName ? 'error' : ''}`}
                        placeholder={t('register.firstNamePlaceholder')}
                        disabled={isFormDisabled}
                        autoComplete="given-name"
                      />
                    </div>
                    {fieldErrors.firstName && (
                      <span className="field-error">{fieldErrors.firstName}</span>
                    )}
                  </motion.div>

                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label htmlFor="lastName" className="form-label">
                      {t('register.lastName')}
                    </label>
                    <div className="input-wrapper">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className={`form-input ${fieldErrors.lastName ? 'error' : ''}`}
                        placeholder={t('register.lastNamePlaceholder')}
                        disabled={isFormDisabled}
                        autoComplete="family-name"
                      />
                    </div>
                    {fieldErrors.lastName && (
                      <span className="field-error">{fieldErrors.lastName}</span>
                    )}
                  </motion.div>
                </div>

                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label htmlFor="email" className="form-label">
                    {t('register.email')}
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
                      placeholder={t('register.emailPlaceholder')}
                      disabled={isFormDisabled}
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
                  transition={{ delay: 0.4 }}
                >
                  <label htmlFor="password" className="form-label">
                    {t('register.password')}
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
                      placeholder={t('register.passwordPlaceholder')}
                      disabled={isFormDisabled}
                      autoComplete="new-password"
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
                  {formData.password && passwordStrength && (
                    <div className="password-strength">
                      <div className="password-strength-bar">
                        <div className={`password-strength-fill ${passwordStrength}`}></div>
                      </div>
                      <span className={`password-strength-text ${passwordStrength}`}>
                        {passwordStrength === 'weak' && 'Weak password'}
                        {passwordStrength === 'medium' && 'Medium password'}
                        {passwordStrength === 'strong' && 'Strong password'}
                      </span>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <label htmlFor="confirmPassword" className="form-label">
                    {t('register.confirmPassword')}
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faLock} className="input-icon" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={handleInputChange}
                      className={`form-input ${fieldErrors.confirmPassword ? 'error' : ''}`}
                      placeholder={t('register.confirmPasswordPlaceholder')}
                      disabled={isFormDisabled}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isFormDisabled}
                    >
                      <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <span className="field-error">{fieldErrors.confirmPassword}</span>
                  )}
                </motion.div>

                <motion.div
                  className="form-group checkbox-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      className="checkbox-input"
                      disabled={isFormDisabled}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="checkbox-text">
                      {t('register.agreeToTerms')} <Link to="/terms" className="terms-link">{t('register.termsLink')}</Link>
                    </span>
                  </label>
                  {fieldErrors.terms && (
                    <span className="field-error">{fieldErrors.terms}</span>
                  )}
                </motion.div>

                <motion.button
                  type="submit"
                  className="register-button"
                  disabled={!formData.agreeToTerms || isFormDisabled}
                  whileHover={{ scale: isFormDisabled || !formData.agreeToTerms ? 1 : 1.02, y: isFormDisabled || !formData.agreeToTerms ? 0 : -2 }}
                  whileTap={{ scale: isFormDisabled || !formData.agreeToTerms ? 1 : 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                  {isSubmitting ? t('register.creating') : t('register.createAccount')}
                </motion.button>
              </form>

              <motion.div
                className="register-footer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <p className="login-link">
                  {t('register.haveAccount')} <Link to="/login">{t('register.loginLink')}</Link>
                </p>
              </motion.div>
            </>
          )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Register;