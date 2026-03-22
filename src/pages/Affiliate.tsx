import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHandshake,
  faMoneyBillWave,
  faUsers,
  faChartLine,
  faPercent,
  faCopy,
  faEnvelope,
  faLink,
  faWallet,
  faSpinner,
  faCheckCircle,
  faClock,
  faTimesCircle,
  faChevronLeft,
  faChevronRight,
  faTrophy,
  faMedal,
  faCrown,
  faRocket,
  faArrowRight,
  faGift,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
  getAffiliateAccount,
  joinAffiliateProgram,
  getAffiliateStats,
  getAffiliateCommissions,
  getAffiliateReferrals,
  getAffiliatePayouts,
  requestAffiliatePayout,
  AffiliateAccount,
  AffiliateCommission,
  AffiliateReferral,
  AffiliatePayout,
  AffiliateStats,
  PaginationMeta,
} from '../lib/api';
import PageMeta from '../components/PageMeta';
import './Affiliate.css';

const TIER_CONFIG = {
  bronze: { label: 'Bronze', icon: faMedal, color: '#cd7f32', rate: 10, next: 'silver', nextAt: 10 },
  silver: { label: 'Silver', icon: faTrophy, color: '#c0c0c0', rate: 15, next: 'gold', nextAt: 50 },
  gold: { label: 'Gold', icon: faCrown, color: '#ffd700', rate: 20, next: null, nextAt: null },
};

