import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHandshake,
  faUsers,
  faMoneyBillWave,
  faWallet,
  faChartLine,
  faSearch,
  faEdit,
  faCheck,
  faTimesCircle,
  faCheckCircle,
  faClock,
  faSpinner,
  faChevronLeft,
  faChevronRight,
  faArrowLeft,
  faTimes,
  faFilter,
  faCheckDouble,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import {
  getAdminAffiliateStats,
  getAdminAffiliateAccounts,
  updateAdminAffiliateAccount,
  getAdminAffiliateCommissions,
  updateAdminCommissionStatus,
  bulkApproveCommissions,
  getAdminAffiliatePayouts,
  updateAdminPayoutStatus,
  AdminAffiliateStats,
  AdminAffiliateAccount,
  AffiliateCommission,
  AffiliatePayout,
  PaginationMeta,
} from '../lib/api';
import './AdminAffiliate.css';

type Tab = 'overview' | 'accounts' | 'commissions' | 'payouts';

const AdminAffiliate: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  // Overview
  const [stats, setStats] = useState<AdminAffiliateStats | null>(null);

  // Accounts
  const [accounts, setAccounts] = useState<AdminAffiliateAccount[]>([]);
  const [accountsPagination, setAccountsPagination] = useState<PaginationMeta | null>(null);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsSearch, setAccountsSearch] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAffiliateAccount | null>(null);
  const [editForm, setEditForm] = useState({ commission_rate: 10, tier: 'bronze', is_active: true });
  const [saving, setSaving] = useState(false);

  // Commissions
  const [commissions, setCommissions] = useState<(AffiliateCommission & { user_email?: string; referral_code?: string })[]>([]);
  const [commissionsPagination, setCommissionsPagination] = useState<PaginationMeta | null>(null);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [commissionsStatusFilter, setCommissionsStatusFilter] = useState('');
  const [selectedCommissions, setSelectedCommissions] = useState<number[]>([]);
  const [processingCommission, setProcessingCommission] = useState<number | null>(null);

  // Payouts
  const [payouts, setPayouts] = useState<(AffiliatePayout & { user_email?: string; referral_code?: string })[]>([]);
  const [payoutsPagination, setPayoutsPagination] = useState<PaginationMeta | null>(null);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsStatusFilter, setPayoutsStatusFilter] = useState('');
  const [processingPayout, setProcessingPayout] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchStats();
  }, [user, profile, navigate]);

  useEffect(() => {
    if (activeTab === 'accounts') fetchAccounts(accountsPage);
    if (activeTab === 'commissions') fetchCommissions(commissionsPage);
    if (activeTab === 'payouts') fetchPayouts(payoutsPage);
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const s = await getAdminAffiliateStats();
      setStats(s);
    } catch (error) {
      console.error('Error fetching affiliate stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = useCallback(async (page: number) => {
    try {
      const result = await getAdminAffiliateAccounts({ page, search: accountsSearch || undefined });
      setAccounts(result.accounts || []);
      setAccountsPagination(result.pagination || null);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [accountsSearch]);

  const fetchCommissions = useCallback(async (page: number) => {
    try {
      const result = await getAdminAffiliateCommissions({ page, status: commissionsStatusFilter || undefined });
      setCommissions(result.commissions || []);
      setCommissionsPagination(result.pagination || null);
      setSelectedCommissions([]);
    } catch (error) {
      console.error('Error fetching commissions:', error);
    }
  }, [commissionsStatusFilter]);

  const fetchPayouts = useCallback(async (page: number) => {
    try {
      const result = await getAdminAffiliatePayouts({ page, status: payoutsStatusFilter || undefined });
      setPayouts(result.payouts || []);
      setPayoutsPagination(result.pagination || null);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  }, [payoutsStatusFilter]);

  // Refetch on page/filter changes
  useEffect(() => { if (activeTab === 'accounts') fetchAccounts(accountsPage); }, [accountsPage, accountsSearch]);
  useEffect(() => { if (activeTab === 'commissions') fetchCommissions(commissionsPage); }, [commissionsPage, commissionsStatusFilter]);
  useEffect(() => { if (activeTab === 'payouts') fetchPayouts(payoutsPage); }, [payoutsPage, payoutsStatusFilter]);

  // Search debounce for accounts
  useEffect(() => {
    if (activeTab === 'accounts') {
      const timer = setTimeout(() => { setAccountsPage(1); fetchAccounts(1); }, 300);
      return () => clearTimeout(timer);
    }
  }, [accountsSearch]);

  const handleEditAccount = (acc: AdminAffiliateAccount) => {
    setEditingAccount(acc);
    setEditForm({
      commission_rate: acc.commission_rate,
      tier: acc.tier,
      is_active: acc.is_active,
    });
    setEditModalOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!editingAccount) return;
    try {
      setSaving(true);
      await updateAdminAffiliateAccount(editingAccount.id, editForm);
      showSuccess('\u00da\u010det byl aktualizov\u00e1n');
      setEditModalOpen(false);
      fetchAccounts(accountsPage);
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Chyba p\u0159i ukl\u00e1d\u00e1n\u00ed');
    } finally {
      setSaving(false);
    }
  };

  const handleCommissionAction = async (id: number, status: 'approved' | 'rejected') => {
    try {
      setProcessingCommission(id);
      await updateAdminCommissionStatus(id, status);
      showSuccess(status === 'approved' ? 'Provize schv\u00e1lena' : 'Provize zam\u00edtnuta');
      fetchCommissions(commissionsPage);
      fetchStats();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Chyba');
    } finally {
      setProcessingCommission(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedCommissions.length === 0) return;
    try {
      await bulkApproveCommissions(selectedCommissions);
      showSuccess(`${selectedCommissions.length} proviz\u00ed schv\u00e1leno`);
      fetchCommissions(commissionsPage);
      fetchStats();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Chyba');
    }
  };

  const handlePayoutAction = async (id: number, status: 'completed' | 'rejected') => {
    try {
      setProcessingPayout(id);
      await updateAdminPayoutStatus(id, status);
      showSuccess(status === 'completed' ? 'V\u00fdplata zpracov\u00e1na' : 'V\u00fdplata zam\u00edtnuta');
      fetchPayouts(payoutsPage);
      fetchStats();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Chyba');
    } finally {
      setProcessingPayout(null);
    }
  };

  const toggleCommissionSelection = (id: number) => {
    setSelectedCommissions(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(price);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string; icon: any }> = {
      pending: { cls: 'adminaff-badge--warning', label: '\u010cekaj\u00edc\u00ed', icon: faClock },
      approved: { cls: 'adminaff-badge--success', label: 'Schv\u00e1leno', icon: faCheckCircle },
      paid: { cls: 'adminaff-badge--info', label: 'Vyplaceno', icon: faWallet },
      rejected: { cls: 'adminaff-badge--danger', label: 'Zam\u00edtnuto', icon: faTimesCircle },
      completed: { cls: 'adminaff-badge--success', label: 'Dokon\u010deno', icon: faCheckCircle },
    };
    const s = map[status] || { cls: 'adminaff-badge--neutral', label: status, icon: faClock };
    return <span className={`adminaff-badge ${s.cls}`}><FontAwesomeIcon icon={s.icon} /> {s.label}</span>;
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'P\u0159ehled' },
    { key: 'accounts', label: '\u00da\u010dty' },
    { key: 'commissions', label: 'Provize' },
    { key: 'payouts', label: 'V\u00fdplaty' },
  ];

  if (loading && !stats) {
    return (
      <div className="adminaff-page">
        <div className="adminaff-container">
          <div className="adminaff-loading"><FontAwesomeIcon icon={faSpinner} spin /> Na\u010d\u00edt\u00e1m...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="adminaff-page">
      <div className="adminaff-container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="adminaff-header">
            <button className="adminaff-back-btn" onClick={() => navigate('/admin')}>
              <FontAwesomeIcon icon={faArrowLeft} /> Zp\u011bt
            </button>
            <div className="adminaff-header__icon">
              <FontAwesomeIcon icon={faHandshake} />
            </div>
            <div className="adminaff-header__info">
              <h1 className="adminaff-header__title">Affiliate spr\u00e1va</h1>
              <p className="adminaff-header__subtitle">Spr\u00e1va affiliate \u00fa\u010dt\u016f, proviz\u00ed a v\u00fdplat</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="adminaff-tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`adminaff-tab ${activeTab === tab.key ? 'adminaff-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && stats && (
            <div className="adminaff-stats-grid">
              <div className="adminaff-stat-card">
                <div className="adminaff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div className="adminaff-stat-card__content">
                  <h3>{stats.total_affiliates}</h3>
                  <p>Celkem affiliate</p>
                </div>
              </div>
              <div className="adminaff-stat-card">
                <div className="adminaff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
                <div className="adminaff-stat-card__content">
                  <h3>{stats.active_affiliates}</h3>
                  <p>Aktivn\u00edch</p>
                </div>
              </div>
              <div className="adminaff-stat-card">
                <div className="adminaff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                </div>
                <div className="adminaff-stat-card__content">
                  <h3>{formatPrice(stats.total_commissions)}</h3>
                  <p>Celkov\u00e9 provize</p>
                </div>
              </div>
              <div className="adminaff-stat-card">
                <div className="adminaff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  <FontAwesomeIcon icon={faWallet} />
                </div>
                <div className="adminaff-stat-card__content">
                  <h3>{formatPrice(stats.pending_payouts)}</h3>
                  <p>\u010cekaj\u00edc\u00ed v\u00fdplaty</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Accounts */}
          {activeTab === 'accounts' && (
            <div className="adminaff-section">
              <div className="adminaff-toolbar">
                <div className="adminaff-search">
                  <FontAwesomeIcon icon={faSearch} />
                  <input
                    type="text"
                    placeholder="Hledat podle k\u00f3du nebo emailu..."
                    value={accountsSearch}
                    onChange={(e) => setAccountsSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="adminaff-table-wrapper">
                <table className="adminaff-table">
                  <thead>
                    <tr>
                      <th>U\u017eivatel</th>
                      <th>K\u00f3d</th>
                      <th>Tier</th>
                      <th>Sazba %</th>
                      <th>P\u0159\u00edjmy</th>
                      <th>\u010cekaj\u00edc\u00ed</th>
                      <th>Doporu\u010den\u00ed</th>
                      <th>Konverze</th>
                      <th>Status</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.length === 0 ? (
                      <tr><td colSpan={10} className="adminaff-empty-cell">\u017d\u00e1dn\u00e9 affiliate \u00fa\u010dty</td></tr>
                    ) : accounts.map(acc => (
                      <tr key={acc.id}>
                        <td data-label="U\u017eivatel">
                          <div>{[acc.user_first_name, acc.user_last_name].filter(Boolean).join(' ') || '\u2014'}</div>
                          <small style={{ color: 'var(--text-muted)' }}>{acc.user_email}</small>
                        </td>
                        <td data-label="K\u00f3d"><code>{acc.referral_code}</code></td>
                        <td data-label="Tier">{acc.tier}</td>
                        <td data-label="Sazba">{acc.commission_rate}%</td>
                        <td data-label="P\u0159\u00edjmy">{formatPrice(acc.total_earnings)}</td>
                        <td data-label="\u010cekaj\u00edc\u00ed">{formatPrice(acc.pending_balance)}</td>
                        <td data-label="Doporu\u010den\u00ed">{acc.total_referrals}</td>
                        <td data-label="Konverze">{acc.total_conversions}</td>
                        <td data-label="Status">
                          {acc.is_active ? (
                            <span className="adminaff-badge adminaff-badge--success"><FontAwesomeIcon icon={faCheckCircle} /> Aktivn\u00ed</span>
                          ) : (
                            <span className="adminaff-badge adminaff-badge--danger"><FontAwesomeIcon icon={faTimesCircle} /> Neaktivn\u00ed</span>
                          )}
                        </td>
                        <td data-label="Akce">
                          <button className="adminaff-action-btn" title="Upravit" onClick={() => handleEditAccount(acc)}>
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {accountsPagination && accountsPagination.totalPages > 1 && (
                <div className="adminaff-pagination">
                  <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setAccountsPage(p => Math.max(1, p - 1))} disabled={accountsPage <= 1} aria-label="Předchozí stránka">
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <span>{accountsPage} / {accountsPagination.totalPages}</span>
                  <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setAccountsPage(p => Math.min(accountsPagination!.totalPages, p + 1))} disabled={accountsPage >= accountsPagination.totalPages} aria-label="Další stránka">
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab: Commissions */}
          {activeTab === 'commissions' && (
            <div className="adminaff-section">
              <div className="adminaff-toolbar">
                <div className="adminaff-filter-row">
                  <FontAwesomeIcon icon={faFilter} />
                  {['', 'pending', 'approved', 'paid', 'rejected'].map(s => (
                    <button
                      key={s}
                      className={`adminaff-filter-btn ${commissionsStatusFilter === s ? 'active' : ''}`}
                      onClick={() => { setCommissionsStatusFilter(s); setCommissionsPage(1); }}
                    >
                      {s === '' ? 'V\u0161e' : s === 'pending' ? '\u010cekaj\u00edc\u00ed' : s === 'approved' ? 'Schv\u00e1len\u00e9' : s === 'paid' ? 'Vyplacen\u00e9' : 'Zam\u00edtnut\u00e9'}
                    </button>
                  ))}
                </div>
                {selectedCommissions.length > 0 && (
                  <button className="adminaff-btn adminaff-btn--success" onClick={handleBulkApprove}>
                    <FontAwesomeIcon icon={faCheckDouble} /> Schv\u00e1lit vybran\u00e9 ({selectedCommissions.length})
                  </button>
                )}
              </div>
              <div className="adminaff-table-wrapper">
                <table className="adminaff-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Datum</th>
                      <th>Affiliate</th>
                      <th>Objedn\u00e1vka</th>
                      <th>\u010c\u00e1stka</th>
                      <th>Provize</th>
                      <th>Status</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.length === 0 ? (
                      <tr><td colSpan={8} className="adminaff-empty-cell">\u017d\u00e1dn\u00e9 provize</td></tr>
                    ) : commissions.map(c => (
                      <tr key={c.id}>
                        <td>
                          {c.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selectedCommissions.includes(c.id)}
                              onChange={() => toggleCommissionSelection(c.id)}
                            />
                          )}
                        </td>
                        <td data-label="Datum">{formatDate(c.created_at)}</td>
                        <td data-label="Affiliate">{c.user_email || c.referral_code || '\u2014'}</td>
                        <td data-label="Objedn\u00e1vka">#{c.order_id}</td>
                        <td data-label="\u010c\u00e1stka">{formatPrice(c.order_amount)}</td>
                        <td data-label="Provize">{formatPrice(c.commission_amount)}</td>
                        <td data-label="Status">{getStatusBadge(c.status)}</td>
                        <td data-label="Akce">
                          {c.status === 'pending' && (
                            <div className="adminaff-action-buttons">
                              <button
                                className="adminaff-action-btn approve"
                                title="Schv\u00e1lit"
                                onClick={() => handleCommissionAction(c.id, 'approved')}
                                disabled={processingCommission === c.id}
                              >
                                <FontAwesomeIcon icon={processingCommission === c.id ? faSpinner : faCheck} spin={processingCommission === c.id} />
                              </button>
                              <button
                                className="adminaff-action-btn reject"
                                title="Zam\u00edtnout"
                                onClick={() => handleCommissionAction(c.id, 'rejected')}
                                disabled={processingCommission === c.id}
                              >
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {commissionsPagination && commissionsPagination.totalPages > 1 && (
                <div className="adminaff-pagination">
                  <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setCommissionsPage(p => Math.max(1, p - 1))} disabled={commissionsPage <= 1} aria-label="Předchozí stránka">
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <span>{commissionsPage} / {commissionsPagination.totalPages}</span>
                  <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setCommissionsPage(p => Math.min(commissionsPagination!.totalPages, p + 1))} disabled={commissionsPage >= commissionsPagination.totalPages} aria-label="Další stránka">
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab: Payouts */}
          {activeTab === 'payouts' && (
            <div className="adminaff-section">
              <div className="adminaff-toolbar">
                <div className="adminaff-filter-row">
                  <FontAwesomeIcon icon={faFilter} />
                  {['', 'pending', 'completed', 'rejected'].map(s => (
                    <button
                      key={s}
                      className={`adminaff-filter-btn ${payoutsStatusFilter === s ? 'active' : ''}`}
                      onClick={() => { setPayoutsStatusFilter(s); setPayoutsPage(1); }}
                    >
                      {s === '' ? 'V\u0161e' : s === 'pending' ? '\u010cekaj\u00edc\u00ed' : s === 'completed' ? 'Dokon\u010den\u00e9' : 'Zam\u00edtnut\u00e9'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adminaff-table-wrapper">
                <table className="adminaff-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Affiliate</th>
                      <th>\u010c\u00e1stka</th>
                      <th>Metoda</th>
                      <th>Status</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.length === 0 ? (
                      <tr><td colSpan={6} className="adminaff-empty-cell">\u017d\u00e1dn\u00e9 v\u00fdplaty</td></tr>
                    ) : payouts.map(p => (
                      <tr key={p.id}>
                        <td data-label="Datum">{formatDate(p.created_at)}</td>
                        <td data-label="Affiliate">{p.user_email || p.referral_code || '\u2014'}</td>
                        <td data-label="\u010c\u00e1stka">{formatPrice(p.amount)}</td>
                        <td data-label="Metoda">{p.method === 'credit' ? 'Kredit' : p.method}</td>
                        <td data-label="Status">{getStatusBadge(p.status)}</td>
                        <td data-label="Akce">
                          {p.status === 'pending' && (
                            <div className="adminaff-action-buttons">
                              <button
                                className="adminaff-action-btn approve"
                                title="Zpracovat"
                                onClick={() => handlePayoutAction(p.id, 'completed')}
                                disabled={processingPayout === p.id}
                              >
                                <FontAwesomeIcon icon={processingPayout === p.id ? faSpinner : faCheck} spin={processingPayout === p.id} />
                              </button>
                              <button
                                className="adminaff-action-btn reject"
                                title="Zam\u00edtnout"
                                onClick={() => handlePayoutAction(p.id, 'rejected')}
                                disabled={processingPayout === p.id}
                              >
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {payoutsPagination && payoutsPagination.totalPages > 1 && (
                <div className="adminaff-pagination">
                  <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setPayoutsPage(p => Math.max(1, p - 1))} disabled={payoutsPage <= 1} aria-label="Předchozí stránka">
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <span>{payoutsPage} / {payoutsPagination.totalPages}</span>
                  <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setPayoutsPage(p => Math.min(payoutsPagination!.totalPages, p + 1))} disabled={payoutsPage >= payoutsPagination.totalPages} aria-label="Další stránka">
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Edit Account Modal */}
      {editModalOpen && editingAccount && (
        <div className="adminaff-modal-overlay" onClick={() => setEditModalOpen(false)}>
          <motion.div
            className="adminaff-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adminaff-modal__header">
              <h3>Upravit affiliate \u00fa\u010det</h3>
              <button className="adminaff-modal__close" onClick={() => setEditModalOpen(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="adminaff-modal__body">
              <div className="adminaff-modal__info">
                <strong>{editingAccount.user_email}</strong>
                <span>K\u00f3d: {editingAccount.referral_code}</span>
              </div>

              <div className="adminaff-form-group">
                <label>Provizn\u00ed sazba (%)</label>
                <input
                  type="number"
                  className="adminaff-input"
                  value={editForm.commission_rate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, commission_rate: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  max={100}
                />
              </div>

              <div className="adminaff-form-group">
                <label>Tier</label>
                <select
                  className="adminaff-input"
                  value={editForm.tier}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tier: e.target.value }))}
                >
                  <option value="bronze">Bronze (10%)</option>
                  <option value="silver">Silver (15%)</option>
                  <option value="gold">Gold (20%)</option>
                </select>
              </div>

              <div className="adminaff-form-group">
                <label className="adminaff-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span>Aktivn\u00ed</span>
                </label>
              </div>
            </div>
            <div className="adminaff-modal__footer">
              <button className="adminaff-btn adminaff-btn--ghost" onClick={() => setEditModalOpen(false)}>Zru\u0161it</button>
              <button className="adminaff-btn adminaff-btn--primary" onClick={handleSaveAccount} disabled={saving}>
                {saving ? <><FontAwesomeIcon icon={faSpinner} spin /> Ukl\u00e1d\u00e1m...</> : 'Ulo\u017eit'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminAffiliate;
