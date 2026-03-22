import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoiceDollar,
  faReceipt,
  faCreditCard,
  faCalendarAlt,
  faBan,
  faSpinner,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faFileAlt,
  faFilePdf,
  faWallet,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import {
  faStripe,
  faPaypal,
} from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { apiCall, API_BASE_URL, getCreditBalance, getCreditHistory, CreditTransaction, PaginationMeta } from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import './Billing.css';

interface Subscription {
  id: number;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan_name?: string;
  price?: number;
  currency?: string;
}

interface OrderRecord {
  id: number;
  plan_name: string;
  price: number;
  currency: string;
  status: string;
  payment_status: string;
  payment_provider: string;
  created_at: string;
  payment_date: string;
}

const Billing: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Credit state
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditCurrency, setCreditCurrency] = useState<string>('CZK');
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [creditPagination, setCreditPagination] = useState<PaginationMeta | null>(null);
  const [creditPage, setCreditPage] = useState(1);
  const [loadingCredit, setLoadingCredit] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([fetchSubscriptions(), fetchOrders(), fetchCredit()]);
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    try {
      setLoadingSubs(true);
      const result = await apiCall<{ success: boolean; subscriptions: Subscription[] }>('/billing/subscriptions');
      setSubscriptions(result.subscriptions || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoadingSubs(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const result = await apiCall<{ success: boolean; orders: OrderRecord[]; pagination: any }>('/orders?limit=100');
      setOrders(result.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchCredit = async (page: number = 1) => {
    try {
      setLoadingCredit(true);
      const [balanceResult, historyResult] = await Promise.all([
        getCreditBalance(),
        getCreditHistory(page),
      ]);
      setCreditBalance(balanceResult.balance || 0);
      setCreditCurrency(balanceResult.currency || 'CZK');
      setCreditTransactions(historyResult.transactions || []);
      setCreditPagination(historyResult.pagination || null);
    } catch (error) {
      console.error('Error fetching credit:', error);
    } finally {
      setLoadingCredit(false);
    }
  };

  useEffect(() => {
    if (user && creditPage > 1) {
      fetchCredit(creditPage);
    }
  }, [creditPage]);

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit':
        return <span className="billing-badge billing-badge--success">Vklad</span>;
      case 'payment':
        return <span className="billing-badge billing-badge--info">Platba</span>;
      case 'refund':
        return <span className="billing-badge billing-badge--warning">Vrácení</span>;
      case 'adjustment':
        return <span className="billing-badge billing-badge--neutral">Úprava</span>;
      case 'promo':
        return <span className="billing-badge billing-badge--promo">Promo</span>;
      default:
        return <span className="billing-badge billing-badge--neutral">{type}</span>;
    }
  };

  const handleCancelSubscription = async (stripeSubscriptionId: string) => {
    if (!window.confirm('Opravdu chcete zrušit toto předplatné? Služba bude aktivní do konce aktuálního období.')) {
      return;
    }

    try {
      setCancellingId(stripeSubscriptionId);
      await apiCall<{ success: boolean }>(`/billing/subscriptions/${stripeSubscriptionId}/cancel`, {
        method: 'POST',
      });
      showToast('Předplatné bylo zrušeno. Služba bude aktivní do konce fakturačního období.', 'success');
      fetchSubscriptions();
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Nepodařilo se zrušit předplatné', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
        method: 'GET',
        headers: {
          'X-CSRF-Guard': '1',
          ...getAuthHeader(),
        },
        credentials: 'include',
      });

      const html = await response.text();

      // SECURITY: Blob URL for safe HTML rendering — prevents XSS from uncontrolled HTML
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      showToast('Nepodařilo se stáhnout fakturu', 'error');
    }
  };

  const handleDownloadPdfInvoice = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice?format=pdf`, {
        method: 'GET',
        headers: {
          'X-CSRF-Guard': '1',
          ...getAuthHeader(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Nepodařilo se stáhnout PDF fakturu');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faktura-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF invoice:', error);
      showToast('Nepodařilo se stáhnout PDF fakturu', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="billing-badge billing-badge--success"><FontAwesomeIcon icon={faCheckCircle} /> Aktivní</span>;
      case 'past_due':
        return <span className="billing-badge billing-badge--warning"><FontAwesomeIcon icon={faExclamationTriangle} /> Po splatnosti</span>;
      case 'canceled':
      case 'cancelled':
        return <span className="billing-badge billing-badge--danger"><FontAwesomeIcon icon={faTimesCircle} /> Zrušeno</span>;
      default:
        return <span className="billing-badge billing-badge--neutral">{status}</span>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="billing-badge billing-badge--success">Zaplaceno</span>;
      case 'unpaid':
      case 'pending':
        return <span className="billing-badge billing-badge--warning">Nezaplaceno</span>;
      case 'refunded':
        return <span className="billing-badge billing-badge--neutral">Vráceno</span>;
      case 'failed':
        return <span className="billing-badge billing-badge--danger">Selhalo</span>;
      default:
        return <span className="billing-badge billing-badge--neutral">{status}</span>;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'stripe':
        return <FontAwesomeIcon icon={faStripe} title="Stripe" />;
      case 'paypal':
        return <FontAwesomeIcon icon={faPaypal} title="PayPal" />;
      case 'gopay':
        return <span title="GoPay" className="billing-provider-text">GP</span>;
      default:
        return <FontAwesomeIcon icon={faCreditCard} title={provider || 'N/A'} />;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '\u2014';
    const date = new Date(dateStr);
    return date.toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number, currency: string = 'CZK') => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  return (
    <div className="billing-page">
      <div className="billing-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="billing-header">
            <div className="billing-header__icon">
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
            </div>
            <div className="billing-header__info">
              <h1 className="billing-header__title">Fakturace a platby</h1>
              <p className="billing-header__subtitle">Přehled vašich předplatných, plateb a faktur</p>
            </div>
          </div>

          {/* Section 0: Credit Balance */}
          <div className="billing-section">
            <div className="billing-section__header">
              <FontAwesomeIcon icon={faWallet} className="billing-section__icon" />
              <h2 className="billing-section__title">Kredit na účtu</h2>
            </div>
            <div className="billing-section__content">
              {loadingCredit ? (
                <div className="billing-loading">
                  <FontAwesomeIcon icon={faSpinner} spin /> Načítám kredit...
                </div>
              ) : (
                <>
                  <div className="billing-credit-balance">
                    <span className="billing-credit-balance__label">Aktuální zůstatek</span>
                    <span className={`billing-credit-balance__amount ${creditBalance > 0 ? 'billing-credit-balance__amount--positive' : ''}`}>
                      {formatPrice(creditBalance, creditCurrency)}
                    </span>
                  </div>

                  {creditTransactions.length > 0 && (
                    <>
                      <h4 className="billing-credit-history-title">Historie transakcí</h4>
                      <div className="billing-table-wrapper">
                        <table className="billing-table">
                          <thead>
                            <tr>
                              <th>Datum</th>
                              <th>Typ</th>
                              <th>Popis</th>
                              <th>Částka</th>
                              <th>Zůstatek</th>
                            </tr>
                          </thead>
                          <tbody>
                            {creditTransactions.map((tx) => (
                              <tr key={tx.id}>
                                <td data-label="Datum">{formatDate(tx.created_at)}</td>
                                <td data-label="Typ">{getTransactionTypeBadge(tx.transaction_type)}</td>
                                <td data-label="Popis">{tx.description || '\u2014'}</td>
                                <td data-label="Částka">
                                  <span style={{ color: tx.amount >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 600 }}>
                                    {tx.amount >= 0 ? '+' : ''}{formatPrice(tx.amount, creditCurrency)}
                                  </span>
                                </td>
                                <td data-label="Zůstatek">{formatPrice(tx.balance_after, creditCurrency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {creditPagination && creditPagination.totalPages > 1 && (
                        <div className="billing-pagination">
                          <button
                            className="billing-btn billing-btn--ghost"
                            onClick={() => setCreditPage(p => Math.max(1, p - 1))} aria-label="Předchozí stránka"
                            disabled={creditPage <= 1}
                          >
                            <FontAwesomeIcon icon={faChevronLeft} /> Předchozí
                          </button>
                          <span className="billing-pagination__info">
                            {creditPage} / {creditPagination.totalPages}
                          </span>
                          <button
                            className="billing-btn billing-btn--ghost"
                            onClick={() => setCreditPage(p => Math.min(creditPagination!.totalPages, p + 1))} aria-label="Další stránka"
                            disabled={creditPage >= creditPagination.totalPages}
                          >
                            Další <FontAwesomeIcon icon={faChevronRight} />
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {creditTransactions.length === 0 && creditBalance === 0 && (
                    <div className="billing-empty" style={{ marginTop: '1rem' }}>
                      <p>Zatím nemáte žádný kredit na účtu.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Section 1: Active Subscriptions */}
          <div className="billing-section">
            <div className="billing-section__header">
              <FontAwesomeIcon icon={faReceipt} className="billing-section__icon" />
              <h2 className="billing-section__title">Aktivní předplatná</h2>
            </div>
            <div className="billing-section__content">
              {loadingSubs ? (
                <div className="billing-loading">
                  <FontAwesomeIcon icon={faSpinner} spin /> Načítám předplatná...
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="billing-empty">
                  <p>Nemáte žádná aktivní předplatná.</p>
                </div>
              ) : (
                <div className="billing-subscriptions">
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className="billing-sub-card">
                      <div className="billing-sub-card__top">
                        <div className="billing-sub-card__info">
                          <h3 className="billing-sub-card__name">{sub.plan_name || 'Hosting plán'}</h3>
                          <p className="billing-sub-card__price">
                            {sub.price ? formatPrice(sub.price, sub.currency) : '\u2014'} / měsíc
                          </p>
                        </div>
                        <div className="billing-sub-card__status">
                          {getStatusBadge(sub.status)}
                          {sub.cancel_at_period_end && (
                            <span className="billing-badge billing-badge--warning">Zruší se</span>
                          )}
                        </div>
                      </div>
                      <div className="billing-sub-card__details">
                        <div className="billing-sub-card__detail">
                          <FontAwesomeIcon icon={faCalendarAlt} />
                          <span>Další platba: {formatDate(sub.current_period_end)}</span>
                        </div>
                      </div>
                      {sub.status === 'active' && !sub.cancel_at_period_end && (
                        <div className="billing-sub-card__actions">
                          <button
                            className="billing-btn billing-btn--danger"
                            onClick={() => handleCancelSubscription(sub.stripe_subscription_id)}
                            disabled={cancellingId === sub.stripe_subscription_id}
                          >
                            {cancellingId === sub.stripe_subscription_id ? (
                              <><FontAwesomeIcon icon={faSpinner} spin /> Ruším...</>
                            ) : (
                              <><FontAwesomeIcon icon={faBan} /> Zrušit předplatné</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Payment History */}
          <div className="billing-section">
            <div className="billing-section__header">
              <FontAwesomeIcon icon={faFileInvoiceDollar} className="billing-section__icon" />
              <h2 className="billing-section__title">Historie plateb</h2>
            </div>
            <div className="billing-section__content">
              {loadingOrders ? (
                <div className="billing-loading">
                  <FontAwesomeIcon icon={faSpinner} spin /> Načítám objednávky...
                </div>
              ) : orders.length === 0 ? (
                <div className="billing-empty">
                  <p>Zatím nemáte žádné objednávky.</p>
                </div>
              ) : (
                <div className="billing-table-wrapper">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Popis</th>
                        <th>Částka</th>
                        <th>Stav</th>
                        <th>Poskytovatel</th>
                        <th>Faktura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td data-label="Datum">{formatDate(order.payment_date || order.created_at)}</td>
                          <td data-label="Popis">{order.plan_name}</td>
                          <td data-label="Částka">{formatPrice(order.price, order.currency)}</td>
                          <td data-label="Stav">{getPaymentStatusBadge(order.payment_status)}</td>
                          <td data-label="Poskytovatel" className="billing-provider-cell">
                            {getProviderIcon(order.payment_provider)}
                          </td>
                          <td data-label="Faktura">
                            {order.payment_status === 'paid' && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  className="billing-btn billing-btn--ghost"
                                  onClick={() => handleDownloadInvoice(order.id)}
                                  title="Zobrazit fakturu (HTML)"
                                >
                                  <FontAwesomeIcon icon={faFileAlt} /> HTML
                                </button>
                                <button
                                  className="billing-btn billing-btn--ghost"
                                  onClick={() => handleDownloadPdfInvoice(order.id)}
                                  title="Stáhnout fakturu (PDF)"
                                >
                                  <FontAwesomeIcon icon={faFilePdf} /> PDF
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Payment Methods */}
          <div className="billing-section">
            <div className="billing-section__header">
              <FontAwesomeIcon icon={faCreditCard} className="billing-section__icon" />
              <h2 className="billing-section__title">Platební metody</h2>
            </div>
            <div className="billing-section__content">
              <div className="billing-empty">
                <p>Platební metody jsou spravovány přes Stripe/PayPal. Pro správu platebních údajů použijte příslušný portál poskytovatele plateb.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Billing;
