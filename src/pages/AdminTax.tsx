import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPercent,
  faArrowLeft,
  faSearch,
  faFilter,
  faPlus,
  faEdit,
  faSave,
  faTimes,
  faCheckCircle,
  faTimesCircle,
  faGlobe,
  faEuroSign
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { apiCall, getTaxRates, TaxRate } from '../lib/api';
import './AdminTax.css';

const AdminTax: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [euFilter, setEuFilter] = useState<'all' | 'eu'>('all');
  const [sortBy, setSortBy] = useState<'country' | 'rate'>('country');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineRate, setInlineRate] = useState<number>(0);

  // Form state
  const [form, setForm] = useState({
    country_code: '',
    country_name: '',
    tax_rate: 0,
    tax_type: 'vat' as 'vat' | 'sales_tax' | 'gst',
    is_eu: false
  });

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchTaxRates();
  }, [user, profile, navigate]);

  const fetchTaxRates = async () => {
    try {
      setLoading(true);
      const rates = await getTaxRates();
      setTaxRates(rates);
    } catch (error) {
      console.error('Error fetching tax rates:', error);
      showError('Chyba při načítání daňových sazeb');
    } finally {
      setLoading(false);
    }
  };

  const filteredRates = taxRates
    .filter(r => {
      if (euFilter === 'eu' && !r.is_eu) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return r.country_name.toLowerCase().includes(term) ||
        r.country_code.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (sortBy === 'country') return a.country_name.localeCompare(b.country_name, 'cs');
      return b.tax_rate - a.tax_rate;
    });

  const openCreateModal = () => {
    setEditingRate(null);
    setForm({
      country_code: '',
      country_name: '',
      tax_rate: 21,
      tax_type: 'vat',
      is_eu: false
    });
    setModalOpen(true);
  };

  const openEditModal = (rate: TaxRate) => {
    setEditingRate(rate);
    setForm({
      country_code: rate.country_code,
      country_name: rate.country_name,
      tax_rate: rate.tax_rate,
      tax_type: rate.tax_type,
      is_eu: rate.is_eu
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.country_code.trim() || !form.country_name.trim()) {
      showError('Kód země a název jsou povinné');
      return;
    }

    try {
      setSaving(true);
      if (editingRate) {
        await apiCall(`/admin/tax/rates/${editingRate.id}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        });
        showSuccess('Daňová sazba byla aktualizována');
      } else {
        await apiCall('/admin/tax/rates', {
          method: 'POST',
          body: JSON.stringify(form)
        });
        showSuccess('Daňová sazba byla vytvořena');
      }
      setModalOpen(false);
      fetchTaxRates();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při ukládání daňové sazby');
    } finally {
      setSaving(false);
    }
  };

  const startInlineEdit = (rate: TaxRate) => {
    setInlineEditId(rate.id);
    setInlineRate(rate.tax_rate);
  };

  const saveInlineEdit = async (rate: TaxRate) => {
    try {
      await apiCall(`/admin/tax/rates/${rate.id}`, {
        method: 'PUT',
        body: JSON.stringify({ tax_rate: inlineRate })
      });
      showSuccess('Sazba aktualizována');
      setInlineEditId(null);
      fetchTaxRates();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při ukládání');
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  const getTaxTypeBadge = (type: string) => {
    const colorMap: Record<string, string> = {
      vat: '#2563eb',
      sales_tax: '#f59e0b',
      gst: '#10b981'
    };
    const labelMap: Record<string, string> = {
      vat: 'DPH',
      sales_tax: 'Daň z prodeje',
      gst: 'GST'
    };
    const color = colorMap[type] || '#6b7280';
    return (
      <span
        className="tax-type-badge"
        style={{ background: `${color}15`, color, borderColor: `${color}30` }}
      >
        {labelMap[type] || type}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání daňových sazeb...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <motion.div
          className="admin-header tax-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="admin-header-content">
            <div className="admin-title-section">
              <div className="admin-icon-wrapper">
                <FontAwesomeIcon icon={faPercent} />
              </div>
              <div>
                <h1>DPH / Daně</h1>
                <p>Správa daňových sazeb podle zemí</p>
              </div>
            </div>
            <div className="admin-quick-links">
              <button className="quick-link-btn" onClick={() => navigate('/admin')}>
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Zpět na administraci</span>
              </button>
              <button className="quick-link-btn" onClick={openCreateModal}>
                <FontAwesomeIcon icon={faPlus} />
                <span>Nová sazba</span>
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
              <FontAwesomeIcon icon={faGlobe} />
            </div>
            <div className="stat-content">
              <h3>{taxRates.length}</h3>
              <p>Celkem zemí</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faEuroSign} />
            </div>
            <div className="stat-content">
              <h3>{taxRates.filter(r => r.is_eu).length}</h3>
              <p>EU zemí</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <FontAwesomeIcon icon={faPercent} />
            </div>
            <div className="stat-content">
              <h3>{taxRates.length > 0 ? `${(taxRates.reduce((s, r) => s + r.tax_rate, 0) / taxRates.length).toFixed(1)}%` : '0%'}</h3>
              <p>Průměrná sazba</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
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
              placeholder="Hledat podle země..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${euFilter === 'all' ? 'active' : ''}`}
              onClick={() => setEuFilter('all')}
            >
              <FontAwesomeIcon icon={faFilter} />
              Vše
            </button>
            <button
              className={`filter-btn ${euFilter === 'eu' ? 'active' : ''}`}
              onClick={() => setEuFilter('eu')}
            >
              <FontAwesomeIcon icon={faEuroSign} />
              Pouze EU
            </button>
            <button
              className={`filter-btn ${sortBy === 'country' ? 'active' : ''}`}
              onClick={() => setSortBy('country')}
            >
              Podle země
            </button>
            <button
              className={`filter-btn ${sortBy === 'rate' ? 'active' : ''}`}
              onClick={() => setSortBy('rate')}
            >
              Podle sazby
            </button>
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
              <FontAwesomeIcon icon={faPercent} className="section-icon" />
              Daňové sazby ({filteredRates.length})
            </h2>
          </div>

          {filteredRates.length === 0 ? (
            <div className="no-orders">
              <FontAwesomeIcon icon={faGlobe} />
              <p>Žádné daňové sazby</p>
            </div>
          ) : (
            <div className="table-wrapper table-responsive">
              <table className="orders-table tax-table">
                <thead>
                  <tr>
                    <th>Země</th>
                    <th>Kód</th>
                    <th>Sazba DPH</th>
                    <th>Typ</th>
                    <th>EU</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map((rate) => (
                    <tr key={rate.id}>
                      <td className="customer-name">{rate.country_name}</td>
                      <td>
                        <code className="country-code-cell">{rate.country_code}</code>
                      </td>
                      <td>
                        {inlineEditId === rate.id ? (
                          <div className="inline-edit-cell">
                            <input
                              type="number"
                              className="inline-edit-input"
                              value={inlineRate}
                              onChange={(e) => setInlineRate(parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineEdit(rate);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                            />
                            <span className="inline-edit-suffix">%</span>
                            <button className="inline-edit-save" onClick={() => saveInlineEdit(rate)}>
                              <FontAwesomeIcon icon={faCheckCircle} />
                            </button>
                            <button className="inline-edit-cancel" onClick={cancelInlineEdit}>
                              <FontAwesomeIcon icon={faTimesCircle} />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="tax-rate-value"
                            onClick={() => startInlineEdit(rate)}
                            title="Kliknutím upravíte sazbu"
                          >
                            {rate.tax_rate}%
                          </span>
                        )}
                      </td>
                      <td>{getTaxTypeBadge(rate.tax_type)}</td>
                      <td>
                        {rate.is_eu ? (
                          <span className="eu-badge yes">
                            <FontAwesomeIcon icon={faCheckCircle} />
                            EU
                          </span>
                        ) : (
                          <span className="eu-badge no">
                            <FontAwesomeIcon icon={faTimesCircle} />
                            Ne
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn edit"
                            title="Upravit"
                            onClick={() => openEditModal(rate)}
                          >
                            <FontAwesomeIcon icon={faEdit} />
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
            className="admin-modal tax-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h3>{editingRate ? 'Upravit daňovou sazbu' : 'Nová daňová sazba'}</h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="form-row form-row-2col">
                <label>
                  Kód země (ISO)
                  <input
                    type="text"
                    value={form.country_code}
                    onChange={(e) => setForm(prev => ({ ...prev, country_code: e.target.value.toUpperCase() }))}
                    placeholder="CZ"
                    maxLength={2}
                  />
                </label>
                <label>
                  Název země
                  <input
                    type="text"
                    value={form.country_name}
                    onChange={(e) => setForm(prev => ({ ...prev, country_name: e.target.value }))}
                    placeholder="Česko"
                  />
                </label>
              </div>
              <div className="form-row form-row-2col">
                <label>
                  Sazba (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.tax_rate}
                    onChange={(e) => setForm(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                  />
                </label>
                <label>
                  Typ daně
                  <select
                    value={form.tax_type}
                    onChange={(e) => setForm(prev => ({ ...prev, tax_type: e.target.value as 'vat' | 'sales_tax' | 'gst' }))}
                  >
                    <option value="vat">DPH (VAT)</option>
                    <option value="sales_tax">Daň z prodeje</option>
                    <option value="gst">GST</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_eu}
                    onChange={(e) => setForm(prev => ({ ...prev, is_eu: e.target.checked }))}
                  />
                  <span className="toggle-text">Členský stát EU</span>
                </label>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-cancel-btn" onClick={() => setModalOpen(false)}>
                Zrušit
              </button>
              <button className="modal-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Ukládám...' : editingRate ? 'Uložit změny' : 'Vytvořit sazbu'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminTax;
