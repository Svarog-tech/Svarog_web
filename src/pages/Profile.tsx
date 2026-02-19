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
  faLock
} from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Profile.css';
import { API_BASE_URL } from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import { useToast } from '../components/Toast';

const Profile: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const { t } = useLanguage();
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
  const [factorId, setFactorId] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const { showSuccess, showError } = useToast();

  // Password change state
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

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

  // Check 2FA status podle profilu
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

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  // Get user initials for avatar
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

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Header */}
        <motion.div
          className="profile-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="profile-title">Nastavení profilu</h1>
          <p className="profile-subtitle">
            Aktualizuj své osobní údaje a nastavení účtu
          </p>
        </motion.div>

        <div className="profile-content">
          {/* Avatar Section */}
          <motion.div
            className="avatar-section"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="avatar-card">
              <div className="avatar-large">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="avatar-initials-large">
                    {getUserInitials()}
                  </div>
                )}
                <button className="avatar-upload-btn">
                  <FontAwesomeIcon icon={faCamera} />
                </button>
              </div>
              <div className="avatar-info">
                <h3>{formData.firstName || formData.lastName ? `${formData.firstName} ${formData.lastName}` : 'Uživatel'}</h3>
                <p>{formData.email}</p>
                <span className="user-badge">
                  {profile?.provider === 'google' ? 'Google účet' :
                   profile?.provider === 'github' ? 'GitHub účet' : 'Email účet'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Profile Form */}
          <motion.div
            className="form-section"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <form onSubmit={handleSubmit} className="profile-form">
              {success && (
                <div className="alert alert-success">
                  <FontAwesomeIcon icon={faCheck} />
                  Profil byl úspěšně aktualizován!
                </div>
              )}

              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}

              <div className="form-section-title">
                <h2>Osobní údaje</h2>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <FontAwesomeIcon icon={faUser} />
                    Křestní jméno
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Tvoje křestní jméno"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <FontAwesomeIcon icon={faUser} />
                    Příjmení
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Tvoje příjmení"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <FontAwesomeIcon icon={faEnvelope} />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="disabled-input"
                />
                <small className="form-hint">Email nelze změnit</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <FontAwesomeIcon icon={faPhone} />
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+420 123 456 789"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <FontAwesomeIcon icon={faBuilding} />
                    Firma (volitelné)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Název firmy"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  Adresa
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ulice a číslo popisné, PSČ Město"
                />
              </div>

              <div className="form-section-title">
                <h2>Fakturační údaje</h2>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <FontAwesomeIcon icon={faBuilding} />
                    IČO (volitelné)
                  </label>
                  <input
                    type="text"
                    value={formData.ico}
                    onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                    placeholder="12345678"
                    maxLength={20}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <FontAwesomeIcon icon={faBuilding} />
                    DIČ (volitelné)
                  </label>
                  <input
                    type="text"
                    value={formData.dic}
                    onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                    placeholder="CZ12345678"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="form-section-title">
                <h2>Zabezpečení</h2>
              </div>

              <div className="mfa-section">
                <div className="mfa-header">
                  <div className="mfa-info">
                    <div className="mfa-icon">
                      <FontAwesomeIcon icon={faShieldAlt} />
                    </div>
                    <div>
                      <h3>Dvoufaktorové ověření (2FA)</h3>
                      <p>
                        {mfaEnabled
                          ? 'Tvůj účet je zabezpečený pomocí 2FA'
                          : 'Přidej extra vrstvu zabezpečení k tvému účtu'}
                      </p>
                    </div>
                  </div>
                  {mfaEnabled ? (
                    <button
                      type="button"
                      className="mfa-btn danger"
                      onClick={disable2FA}
                      disabled={enrolling}
                    >
                      Vypnout 2FA
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mfa-btn primary"
                      onClick={enable2FA}
                      disabled={enrolling}
                    >
                      <FontAwesomeIcon icon={faShieldAlt} />
                      Zapnout 2FA
                    </button>
                  )}
                </div>

                {mfaEnabled && recoveryCodes.length > 0 && (
                  <div className="recovery-codes-section">
                    <div className="recovery-codes-header">
                      <h4>
                        <FontAwesomeIcon icon={faKey} />
                        Záložní kódy
                      </h4>
                      <button
                        type="button"
                        className="toggle-codes-btn"
                        onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
                      >
                        {showRecoveryCodes ? 'Skrýt kódy' : 'Zobrazit kódy'}
                      </button>
                    </div>

                    {showRecoveryCodes && (
                      <>
                        <p className="recovery-codes-hint">
                          Ulož si tyto kódy na bezpečné místo. Použij je pokud ztratíš přístup k authenticator aplikaci.
                        </p>
                        <div className="recovery-codes-grid">
                          {recoveryCodes.map((code, index) => (
                            <div key={index} className="recovery-code">
                              <code>{code}</code>
                              <button
                                type="button"
                                className="copy-btn"
                                onClick={() => copyToClipboard(code)}
                                title="Kopírovat"
                              >
                                <FontAwesomeIcon icon={faCopy} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Password Change */}
              {profile?.provider !== 'google' && profile?.provider !== 'github' && (
                <div className="password-change-section">
                  <div className="mfa-header">
                    <div className="mfa-info">
                      <div className="mfa-icon">
                        <FontAwesomeIcon icon={faLock} />
                      </div>
                      <div>
                        <h3>Změna hesla</h3>
                        <p>Pravidelná změna hesla zvyšuje zabezpečení účtu</p>
                      </div>
                    </div>
                  </div>
                  <div className="password-fields">
                    <div className="form-group">
                      <label>Staré heslo</label>
                      <input
                        type="password"
                        value={passwordData.oldPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                        placeholder="Zadej současné heslo"
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Nové heslo</label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder="Min. 8 znaků"
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="form-group">
                        <label>Potvrzení nového hesla</label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder="Zopakuj nové heslo"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mfa-btn primary"
                      onClick={handleChangePassword}
                      disabled={changingPassword || !passwordData.oldPassword || !passwordData.newPassword}
                    >
                      <FontAwesomeIcon icon={faLock} />
                      {changingPassword ? 'Měním heslo...' : 'Změnit heslo'}
                    </button>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="save-btn"
                  disabled={saving}
                >
                  <FontAwesomeIcon icon={faSave} />
                  {saving ? 'Ukládám...' : 'Uložit změny'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Account Info */}
        <motion.div
          className="account-info"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3>Informace o účtu</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Členem od:</span>
              <span className="info-value">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('cs-CZ') : '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Poslední přihlášení:</span>
              <span className="info-value">
                {profile?.last_login ? new Date(profile.last_login).toLocaleDateString('cs-CZ') : '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Email ověřen:</span>
              <span className="info-value">
                {profile?.email_verified ? '✓ Ano' : '✗ Ne'}
              </span>
              {!profile?.email_verified && (
                <button
                  type="button"
                  className="resend-verification-btn"
                  onClick={handleResendVerification}
                >
                  Odeslat ověřovací email znovu
                </button>
              )}
            </div>
            <div className="info-item">
              <span className="info-label">Poskytovatel:</span>
              <span className="info-value">
                {profile?.provider === 'google' ? 'Google' :
                 profile?.provider === 'github' ? 'GitHub' : 'Email'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* 2FA Setup Modal */}
        <AnimatePresence>
          {show2FAModal && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShow2FAModal(false)}
            >
              <motion.div
                className="modal-content mfa-modal"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Nastavení dvoufaktorového ověření</h2>
                  <button
                    className="close-modal-btn"
                    onClick={() => setShow2FAModal(false)}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <div className="modal-body">
                  <div className="mfa-steps">
                    <div className="mfa-step">
                      <div className="step-number">1</div>
                      <div className="step-content">
                        <h3>Stáhni si Authenticator aplikaci</h3>
                        <p>Použij Google Authenticator, Authy nebo jinou TOTP aplikaci</p>
                      </div>
                    </div>

                    <div className="mfa-step">
                      <div className="step-number">2</div>
                      <div className="step-content">
                        <h3>Naskenuj QR kód</h3>
                        <div className="qr-code-container">
                          {qrCode && (
                            <QRCodeSVG
                              value={qrCode}
                              size={200}
                              level="M"
                              includeMargin={true}
                            />
                          )}
                        </div>
                        <div className="secret-key">
                          <p>Nebo zadej tento kód ručně:</p>
                          <code>{totpSecret}</code>
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() => copyToClipboard(totpSecret)}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                            Kopírovat
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mfa-step">
                      <div className="step-number">3</div>
                      <div className="step-content">
                        <h3>Zadej ověřovací kód</h3>
                        <p>Zadej 6-místný kód z aplikace</p>
                        <input
                          type="text"
                          className="verification-input"
                          placeholder="123456"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        />
                        {error && <div className="error-message">{error}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => setShow2FAModal(false)}
                    >
                      Zrušit
                    </button>
                    <button
                      type="button"
                      className="verify-btn"
                      onClick={verify2FA}
                      disabled={enrolling || verificationCode.length !== 6}
                    >
                      {enrolling ? 'Ověřuji...' : 'Ověřit a zapnout'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Profile;
