import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEnvelope,
  faPhone,
  faBuilding,
  faSave,
  faCamera,
  faCheck,
  faShieldAlt,
  faTimes,
  faKey,
  faCopy,
  faMapMarkerAlt,
  faLock,
  faSignOutAlt,
  faInfoCircle,
  faCheckCircle,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Profile.css';
import { API_BASE_URL } from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import { useToast } from '../components/Toast';

type TabId = 'personal' | 'security' | 'account';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof faUser;
}

const Profile: React.FC = () => {
  const { user, profile, updateProfile, signOutAllDevices } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    ico: '',
    dic: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // 2FA State
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const { showSuccess, showError } = useToast();

  // Password change state
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const tabs: Tab[] = [
    { id: 'personal', label: 'Osobní údaje', icon: faUser },
    { id: 'security', label: 'Zabezpečení', icon: faShieldAlt },
    { id: 'account', label: 'Účet', icon: faInfoCircle }
  ];

  useEffect(() => {
    if (profile || user) {
      setFormData({
        firstName: profile?.first_name || user?.user_metadata?.first_name || '',
        lastName: profile?.last_name || user?.user_metadata?.last_name || '',
        email: profile?.email || user?.email || '',
        phone: profile?.phone || user?.user_metadata?.phone || '',
        company: profile?.company || user?.user_metadata?.company || '',
        address: profile?.address || user?.user_metadata?.address || '',
        ico: profile?.ico || '',
        dic: profile?.dic || ''
      });
    }
  }, [profile, user]);

  useEffect(() => {
    if (profile && typeof profile.two_factor_enabled === 'boolean') {
      setMfaEnabled(profile.two_factor_enabled);
    } else {
      setMfaEnabled(false);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const result = await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        company: formData.company,
        address: formData.address,
        ico: formData.ico,
        dic: formData.dic
      });

      if (result.success) {
        setSuccess(true);
        showSuccess('Profil byl úspěšně aktualizován.');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const msg = result.error || t('profile.error.saving');
        setError(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = t('profile.error.unexpected');
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const enable2FA = async () => {
    setError('');
    setEnrolling(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setShow2FAModal(true);
        setQrCode(result.otpauthUrl || '');
        setTotpSecret(result.secret || '');
        setRecoveryCodes(result.recoveryCodes || []);
      } else {
        const msg = result.error || 'Nepodařilo se připravit 2FA.';
        setError(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = 'Nepodařilo se připravit 2FA.';
      setError(msg);
      showError(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const verify2FA = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('Zadej ověřovací kód z aplikace.');
      return;
    }
    setEnrolling(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ code: verificationCode }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMfaEnabled(true);
        setShow2FAModal(false);
        setVerificationCode('');
        showSuccess(result.message || 'Dvoufaktorové ověření bylo zapnuto.');
      } else {
        const msg = result.error || 'Ověření kódu se nezdařilo.';
        setError(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = 'Ověření kódu se nezdařilo.';
      setError(msg);
      showError(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const disable2FA = async () => {
    const password = prompt('Pro vypnutí 2FA zadej své heslo:');
    if (!password) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMfaEnabled(false);
        setQrCode('');
        setTotpSecret('');
        setRecoveryCodes([]);
        setVerificationCode('');
        showSuccess(result.message || 'Dvoufaktorové ověření bylo vypnuto.');
      } else {
        const msg = result.error || 'Vypnutí 2FA se nezdařilo.';
        showError(msg);
      }
    } catch (err) {
      showError('Vypnutí 2FA se nezdařilo.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Zkopírováno do schránky');
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess(result.message || 'Ověřovací email byl odeslán, pokud ještě nebyl ověřen.');
      } else {
        const msg = result.error || 'Odeslání ověřovacího emailu se nezdařilo.';
        showError(msg);
      }
    } catch (err) {
      showError('Odeslání ověřovacího emailu se nezdařilo.');
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      showError('Vyplň staré i nové heslo.');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      showError('Nové heslo musí mít alespoň 8 znaků.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('Nová hesla se neshodují.');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        credentials: 'include',
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        showSuccess(result.message || 'Heslo bylo úspěšně změněno.');
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showError(result.error || 'Změna hesla se nezdařila.');
      }
    } catch {
      showError('Změna hesla se nezdařila.');
    } finally {
      setChangingPassword(false);
    }
  };

  const getUserInitials = () => {
    const firstName = formData.firstName || profile?.first_name || user?.user_metadata?.first_name;
    const lastName = formData.lastName || profile?.last_name || user?.user_metadata?.last_name;

    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    } else if (formData.email || user?.email) {
      const email = formData.email || user?.email || '';
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getProviderLabel = () => {
    if (profile?.provider === 'google') return 'Google';
    if (profile?.provider === 'github') return 'GitHub';
    return 'Email';
  };

  const renderPersonalTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <form onSubmit={handleSubmit} className="profile-form">
        {success && (
          <div className="profile-alert profile-alert--success" role="alert">
            <FontAwesomeIcon icon={faCheckCircle} />
            <span>Profil byl úspěšně aktualizován!</span>
          </div>
        )}

        {error && (
          <div className="profile-alert profile-alert--error" role="alert">
            <FontAwesomeIcon icon={faExclamationCircle} />
            <span>{error}</span>
          </div>
        )}

        <section className="profile-section">
          <h3 className="profile-section__title">Základní údaje</h3>

          <div className="profile-form__row">
            <div className="profile-form__group">
              <label htmlFor="firstName" className="profile-form__label">
                <FontAwesomeIcon icon={faUser} aria-hidden="true" />
                <span>Křestní jméno</span>
              </label>
              <input
                id="firstName"
                type="text"
                className="profile-form__input"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Tvoje křestní jméno"
              />
            </div>

            <div className="profile-form__group">
              <label htmlFor="lastName" className="profile-form__label">
                <FontAwesomeIcon icon={faUser} aria-hidden="true" />
                <span>Příjmení</span>
              </label>
              <input
                id="lastName"
                type="text"
                className="profile-form__input"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Tvoje příjmení"
              />
            </div>
          </div>

          <div className="profile-form__group">
            <label htmlFor="email" className="profile-form__label">
              <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" />
              <span>Email</span>
            </label>
            <input
              id="email"
              type="email"
              className="profile-form__input profile-form__input--disabled"
              value={formData.email}
              disabled
              aria-describedby="email-hint"
            />
            <small id="email-hint" className="profile-form__hint">Email nelze změnit</small>
          </div>

          <div className="profile-form__row">
            <div className="profile-form__group">
              <label htmlFor="phone" className="profile-form__label">
                <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
                <span>Telefon</span>
              </label>
              <input
                id="phone"
                type="tel"
                className="profile-form__input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+420 123 456 789"
              />
            </div>

            <div className="profile-form__group">
              <label htmlFor="company" className="profile-form__label">
                <FontAwesomeIcon icon={faBuilding} aria-hidden="true" />
                <span>Firma (volitelné)</span>
              </label>
              <input
                id="company"
                type="text"
                className="profile-form__input"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Název firmy"
              />
            </div>
          </div>

          <div className="profile-form__group">
            <label htmlFor="address" className="profile-form__label">
              <FontAwesomeIcon icon={faMapMarkerAlt} aria-hidden="true" />
              <span>Adresa</span>
            </label>
            <input
              id="address"
              type="text"
              className="profile-form__input"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ulice a číslo popisné, PSČ Město"
            />
          </div>
        </section>

        <section className="profile-section">
          <h3 className="profile-section__title">Fakturační údaje</h3>

          <div className="profile-form__row">
            <div className="profile-form__group">
              <label htmlFor="ico" className="profile-form__label">
                <FontAwesomeIcon icon={faBuilding} aria-hidden="true" />
                <span>IČO (volitelné)</span>
              </label>
              <input
                id="ico"
                type="text"
                className="profile-form__input"
                value={formData.ico}
                onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                placeholder="12345678"
                maxLength={20}
              />
            </div>

            <div className="profile-form__group">
              <label htmlFor="dic" className="profile-form__label">
                <FontAwesomeIcon icon={faBuilding} aria-hidden="true" />
                <span>DIČ (volitelné)</span>
              </label>
              <input
                id="dic"
                type="text"
                className="profile-form__input"
                value={formData.dic}
                onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                placeholder="CZ12345678"
                maxLength={20}
              />
            </div>
          </div>
        </section>

        <div className="profile-form__actions">
          <button
            type="submit"
            className="profile-btn profile-btn--primary"
            disabled={saving}
          >
            <FontAwesomeIcon icon={faSave} aria-hidden="true" />
            <span>{saving ? 'Ukládám...' : 'Uložit změny'}</span>
          </button>
        </div>
      </form>
    </motion.div>
  );

  const renderSecurityTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="profile-security"
    >
      {/* 2FA Section */}
      <section className="profile-card">
        <div className="profile-card__header">
          <div className="profile-card__icon">
            <FontAwesomeIcon icon={faShieldAlt} />
          </div>
          <div className="profile-card__info">
            <h3 className="profile-card__title">Dvoufaktorové ověření (2FA)</h3>
            <p className="profile-card__description">
              {mfaEnabled
                ? 'Tvůj účet je zabezpečený pomocí 2FA'
                : 'Přidej extra vrstvu zabezpečení k tvému účtu'}
            </p>
          </div>
          <div className="profile-card__status">
            {mfaEnabled ? (
              <span className="profile-badge profile-badge--success">Aktivní</span>
            ) : (
              <span className="profile-badge profile-badge--neutral">Neaktivní</span>
            )}
          </div>
        </div>

        <div className="profile-card__actions">
          {mfaEnabled ? (
            <button
              type="button"
              className="profile-btn profile-btn--danger"
              onClick={disable2FA}
              disabled={enrolling}
            >
              Vypnout 2FA
            </button>
          ) : (
            <button
              type="button"
              className="profile-btn profile-btn--primary"
              onClick={enable2FA}
              disabled={enrolling}
            >
              <FontAwesomeIcon icon={faShieldAlt} aria-hidden="true" />
              <span>Zapnout 2FA</span>
            </button>
          )}
        </div>

        {mfaEnabled && recoveryCodes.length > 0 && (
          <div className="profile-recovery">
            <div className="profile-recovery__header">
              <h4 className="profile-recovery__title">
                <FontAwesomeIcon icon={faKey} aria-hidden="true" />
                <span>Záložní kódy</span>
              </h4>
              <button
                type="button"
                className="profile-btn profile-btn--ghost"
                onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
              >
                {showRecoveryCodes ? 'Skrýt' : 'Zobrazit'}
              </button>
            </div>

            <AnimatePresence>
              {showRecoveryCodes && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="profile-recovery__hint">
                    Ulož si tyto kódy na bezpečné místo. Použij je pokud ztratíš přístup k authenticator aplikaci.
                  </p>
                  <div className="profile-recovery__grid">
                    {recoveryCodes.map((code, index) => (
                      <div key={index} className="profile-recovery__code">
                        <code>{code}</code>
                        <button
                          type="button"
                          className="profile-btn profile-btn--icon"
                          onClick={() => copyToClipboard(code)}
                          aria-label="Kopírovat kód"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Password Change Section */}
      {profile?.provider !== 'google' && profile?.provider !== 'github' && (
        <section className="profile-card">
          <div className="profile-card__header">
            <div className="profile-card__icon">
              <FontAwesomeIcon icon={faLock} />
            </div>
            <div className="profile-card__info">
              <h3 className="profile-card__title">Změna hesla</h3>
              <p className="profile-card__description">
                Pravidelná změna hesla zvyšuje zabezpečení účtu
              </p>
            </div>
          </div>

          <div className="profile-password">
            <div className="profile-form__group">
              <label htmlFor="oldPassword" className="profile-form__label">
                Staré heslo
              </label>
              <input
                id="oldPassword"
                type="password"
                className="profile-form__input"
                value={passwordData.oldPassword}
                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                placeholder="Zadej současné heslo"
                autoComplete="current-password"
              />
            </div>

            <div className="profile-form__row">
              <div className="profile-form__group">
                <label htmlFor="newPassword" className="profile-form__label">
                  Nové heslo
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className="profile-form__input"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Min. 8 znaků"
                  autoComplete="new-password"
                />
              </div>

              <div className="profile-form__group">
                <label htmlFor="confirmPassword" className="profile-form__label">
                  Potvrzení hesla
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="profile-form__input"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Zopakuj nové heslo"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="button"
              className="profile-btn profile-btn--primary"
              onClick={handleChangePassword}
              disabled={changingPassword || !passwordData.oldPassword || !passwordData.newPassword}
            >
              <FontAwesomeIcon icon={faLock} aria-hidden="true" />
              <span>{changingPassword ? 'Měním heslo...' : 'Změnit heslo'}</span>
            </button>
          </div>
        </section>
      )}

      {/* Sign Out All Devices */}
      <section className="profile-card profile-card--danger">
        <div className="profile-card__header">
          <div className="profile-card__icon profile-card__icon--danger">
            <FontAwesomeIcon icon={faSignOutAlt} />
          </div>
          <div className="profile-card__info">
            <h3 className="profile-card__title">Odhlásit ze všech zařízení</h3>
            <p className="profile-card__description">
              Odhlásíte se ze všech zařízení (telefon, tablet, jiný počítač). Budete muset se znovu přihlásit všude.
            </p>
          </div>
        </div>

        <div className="profile-card__actions">
          <button
            type="button"
            className="profile-btn profile-btn--danger"
            onClick={async () => {
              setLoggingOutAll(true);
              const result = await signOutAllDevices();
              setLoggingOutAll(false);
              if (result.success) {
                showSuccess('Byli jste odhlášeni ze všech zařízení.');
              } else {
                showError(result.error || 'Odhlášení se nezdařilo.');
              }
            }}
            disabled={loggingOutAll}
          >
            <FontAwesomeIcon icon={faSignOutAlt} aria-hidden="true" />
            <span>{loggingOutAll ? 'Odhlášení...' : 'Odhlásit vše'}</span>
          </button>
        </div>
      </section>
    </motion.div>
  );

  const renderAccountTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <section className="profile-card">
        <h3 className="profile-card__title" style={{ marginBottom: '1.5rem' }}>Informace o účtu</h3>

        <div className="profile-info-grid">
          <div className="profile-info-item">
            <span className="profile-info-item__label">Členem od</span>
            <span className="profile-info-item__value">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('cs-CZ') : '-'}
            </span>
          </div>

          <div className="profile-info-item">
            <span className="profile-info-item__label">Poslední přihlášení</span>
            <span className="profile-info-item__value">
              {profile?.last_login ? new Date(profile.last_login).toLocaleDateString('cs-CZ') : '-'}
            </span>
          </div>

          <div className="profile-info-item">
            <span className="profile-info-item__label">Email ověřen</span>
            <span className="profile-info-item__value">
              {profile?.email_verified ? (
                <span className="profile-status profile-status--success">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Ověřen</span>
                </span>
              ) : (
                <span className="profile-status profile-status--warning">
                  <FontAwesomeIcon icon={faExclamationCircle} />
                  <span>Neověřen</span>
                </span>
              )}
            </span>
            {!profile?.email_verified && (
              <button
                type="button"
                className="profile-btn profile-btn--link"
                onClick={handleResendVerification}
              >
                Odeslat ověřovací email znovu
              </button>
            )}
          </div>

          <div className="profile-info-item">
            <span className="profile-info-item__label">Poskytovatel</span>
            <span className="profile-info-item__value">
              <span className="profile-badge">{getProviderLabel()}</span>
            </span>
          </div>

          <div className="profile-info-item">
            <span className="profile-info-item__label">2FA</span>
            <span className="profile-info-item__value">
              {mfaEnabled ? (
                <span className="profile-status profile-status--success">
                  <FontAwesomeIcon icon={faShieldAlt} />
                  <span>Aktivní</span>
                </span>
              ) : (
                <span className="profile-status profile-status--neutral">
                  <FontAwesomeIcon icon={faShieldAlt} />
                  <span>Neaktivní</span>
                </span>
              )}
            </span>
          </div>
        </div>
      </section>
    </motion.div>
  );

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Header with Avatar */}
        <motion.header
          className="profile-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="profile-avatar">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="profile-avatar__image"
                loading="lazy"
              />
            ) : (
              <div className="profile-avatar__initials">
                {getUserInitials()}
              </div>
            )}
            <button
              type="button"
              className="profile-avatar__upload"
              aria-label="Nahrát avatar"
            >
              <FontAwesomeIcon icon={faCamera} />
            </button>
          </div>

          <div className="profile-header__info">
            <h1 className="profile-header__name">
              {formData.firstName || formData.lastName
                ? `${formData.firstName} ${formData.lastName}`.trim()
                : 'Uživatel'}
            </h1>
            <p className="profile-header__email">{formData.email}</p>
            <span className="profile-badge profile-badge--accent">
              {getProviderLabel()} účet
            </span>
          </div>
        </motion.header>

        {/* Tabs Navigation */}
        <motion.nav
          className="profile-tabs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          role="tablist"
          aria-label="Nastavení profilu"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`profile-tabs__tab ${activeTab === tab.id ? 'profile-tabs__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              <FontAwesomeIcon icon={tab.icon} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </motion.nav>

        {/* Tab Content */}
        <motion.main
          className="profile-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'personal' && renderPersonalTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'account' && renderAccountTab()}
          </AnimatePresence>
        </motion.main>

        {/* 2FA Setup Modal */}
        <AnimatePresence>
          {show2FAModal && (
            <motion.div
              className="profile-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShow2FAModal(false)}
            >
              <motion.div
                className="profile-modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mfa-modal-title"
              >
                <header className="profile-modal__header">
                  <h2 id="mfa-modal-title">Nastavení dvoufaktorového ověření</h2>
                  <button
                    type="button"
                    className="profile-modal__close"
                    onClick={() => setShow2FAModal(false)}
                    aria-label="Zavřít"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </header>

                <div className="profile-modal__body">
                  <div className="profile-mfa-steps">
                    <div className="profile-mfa-step">
                      <div className="profile-mfa-step__number">1</div>
                      <div className="profile-mfa-step__content">
                        <h3>Stáhni si Authenticator aplikaci</h3>
                        <p>Použij Google Authenticator, Authy nebo jinou TOTP aplikaci</p>
                      </div>
                    </div>

                    <div className="profile-mfa-step">
                      <div className="profile-mfa-step__number">2</div>
                      <div className="profile-mfa-step__content">
                        <h3>Naskenuj QR kód</h3>
                        <div className="profile-mfa-qr">
                          {qrCode && (
                            <QRCodeSVG
                              value={qrCode}
                              size={180}
                              level="M"
                              includeMargin={true}
                            />
                          )}
                        </div>
                        <div className="profile-mfa-secret">
                          <p>Nebo zadej tento kód ručně:</p>
                          <div className="profile-mfa-secret__code">
                            <code>{totpSecret}</code>
                            <button
                              type="button"
                              className="profile-btn profile-btn--ghost"
                              onClick={() => copyToClipboard(totpSecret)}
                            >
                              <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
                              <span>Kopírovat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="profile-mfa-step">
                      <div className="profile-mfa-step__number">3</div>
                      <div className="profile-mfa-step__content">
                        <h3>Zadej ověřovací kód</h3>
                        <p>Zadej 6-místný kód z aplikace</p>
                        <input
                          type="text"
                          className="profile-mfa-input"
                          placeholder="123456"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                          aria-label="Ověřovací kód"
                        />
                        {error && (
                          <div className="profile-alert profile-alert--error" role="alert">
                            <FontAwesomeIcon icon={faExclamationCircle} />
                            <span>{error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="profile-modal__footer">
                  <button
                    type="button"
                    className="profile-btn profile-btn--secondary"
                    onClick={() => setShow2FAModal(false)}
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    className="profile-btn profile-btn--primary"
                    onClick={verify2FA}
                    disabled={enrolling || verificationCode.length !== 6}
                  >
                    {enrolling ? 'Ověřuji...' : 'Ověřit a zapnout'}
                  </button>
                </footer>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Profile;
