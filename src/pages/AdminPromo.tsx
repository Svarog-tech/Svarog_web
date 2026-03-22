import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faPlus,
  faEdit,
  faTrash,
  faSearch,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faEye,
  faPercent,
  faMoneyBillWave,
  faArrowLeft,
  faCopy,
  faDice,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import {
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getPromoCodeUsage,
  PromoCode,
  PromoCodeUsage
} from '../lib/api';
import './AdminPromo.css';

const AdminPromo: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);

  // Usage detail state
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageData, setUsageData] = useState<PromoCodeUsage[]>([]);
  const [usageCodeName, setUsageCodeName] = useState('');
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Form state
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: 0,
    max_uses: '' as string | number,
    per_user_limit: 1,
    valid_from: '',
    valid_until: '',
    applicable_plans: '',
    is_active: true
  });

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchPromoCodes();
  }, [user, profile, navigate]);

  const fetchPromoCodes = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getPromoCodes({ search: searchTerm || undefined });
      setPromoCodes(result.promo_codes || []);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      showError('Chyba při načítání promo kódů');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => fetchPromoCodes(), 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm(prev => ({ ...prev, code }));
  };

  const openCreateModal = () => {
    setEditingCode(null);
    setForm({
      code: '',
      description: '',
      discount_type: 'percent',
      discount_value: 0,
      max_uses: '',
      per_user_limit: 1,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      applicable_plans: '',
      is_active: true
    });
    setModalOpen(true);
  };

  const openEditModal = (code: PromoCode) => {
    setEditingCode(code);
    setForm({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      max_uses: code.max_uses ?? '',
      per_user_limit: code.per_user_limit ?? 1,
      valid_from: code.valid_from ? code.valid_from.split('T')[0] : '',
      valid_until: code.valid_until ? code.valid_until.split('T')[0] : '',
      applicable_plans: code.applicable_plans ? code.applicable_plans.join(', ') : '',
      is_active: code.is_active
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      showError('Kód je povinný');
      return;
    }
    if (form.discount_value <= 0) {
      showError('Hodnota slevy musí být větší než 0');
      return;
    }

    try {
      setSaving(true);
      const data: Partial<PromoCode> = {
        code: form.code.toUpperCase().trim(),
        description: form.description || undefined,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        per_user_limit: form.per_user_limit || null,
        valid_from: form.valid_from || undefined,
        valid_until: form.valid_until || null,
        applicable_plans: form.applicable_plans ? form.applicable_plans.split(',').map(s => s.trim()).filter(Boolean) : null,
        is_active: form.is_active
      };

      if (editingCode) {
        await updatePromoCode(editingCode.id, data);
        showSuccess('Promo kód byl aktualizován');
      } else {
        await createPromoCode(data);
        showSuccess('Promo kód byl vytvořen');
      }
      setModalOpen(false);
      fetchPromoCodes();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při ukládání promo kódu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code: PromoCode) => {
    if (!window.confirm(`Opravdu chceš deaktivovat promo kód "${code.code}"?`)) return;

    try {
      await deletePromoCode(code.id);
      showSuccess('Promo kód byl deaktivován');
      fetchPromoCodes();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při mazání promo kódu');
    }
  };

  const openUsageDetail = async (code: PromoCode) => {
    try {
      setLoadingUsage(true);
      setUsageCodeName(code.code);
      setUsageModalOpen(true);
      const result = await getPromoCodeUsage(code.id);
      setUsageData(result.usage || []);
    } catch (error) {
      showError('Chyba při načítání historie použití');
    } finally {
      setLoadingUsage(false);
    }
  };

  const getStatusBadge = (code: PromoCode) => {
    if (!code.is_active) {
      return <span className="promo-status-badge inactive">Neaktivní</span>;
    }
    if (code.valid_until && new Date(code.valid_until) < new Date()) {
      return <span className="promo-status-badge expired">Vypršel</span>;
    }
    return <span className="promo-status-badge active">Aktivní</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(price);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání promo kódů...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <motion.div
          className="admin-header promo-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="admin-header-content">
            <div className="admin-title-section">
              <div className="admin-icon-wrapper">
                <FontAwesomeIcon icon={faTicket} />
              </div>
              <div>
                <h1>Promo kódy</h1>
                <p>Správa slevových a promo kódů</p>
              </div>
            </div>
            <div className="admin-quick-links">
              <button className="quick-link-btn" onClick={() => navigate('/admin')}>
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Zpět na administraci</span>
              </button>
              <button className="quick-link-btn" onClick={openCreateModal}>
                <FontAwesomeIcon icon={faPlus} />
                <span>Nový promo kód</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
              <FontAwesomeIcon icon={faTicket} />
            </div>
            <div className="stat-content">
              <h3>{promoCodes.length}</h3>
              <p>Celkem kódů</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className="stat-content">
              <h3>{promoCodes.filter(c => c.is_active && (!c.valid_until || new Date(c.valid_until) >= new Date())).length}</h3>
              <p>Aktivních</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <FontAwesomeIcon icon={faPercent} />
            </div>
            <div className="stat-content">
              <h3>{promoCodes.reduce((sum, c) => sum + c.current_uses, 0)}</h3>
              <p>Celkem použití</p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          className="filters-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="search-box">
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="text"
              placeholder="Hledat promo kódy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          className="orders-table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="table-header">
            <h2>
              <FontAwesomeIcon icon={faTicket} className="section-icon" />
              Promo kódy ({promoCodes.length})
            </h2>
          </div>

          {promoCodes.length === 0 ? (
            <div className="no-orders">
              <FontAwesomeIcon icon={faTicket} />
              <p>Žádné promo kódy</p>
            </div>
          ) : (
            <div className="table-wrapper table-responsive">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Kód</th>
                    <th>Popis</th>
                    <th>Typ slevy</th>
                    <th>Hodnota</th>
                    <th>Použití</th>
                    <th>Platnost</th>
                    <th>Status</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((code) => (
                    <tr key={code.id}>
                      <td>
                        <span className="promo-code-cell">
                          <code>{code.code}</code>
                          <button
                            className="copy-btn"
                            title="Kopírovat kód"
                            onClick={() => {
                              navigator.clipboard.writeText(code.code);
                              showSuccess('Kód zkopírován');
                            }}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </span>
                      </td>
                      <td className="description-cell">{code.description || '-'}</td>
                      <td>
                        <span className={`discount-type-badge ${code.discount_type}`}>
                          <FontAwesomeIcon icon={code.discount_type === 'percent' ? faPercent : faMoneyBillWave} />
                          {code.discount_type === 'percent' ? 'Procentní' : 'Fixní'}
                        </span>
                      </td>
                      <td className="price">
                        {code.discount_type === 'percent'
                          ? `${code.discount_value}%`
                          : formatPrice(code.discount_value)}
                      </td>
                      <td>
                        <span
                          className="usage-link"
                          onClick={() => openUsageDetail(code)}
                          title="Zobrazit historii použití"
                        >
                          {code.current_uses}/{code.max_uses ?? '∞'}
                        </span>
                      </td>
                      <td className="date">
                        {code.valid_from ? formatDate(code.valid_from) : '-'}
                        {' – '}
                        {code.valid_until ? formatDate(code.valid_until) : '∞'}
                      </td>
                      <td>{getStatusBadge(code)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn view"
                            title="Historie použití"
                            onClick={() => openUsageDetail(code)}
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            className="action-btn edit"
                            title="Upravit"
                            onClick={() => openEditModal(code)}
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className="action-btn delete"
                            title="Deaktivovat"
                            onClick={() => handleDelete(code)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="admin-modal-overlay" onClick={() => setModalOpen(false)}>
          <motion.div
            className="admin-modal promo-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h3>{editingCode ? 'Upravit promo kód' : 'Nový promo kód'}</h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="form-row">
                <label>
                  Kód
                  <div className="input-with-btn">
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="PROMO2024"
                    />
                    <button type="button" className="generate-btn" onClick={generateCode} title="Vygenerovat náhodný kód">
                      <FontAwesomeIcon icon={faDice} />
                    </button>
                  </div>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Popis
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Popis promo akce"
                  />
                </label>
              </div>
              <div className="form-row form-row-2col">
                <label>
                  Typ slevy
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm(prev => ({ ...prev, discount_type: e.target.value as 'percent' | 'fixed' }))}
                  >
                    <option value="percent">Procentní (%)</option>
                    <option value="fixed">Fixní (Kč)</option>
                  </select>
                </label>
                <label>
                  Hodnota slevy
                  <input
                    type="number"
                    min="0"
                    step={form.discount_type === 'percent' ? '1' : '0.01'}
                    value={form.discount_value}
                    onChange={(e) => setForm(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                  />
                </label>
              </div>
              <div className="form-row form-row-2col">
                <label>
                  Max. použití (prázdné = neomezeno)
                  <input
                    type="number"
                    min="0"
                    value={form.max_uses}
                    onChange={(e) => setForm(prev => ({ ...prev, max_uses: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                    placeholder="Neomezeno"
                  />
                </label>
                <label>
                  Limit na uživatele
                  <input
                    type="number"
                    min="0"
                    value={form.per_user_limit}
                    onChange={(e) => setForm(prev => ({ ...prev, per_user_limit: parseInt(e.target.value) || 0 }))}
                  />
                </label>
              </div>
              <div className="form-row form-row-2col">
                <label>
                  Platnost od
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm(prev => ({ ...prev, valid_from: e.target.value }))}
                  />
                </label>
                <label>
                  Platnost do (prázdné = neomezeno)
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Platné pro plány (čárkou oddělené, prázdné = vše)
                  <input
                    type="text"
                    value={form.applicable_plans}
                    onChange={(e) => setForm(prev => ({ ...prev, applicable_plans: e.target.value }))}
                    placeholder="starter, business, premium"
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className="toggle-text">Aktivní</span>
                </label>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-cancel-btn" onClick={() => setModalOpen(false)}>
                Zrušit
              </button>
              <button className="modal-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Ukládám...' : editingCode ? 'Uložit změny' : 'Vytvořit kód'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Usage Detail Modal */}
      {usageModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setUsageModalOpen(false)}>
          <motion.div
            className="admin-modal usage-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h3>Historie použití: {usageCodeName}</h3>
              <button className="modal-close-btn" onClick={() => setUsageModalOpen(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="admin-modal-body">
              {loadingUsage ? (
                <div className="loading-container" style={{ minHeight: '200px' }}>
                  <div className="spinner"></div>
                  <p>Načítání...</p>
                </div>
              ) : usageData.length === 0 ? (
                <div className="no-orders" style={{ padding: '2rem' }}>
                  <p>Tento kód nebyl zatím použit</p>
                </div>
              ) : (
                <table className="orders-table usage-table">
                  <thead>
                    <tr>
                      <th>Uživatel</th>
                      <th>Objednávka</th>
                      <th>Sleva</th>
                      <th>Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.map((usage) => (
                      <tr key={usage.id}>
                        <td>
                          {usage.first_name || usage.last_name
                            ? `${usage.first_name || ''} ${usage.last_name || ''}`.trim()
                            : usage.email || usage.user_id}
                        </td>
                        <td>#{usage.order_id}</td>
                        <td className="price">{formatPrice(usage.discount_amount)}</td>
                        <td className="date">{formatDate(usage.used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminPromo;
