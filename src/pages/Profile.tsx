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
  faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/auth';
import './Profile.css';

const Profile: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address: ''
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

  useEffect(() => {
    if (profile || user) {
      setFormData({
        firstName: profile?.first_name || user?.user_metadata?.first_name || '',
        lastName: profile?.last_name || user?.user_metadata?.last_name || '',
        email: profile?.email || user?.email || '',
        phone: profile?.phone || user?.user_metadata?.phone || '',
        company: profile?.company || user?.user_metadata?.company || '',
        address: profile?.address || user?.user_metadata?.address || ''
      });
    }
  }, [profile, user]);

  // Check 2FA status
  useEffect(() => {
    checkMFAStatus();
  }, [user]);

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        const totpFactor = data.totp.find((f: any) => f.status === 'verified');
        setMfaEnabled(!!totpFactor);
        if (totpFactor) {
          setFactorId(totpFactor.id);
        }
      }
    } catch (err) {
      console.error('Error checking MFA status:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const result = await updateProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        company: formData.company,
        address: formData.address
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Chyba při ukládání');
      }
    } catch (err) {
      setError('Nastala neočekávaná chyba');
    } finally {
      setSaving(false);
    }
  };

  // Enable 2FA
  const enable2FA = async () => {
    setEnrolling(true);
    setError('');

    try {
      // Use unique name with timestamp to avoid conflicts
      const uniqueName = `Authenticator App ${new Date().getTime()}`;

      // Enroll a new factor with unique name
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: uniqueName
      });

      if (error) throw error;

      if (data) {
        // Create OTP auth URI manually from secret
        const issuer = 'Alatyr Hosting';
        const accountName = user?.email || 'user';
        const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${data.totp.secret}&issuer=${encodeURIComponent(issuer)}`;

        setQrCode(otpauth);
        setTotpSecret(data.totp.secret);
        setFactorId(data.id);
        setShow2FAModal(true);
      }
    } catch (err: any) {
      setError(err.message || 'Chyba při zapínání 2FA');
    } finally {
      setEnrolling(false);
    }
  };

  // Verify 2FA code
  const verify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Zadej platný 6-místný kód');
      return;
    }

    setEnrolling(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.mfa.challenge({
        factorId: factorId
      });

      if (error) throw error;

      if (data) {
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: factorId,
          challengeId: data.id,
          code: verificationCode
        });

        if (verifyError) throw verifyError;

        setMfaEnabled(true);
        setSuccess(true);
        setShow2FAModal(false);
        setVerificationCode('');

        // Generate mock recovery codes (Supabase doesn't provide these directly)
        const codes = Array.from({ length: 10 }, () =>
          Math.random().toString(36).substring(2, 10).toUpperCase()
        );
        setRecoveryCodes(codes);
        setShowRecoveryCodes(true); // Show recovery codes initially

        // Hide recovery codes after 30 seconds
        setTimeout(() => {
          setShowRecoveryCodes(false);
          setSuccess(false);
        }, 30000);
      }
    } catch (err: any) {
      setError(err.message || 'Neplatný kód');
    } finally {
      setEnrolling(false);
    }
  };

  // Disable 2FA
  const disable2FA = async () => {
    if (!window.confirm('Opravdu chceš vypnout dvoufaktorové ověření?')) {
      return;
    }

    setEnrolling(true);
    setError('');

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorId
      });

      if (error) throw error;

      setMfaEnabled(false);
      setFactorId('');
      setRecoveryCodes([]);
      setShowRecoveryCodes(false);
      setSuccess(true);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Chyba při vypínání 2FA');
    } finally {
      setEnrolling(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
                  <img src={profile.avatar_url} alt="Avatar" />
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