const Affiliate: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [account, setAccount] = useState<AffiliateAccount | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [commissionsPagination, setCommissionsPagination] = useState<PaginationMeta | null>(null);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [referralsPagination, setReferralsPagination] = useState<PaginationMeta | null>(null);
  const [referralsPage, setReferralsPage] = useState(1);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [payoutsPagination, setPayoutsPagination] = useState<PaginationMeta | null>(null);
  const [payoutsPage, setPayoutsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAccount();
    }
  }, [user]);

  const fetchAccount = async () => {
    try {
      setLoading(true);
      const acc = await getAffiliateAccount();
      setAccount(acc);
      if (acc) {
        await Promise.all([fetchStats(), fetchCommissions(1), fetchReferrals(1), fetchPayouts(1)]);
      }
    } catch (error) {
      console.error('Error fetching affiliate account:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const s = await getAffiliateStats();
      setStats(s);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCommissions = async (page: number) => {
    try {
      const result = await getAffiliateCommissions(page);
      setCommissions(result.commissions || []);
      setCommissionsPagination(result.pagination || null);
    } catch (error) {
      console.error('Error fetching commissions:', error);
    }
  };

  const fetchReferrals = async (page: number) => {
    try {
      const result = await getAffiliateReferrals(page);
      setReferrals(result.referrals || []);
      setReferralsPagination(result.pagination || null);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
  };

  const fetchPayouts = async (page: number) => {
    try {
      const result = await getAffiliatePayouts(page);
      setPayouts(result.payouts || []);
      setPayoutsPagination(result.pagination || null);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  };

  useEffect(() => {
    if (account && commissionsPage > 1) fetchCommissions(commissionsPage);
  }, [commissionsPage]);

  useEffect(() => {
    if (account && referralsPage > 1) fetchReferrals(referralsPage);
  }, [referralsPage]);

  useEffect(() => {
    if (account && payoutsPage > 1) fetchPayouts(payoutsPage);
  }, [payoutsPage]);

  const handleJoin = async () => {
    try {
      setJoining(true);
      const acc = await joinAffiliateProgram();
      setAccount(acc);
      showToast('Byli jste p\u0159ipojeni k affiliate programu!', 'success');
      await Promise.all([fetchStats(), fetchCommissions(1), fetchReferrals(1), fetchPayouts(1)]);
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Nepoda\u0159ilo se p\u0159ipojit', 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleCopyLink = () => {
    if (!account) return;
    const link = `https://alatyrhosting.eu/ref/${account.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('Odkaz zkop\u00edrovan\u00fd do schr\u00e1nky!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailShare = () => {
    if (!account) return;
    const link = `https://alatyrhosting.eu/ref/${account.referral_code}`;
    const subject = encodeURIComponent('Vyzkou\u0161ej Alatyr Hosting');
    const body = encodeURIComponent(`Ahoj, doporu\u010duji ti hosting od Alatyr Hosting. Registruj se p\u0159es m\u016fj odkaz: ${link}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < 50) {
      showToast('Minim\u00e1ln\u00ed \u010d\u00e1stka pro v\u00fdplatu je 50 K\u010d', 'error');
      return;
    }
    if (account && amount > account.pending_balance) {
      showToast('\u010c\u00e1stka p\u0159esahuje \u010dekaj\u00edc\u00ed z\u016fstatek', 'error');
      return;
    }

    try {
      setRequestingPayout(true);
      await requestAffiliatePayout(amount);
      showToast('Po\u017eadavek na v\u00fdplatu byl odesl\u00e1n', 'success');
      setPayoutAmount('');
      await Promise.all([fetchAccount()]);
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Chyba p\u0159i po\u017eadavku na v\u00fdplatu', 'error');
    } finally {
      setRequestingPayout(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
    }).format(price);
  };

  const getCommissionStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="aff-badge aff-badge--warning"><FontAwesomeIcon icon={faClock} /> \u010cekaj\u00edc\u00ed</span>;
      case 'approved':
        return <span className="aff-badge aff-badge--success"><FontAwesomeIcon icon={faCheckCircle} /> Schv\u00e1len\u00e1</span>;
      case 'paid':
        return <span className="aff-badge aff-badge--info"><FontAwesomeIcon icon={faWallet} /> Vyplacen\u00e1</span>;
      case 'rejected':
        return <span className="aff-badge aff-badge--danger"><FontAwesomeIcon icon={faTimesCircle} /> Zam\u00edtnut\u00e1</span>;
      default:
        return <span className="aff-badge aff-badge--neutral">{status}</span>;
    }
  };

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="aff-badge aff-badge--warning"><FontAwesomeIcon icon={faClock} /> \u010cekaj\u00edc\u00ed</span>;
      case 'completed':
        return <span className="aff-badge aff-badge--success"><FontAwesomeIcon icon={faCheckCircle} /> Dokon\u010deno</span>;
      case 'rejected':
        return <span className="aff-badge aff-badge--danger"><FontAwesomeIcon icon={faTimesCircle} /> Zam\u00edtnuto</span>;
      default:
        return <span className="aff-badge aff-badge--neutral">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="aff-page">
        <PageMeta title="Affiliate program" description="P\u0159ipojte se k affiliate programu Alatyr Hosting." path="/affiliate" noindex />
        <div className="aff-container">
          <div className="aff-loading">
            <FontAwesomeIcon icon={faSpinner} spin /> Na\u010d\u00edt\u00e1m affiliate \u00fadaje...
          </div>
        </div>
      </div>
    );
  }

  // Not joined state
  if (!account) {
    return (
      <div className="aff-page">
        <PageMeta title="Affiliate program" description="P\u0159ipojte se k affiliate programu Alatyr Hosting." path="/affiliate" noindex />
        <div className="aff-container">
          <motion.div
            className="aff-hero"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="aff-hero__icon">
              <FontAwesomeIcon icon={faHandshake} />
            </div>
            <h1 className="aff-hero__title">Affiliate program</h1>
            <p className="aff-hero__subtitle">
              Z\u00edskejte 10% provizi z ka\u017ed\u00e9 objedn\u00e1vky va\u0161ich doporu\u010den\u00fdch z\u00e1kazn\u00edk\u016f
            </p>

            <div className="aff-tiers-preview">
              <motion.div
                className="aff-tier-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="aff-tier-card__icon" style={{ color: '#cd7f32' }}>
                  <FontAwesomeIcon icon={faMedal} />
                </div>
                <h3>Bronze</h3>
                <p className="aff-tier-card__rate">10% provize</p>
                <p className="aff-tier-card__desc">Z\u00e1kladn\u00ed stupe\u0148</p>
              </motion.div>

              <motion.div
                className="aff-tier-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="aff-tier-card__icon" style={{ color: '#c0c0c0' }}>
                  <FontAwesomeIcon icon={faTrophy} />
                </div>
                <h3>Silver</h3>
                <p className="aff-tier-card__rate">15% provize</p>
                <p className="aff-tier-card__desc">Po 10 konverz\u00edch</p>
              </motion.div>

              <motion.div
                className="aff-tier-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="aff-tier-card__icon" style={{ color: '#ffd700' }}>
                  <FontAwesomeIcon icon={faCrown} />
                </div>
                <h3>Gold</h3>
                <p className="aff-tier-card__rate">20% provize</p>
                <p className="aff-tier-card__desc">Po 50 konverz\u00edch</p>
              </motion.div>
            </div>

            <div className="aff-hero__benefits">
              <div className="aff-benefit">
                <FontAwesomeIcon icon={faGift} />
                <span>Pas\u00edvn\u00ed p\u0159\u00edjem z ka\u017ed\u00e9 objedn\u00e1vky</span>
              </div>
              <div className="aff-benefit">
                <FontAwesomeIcon icon={faChartLine} />
                <span>Detailn\u00ed statistiky a p\u0159ehledy</span>
              </div>
              <div className="aff-benefit">
                <FontAwesomeIcon icon={faRocket} />
                <span>Vy\u0161\u0161\u00ed provize za v\u00edce konverz\u00ed</span>
              </div>
            </div>

            <motion.button
              className="aff-btn aff-btn--primary aff-btn--lg"
              onClick={handleJoin}
              disabled={joining}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {joining ? (
                <><FontAwesomeIcon icon={faSpinner} spin /> P\u0159ipojuji...</>
              ) : (
                <><FontAwesomeIcon icon={faHandshake} /> P\u0159ipojit se</>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Joined state
  const tier = TIER_CONFIG[account.tier] || TIER_CONFIG.bronze;
  const conversions = stats?.total_conversions ?? account.total_conversions;
  const nextTier = tier.next ? TIER_CONFIG[tier.next as keyof typeof TIER_CONFIG] : null;
  const progressToNext = nextTier ? Math.min(100, (conversions / tier.nextAt!) * 100) : 100;
  const conversionsToNext = nextTier ? Math.max(0, tier.nextAt! - conversions) : 0;

  return (
    <div className="aff-page">
      <PageMeta title="Affiliate program" description="Spr\u00e1va affiliate \u00fa\u010dtu." path="/affiliate" noindex />
      <div className="aff-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="aff-header">
            <div className="aff-header__icon">
              <FontAwesomeIcon icon={faHandshake} />
            </div>
            <div className="aff-header__info">
              <h1 className="aff-header__title">Affiliate program</h1>
              <p className="aff-header__subtitle">Spr\u00e1va va\u0161eho affiliate \u00fa\u010dtu</p>
            </div>
            <div className="aff-header__tier" style={{ color: tier.color }}>
              <FontAwesomeIcon icon={tier.icon} />
              <span>{tier.label}</span>
            </div>
          </div>

          {/* Tier progress */}
          <div className="aff-section">
            <div className="aff-section__header">
              <FontAwesomeIcon icon={faTrophy} className="aff-section__icon" />
              <h2 className="aff-section__title">V\u00e1\u0161 stupe\u0148</h2>
            </div>
            <div className="aff-section__content">
              <div className="aff-tier-display">
                <div className="aff-tier-display__current">
                  <FontAwesomeIcon icon={tier.icon} style={{ color: tier.color, fontSize: '2rem' }} />
                  <div>
                    <strong>{tier.label}</strong>
                    <span>{tier.rate}% provize</span>
                  </div>
                </div>
                {nextTier && (
                  <div className="aff-tier-display__progress">
                    <div className="aff-progress-bar">
                      <div className="aff-progress-bar__fill" style={{ width: `${progressToNext}%` }} />
                    </div>
                    <p className="aff-tier-display__next">
                      {conversionsToNext} konverz\u00ed do stupn\u011b <strong>{nextTier.label}</strong> ({nextTier.rate}%)
                    </p>
                  </div>
                )}
                {!nextTier && (
                  <p className="aff-tier-display__max">Dost\u00e1hli jste nejvy\u0161\u0161\u00edho stupn\u011b!</p>
                )}
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="aff-stats-grid">
            <motion.div className="aff-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="aff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <FontAwesomeIcon icon={faMoneyBillWave} />
              </div>
              <div className="aff-stat-card__content">
                <h3>{formatPrice(stats?.total_earnings ?? account.total_earnings)}</h3>
                <p>Celkov\u00e9 p\u0159\u00edjmy</p>
              </div>
            </motion.div>

            <motion.div className="aff-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="aff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <FontAwesomeIcon icon={faWallet} />
              </div>
              <div className="aff-stat-card__content">
                <h3>{formatPrice(stats?.pending_balance ?? account.pending_balance)}</h3>
                <p>\u010cekaj\u00edc\u00ed z\u016fstatek</p>
              </div>
            </motion.div>

            <motion.div className="aff-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="aff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <div className="aff-stat-card__content">
                <h3>{stats?.total_referrals ?? account.total_referrals}</h3>
                <p>Doporu\u010den\u00ed</p>
              </div>
            </motion.div>

            <motion.div className="aff-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="aff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <div className="aff-stat-card__content">
                <h3>{conversions}</h3>
                <p>Konverze</p>
              </div>
            </motion.div>

            <motion.div className="aff-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="aff-stat-card__icon" style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
                <FontAwesomeIcon icon={faPercent} />
              </div>
              <div className="aff-stat-card__content">
                <h3>{stats?.conversion_rate != null ? `${stats.conversion_rate.toFixed(1)}%` : '0%'}</h3>
                <p>Konverzn\u00ed pom\u011br</p>
              </div>
            </motion.div>
          </div>

          {/* Referral link */}
          <div className="aff-section">
            <div className="aff-section__header">
              <FontAwesomeIcon icon={faLink} className="aff-section__icon" />
              <h2 className="aff-section__title">V\u00e1\u0161 odkaz</h2>
            </div>
            <div className="aff-section__content">
              <div className="aff-referral-link">
                <code className="aff-referral-link__url">https://alatyrhosting.eu/ref/{account.referral_code}</code>
                <div className="aff-referral-link__actions">
                  <button className="aff-btn aff-btn--primary" onClick={handleCopyLink}>
                    <FontAwesomeIcon icon={copied ? faCheckCircle : faCopy} />
                    {copied ? 'Zkop\u00edrov\u00e1no' : 'Kop\u00edrovat'}
                  </button>
                  <button className="aff-btn aff-btn--ghost" onClick={handleEmailShare}>
                    <FontAwesomeIcon icon={faEnvelope} /> Email
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payout section */}
          <div className="aff-section">
            <div className="aff-section__header">
              <FontAwesomeIcon icon={faWallet} className="aff-section__icon" />
              <h2 className="aff-section__title">V\u00fdplata</h2>
            </div>
            <div className="aff-section__content">
              <div className="aff-payout-form">
                <div className="aff-payout-form__balance">
                  <span>\u010cekaj\u00edc\u00ed z\u016fstatek:</span>
                  <strong>{formatPrice(account.pending_balance)}</strong>
                </div>
                {account.pending_balance >= 50 ? (
                  <div className="aff-payout-form__row">
                    <div className="aff-payout-form__input-group">
                      <input
                        type="number"
                        className="aff-input"
                        placeholder="\u010c\u00e1stka (K\u010d)"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        min={50}
                        max={account.pending_balance}
                      />
                      <button
                        className="aff-btn aff-btn--primary"
                        onClick={handleRequestPayout}
                        disabled={requestingPayout}
                      >
                        {requestingPayout ? (
                          <><FontAwesomeIcon icon={faSpinner} spin /> Odes\u00edl\u00e1m...</>
                        ) : (
                          <><FontAwesomeIcon icon={faWallet} /> Vyplatit na kredit</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="aff-payout-form__min">Minim\u00e1ln\u00ed \u010d\u00e1stka pro v\u00fdplatu je 50 K\u010d</p>
                )}
              </div>
            </div>
          </div>

          {/* Commissions table */}
          <div className="aff-section">
            <div className="aff-section__header">
              <FontAwesomeIcon icon={faMoneyBillWave} className="aff-section__icon" />
              <h2 className="aff-section__title">Provize</h2>
            </div>
            <div className="aff-section__content">
              {commissions.length === 0 ? (
                <div className="aff-empty"><p>Zat\u00edm nem\u00e1te \u017e\u00e1dn\u00e9 provize.</p></div>
              ) : (
                <>
                  <div className="aff-table-wrapper">
                    <table className="aff-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>\u010c\u00e1stka objedn\u00e1vky</th>
                          <th>Provize %</th>
                          <th>Provize K\u010d</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((c) => (
                          <tr key={c.id}>
                            <td data-label="Datum">{formatDate(c.created_at)}</td>
                            <td data-label="\u010c\u00e1stka objedn\u00e1vky">{formatPrice(c.order_amount)}</td>
                            <td data-label="Provize %">{c.commission_rate}%</td>
                            <td data-label="Provize K\u010d">{formatPrice(c.commission_amount)}</td>
                            <td data-label="Status">{getCommissionStatusBadge(c.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {commissionsPagination && commissionsPagination.totalPages > 1 && (
                    <div className="aff-pagination">
                      <button className="aff-btn aff-btn--ghost" onClick={() => setCommissionsPage(p => Math.max(1, p - 1))} disabled={commissionsPage <= 1} aria-label="Předchozí stránka">
                        <FontAwesomeIcon icon={faChevronLeft} /> P\u0159edchoz\u00ed
                      </button>
                      <span className="aff-pagination__info">{commissionsPage} / {commissionsPagination.totalPages}</span>
                      <button className="aff-btn aff-btn--ghost" onClick={() => setCommissionsPage(p => Math.min(commissionsPagination!.totalPages, p + 1))} disabled={commissionsPage >= commissionsPagination.totalPages} aria-label="Další stránka">
                        Dal\u0161\u00ed <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Referrals table */}
          <div className="aff-section">
            <div className="aff-section__header">
              <FontAwesomeIcon icon={faUsers} className="aff-section__icon" />
              <h2 className="aff-section__title">Doporu\u010den\u00ed</h2>
            </div>
            <div className="aff-section__content">
              {referrals.length === 0 ? (
                <div className="aff-empty"><p>Zat\u00edm nem\u00e1te \u017e\u00e1dn\u00e1 doporu\u010den\u00ed.</p></div>
              ) : (
                <>
                  <div className="aff-table-wrapper">
                    <table className="aff-table">
                      <thead>
                        <tr>
                          <th>Datum doporu\u010den\u00ed</th>
                          <th>Konvertov\u00e1n</th>
                          <th>Datum konverze</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((r) => (
                          <tr key={r.id}>
                            <td data-label="Datum doporu\u010den\u00ed">{formatDate(r.created_at)}</td>
                            <td data-label="Konvertov\u00e1n">
                              {r.converted ? (
                                <span className="aff-badge aff-badge--success"><FontAwesomeIcon icon={faCheckCircle} /> Ano</span>
                              ) : (
                                <span className="aff-badge aff-badge--neutral">Ne</span>
                              )}
                            </td>
                            <td data-label="Datum konverze">{r.converted_at ? formatDate(r.converted_at) : '\u2014'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {referralsPagination && referralsPagination.totalPages > 1 && (
                    <div className="aff-pagination">
                      <button className="aff-btn aff-btn--ghost" onClick={() => setReferralsPage(p => Math.max(1, p - 1))} disabled={referralsPage <= 1} aria-label="Předchozí stránka">
                        <FontAwesomeIcon icon={faChevronLeft} /> P\u0159edchoz\u00ed
                      </button>
                      <span className="aff-pagination__info">{referralsPage} / {referralsPagination.totalPages}</span>
                      <button className="aff-btn aff-btn--ghost" onClick={() => setReferralsPage(p => Math.min(referralsPagination!.totalPages, p + 1))} disabled={referralsPage >= referralsPagination.totalPages} aria-label="Další stránka">
                        Dal\u0161\u00ed <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Payouts table */}
          <div className="aff-section">
            <div className="aff-section__header">
              <FontAwesomeIcon icon={faWallet} className="aff-section__icon" />
              <h2 className="aff-section__title">V\u00fdplaty</h2>
            </div>
            <div className="aff-section__content">
              {payouts.length === 0 ? (
                <div className="aff-empty"><p>Zat\u00edm nem\u00e1te \u017e\u00e1dn\u00e9 v\u00fdplaty.</p></div>
              ) : (
                <>
                  <div className="aff-table-wrapper">
                    <table className="aff-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>\u010c\u00e1stka</th>
                          <th>Metoda</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.map((p) => (
                          <tr key={p.id}>
                            <td data-label="Datum">{formatDate(p.created_at)}</td>
                            <td data-label="\u010c\u00e1stka">{formatPrice(p.amount)}</td>
                            <td data-label="Metoda">{p.method === 'credit' ? 'Kredit' : p.method}</td>
                            <td data-label="Status">{getPayoutStatusBadge(p.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {payoutsPagination && payoutsPagination.totalPages > 1 && (
                    <div className="aff-pagination">
                      <button className="aff-btn aff-btn--ghost" onClick={() => setPayoutsPage(p => Math.max(1, p - 1))} disabled={payoutsPage <= 1} aria-label="Předchozí stránka">
                        <FontAwesomeIcon icon={faChevronLeft} /> P\u0159edchoz\u00ed
                      </button>
                      <span className="aff-pagination__info">{payoutsPage} / {payoutsPagination.totalPages}</span>
                      <button className="aff-btn aff-btn--ghost" onClick={() => setPayoutsPage(p => Math.min(payoutsPagination!.totalPages, p + 1))} disabled={payoutsPage >= payoutsPagination.totalPages} aria-label="Další stránka">
                        Dal\u0161\u00ed <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Affiliate;
