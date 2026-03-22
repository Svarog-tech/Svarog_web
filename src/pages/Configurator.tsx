import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faEnvelope,
  faDatabase,
  faShieldAlt,
  faNetworkWired,
  faGlobe,
  faPlus,
  faMinus,
  faCheck,
  faArrowLeft,
  faShoppingCart,
  faClock,
  faCalendar,
  faSignInAlt,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { createOrder, Order, API_ROOT_URL, getCreditBalance, validatePromoCode, PromoValidationResult } from '../lib/api';
import { createPayment, createGoPayPayment, type PaymentProvider } from '../services/paymentService';
import { faCreditCard, faWallet, faTag, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import MultiStateButton from '../components/MultiStateButton';
import TwoFactorModal from '../components/TwoFactorModal';
import './Configurator.css';

interface HostingPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number;
  features: string[];
  description: string;
}

import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: IconDefinition;
  quantity: number;
  max?: number;
}

const Configurator: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice, currency: activeCurrency } = useCurrency();
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<HostingPlan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [domainOption, setDomainOption] = useState<'existing' | 'none'>('existing');
  const [domainName, setDomainName] = useState('');

  const [addons, setAddons] = useState<Addon[]>([
    {
      id: 'storage',
      name: '+10 GB prostoru',
      description: 'Rozšíření úložného prostoru o dalších 10 GB',
      price: 20,
      icon: faServer,
      quantity: 0,
      max: 10
    },
    {
      id: 'email',
      name: '+1 e-mail schránka',
      description: 'Přidání další e-mailové schránky s 1 GB prostorem',
      price: 5,
      icon: faEnvelope,
      quantity: 0,
      max: 20
    },
    {
      id: 'database',
      name: '+1 databáze',
      description: 'Přidání další MySQL/PostgreSQL databáze',
      price: 10,
      icon: faDatabase,
      quantity: 0,
      max: 10
    },
    {
      id: 'backup',
      name: 'Zálohy 3× denně',
      description: 'Automatické zálohování třikrát denně s 30denní historií',
      price: 30,
      icon: faShieldAlt,
      quantity: 0,
      max: 1
    },
    {
      id: 'ip',
      name: 'Dedikovaná IP',
      description: 'Vlastní dedikovaná IPv4 adresa pro váš hosting',
      price: 50,
      icon: faNetworkWired,
      quantity: 0,
      max: 1
    }
  ]);

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');

  // Credit state
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditLoaded, setCreditLoaded] = useState(false);

  // Promo code state
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    // Get plan from location state
    if (location.state && location.state.plan) {
      setSelectedPlan(location.state.plan);
    } else {
      // If no plan selected, redirect to hosting page
      navigate('/hosting');
    }
  }, [location, navigate]);

  // Auto-fill form data from user profile
  useEffect(() => {
    if (user && profile) {
      setFormData({
        customerName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        customerEmail: user.email || '',
        customerPhone: profile.phone || '',
        customerAddress: profile.address || ''
      });
    }
  }, [user, profile]);

  // Check 2FA status - MFA není momentálně implementováno
  useEffect(() => {
    // MFA není momentálně implementováno v MySQL verzi
    setMfaEnabled(false);
  }, [user]);

  // Fetch credit balance
  useEffect(() => {
    if (user && !creditLoaded) {
      getCreditBalance()
        .then(result => {
          setCreditBalance(result.balance || 0);
          setCreditLoaded(true);
        })
        .catch(() => {
          setCreditLoaded(true);
        });
    }
  }, [user, creditLoaded]);

  const updateAddonQuantity = (addonId: string, change: number) => {
    setAddons(addons.map(addon => {
      if (addon.id === addonId) {
        const newQuantity = Math.max(0, Math.min((addon.max || Infinity), addon.quantity + change));
        return { ...addon, quantity: newQuantity };
      }
      return addon;
    }));
  };

  const calculateTotal = () => {
    if (!selectedPlan) return 0;

    const planPrice = billingPeriod === 'yearly'
      ? selectedPlan.yearlyPrice * 12
      : selectedPlan.price;

    const addonsTotal = addons.reduce((sum, addon) => {
      const addonPrice = billingPeriod === 'yearly'
        ? addon.price * 0.9
        : addon.price;
      return sum + (addonPrice * addon.quantity);
    }, 0);

    return billingPeriod === 'yearly' ? planPrice + (addonsTotal * 12) : planPrice + addonsTotal;
  };

  const getPromoDiscount = () => {
    if (!promoResult || !promoResult.valid) return 0;
    return promoResult.discount_amount || 0;
  };

  const getCreditApplied = () => {
    const totalAfterPromo = calculateTotal() - getPromoDiscount();
    return Math.min(creditBalance, Math.max(0, totalAfterPromo));
  };

  const getFinalTotal = () => {
    const total = calculateTotal();
    const discount = getPromoDiscount();
    const credit = getCreditApplied();
    return Math.max(0, total - discount - credit);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    try {
      setPromoLoading(true);
      setPromoError('');
      const result = await validatePromoCode(
        promoCode.trim(),
        selectedPlan?.id,
        calculateTotal()
      );
      if (result.valid) {
        setPromoResult(result);
        setPromoError('');
      } else {
        setPromoResult(null);
        setPromoError('Neplatný promo kód');
      }
    } catch (error: unknown) {
      setPromoResult(null);
      setPromoError(error instanceof Error ? error.message : 'Nepodařilo se ověřit promo kód');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlan) return;

    // MFA není momentálně implementováno - přeskočit 2FA kontrolu
    // if (user && mfaEnabled && !twoFactorCode) {
    //   // MFA není implementováno
    //   return;
    // }

    setButtonState('loading');
    setIsLoading(true);

    try {
      const orderData: Omit<Order, 'id' | 'created_at'> = {
        user_id: user?.id || null,
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        price: calculateTotal(),
        customer_email: formData.customerEmail,
        customer_name: formData.customerName,
        status: 'pending'
      };

      const order = await createOrder(orderData);

      // Vytvoření platby přes zvolenou platební bránu
      const payment = await createPayment({
        orderId: order.id!,
        amount: calculateTotal(),
        currency: paymentProvider === 'gopay' ? 'CZK' : (activeCurrency || 'EUR'),
        description: `Hosting ${selectedPlan.name}`,
        customerEmail: formData.customerEmail,
        customerName: formData.customerName,
        provider: paymentProvider,
        isSubscription: billingPeriod === 'monthly' && paymentProvider === 'stripe'
      });

      if (payment.success && payment.paymentUrl) {
        // Přesměrování na platební bránu
        window.location.href = payment.paymentUrl;
      } else {
        throw new Error(payment.error || 'Nepodařilo se vytvořit platbu');
      }

    } catch (error) {
      console.error('Error creating order:', error);
      setButtonState('error');

      // Reset button state after 3 seconds
      setTimeout(() => {
        setButtonState('idle');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (code: string): Promise<boolean> => {
    // MFA není momentálně implementováno v MySQL verzi
    // TODO: Implementovat MFA
    console.warn('MFA není implementováno');
    return false;
  };

  if (!selectedPlan) {
    return null;
  }

  if (orderSuccess) {
    return (
      <div className="configurator-success-page">
        <div className="success-container">
          <motion.div
            className="success-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="success-icon-large">
              <FontAwesomeIcon icon={faCheck} />
            </div>
            <h1>Objednávka byla úspěšně odeslána!</h1>
            <p className="success-message">
              Děkujeme za vaši objednávku. Potvrzení jsme odeslali na email:
            </p>
            <p className="success-email">{formData.customerEmail}</p>
            <p className="success-info">
              Zkontrolujte si prosím emailovou schránku (včetně složky spam). Brzy vás budeme kontaktovat s dalšími instrukcemi pro aktivaci vašeho hostingu.
            </p>
            <div className="success-actions">
              <button className="btn-primary" onClick={() => navigate('/')}>
                <span>Zpět na hlavní stránku</span>
              </button>
              <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                <span>Přejít do dashboardu</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="configurator-page">
      <div className="configurator-header">
        <div className="container">
          <motion.button
            className="back-btn"
            onClick={() => navigate('/hosting')}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět na plány
          </motion.button>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Konfigurace hostingu
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Přizpůsobte si hosting přesně podle vašich potřeb
          </motion.p>
        </div>
      </div>

      <div className="configurator-layout">
        <div className="container">
          <div className="config-grid">
            {/* Main Content */}
            <div className="config-main">
              {/* Selected Plan */}
              <motion.section
                className="config-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="config-section-inner">
                  <h2 className="section-heading">
                    <FontAwesomeIcon icon={faServer} />
                    Vybraný hosting plán
                  </h2>
                  <div className="plan-display-card">
                    <div className="plan-header">
                      <div>
                        <h3>{selectedPlan.name}</h3>
                        <p>{selectedPlan.description}</p>
                      </div>
                      <div className="plan-price-badge">
                        <span className="price-value">
                          {formatPrice(billingPeriod === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.price)}
                        </span>
                        <span className="price-unit">/měsíc</span>
                      </div>
                    </div>
                    <div className="plan-features-grid">
                      {selectedPlan.features.slice(0, 6).map((feature, index) => (
                        <div key={index} className="feature-tag">
                          <span className="icon">
                            <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="M0 0h24v24H0z" fill="none"></path>
                              <path fill="currentColor" d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"></path>
                            </svg>
                          </span>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Billing Period */}
              <motion.section
                className="config-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="config-section-inner">
                  <h2 className="section-heading">
                    <FontAwesomeIcon icon={faCalendar} />
                    Fakturační období
                  </h2>
                  <div className="billing-cards">
                    <div className="toggle-group">
                      <button
                        className={`toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`}
                        onClick={() => setBillingPeriod('monthly')}
                      >
                        <FontAwesomeIcon icon={faClock} />
                        Měsíčně - {formatPrice(selectedPlan.price)}/měsíc
                      </button>
                      <button
                        className={`toggle-btn ${billingPeriod === 'yearly' ? 'active' : ''}`}
                        onClick={() => setBillingPeriod('yearly')}
                      >
                        <FontAwesomeIcon icon={faCalendar} />
                        Ročně - {formatPrice(selectedPlan.yearlyPrice)}/měsíc
                        <span className="save-badge">Ušetříte 10%</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Domain Selection */}
              <motion.section
                className="config-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="config-section-inner">
                  <h2 className="section-heading">
                    <FontAwesomeIcon icon={faGlobe} />
                    Doména
                  </h2>
                  <p className="section-description">
                    Registraci domén zatím nenabízíme. Doménu si musíte zajistit u registrátora (např. Wedos, Forpsi, GoDaddy).
                  </p>
                  <div className="domain-selection">
                    <label className={`domain-radio-card ${domainOption === 'existing' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="domain"
                        value="existing"
                        checked={domainOption === 'existing'}
                        onChange={(e) =>
                          setDomainOption(e.target.value as typeof domainOption)
                        }
                      />
                      <div className="radio-content">
                        <div className="radio-icon">
                          <FontAwesomeIcon icon={faGlobe} />
                        </div>
                        <div>
                          <h4>Mám vlastní doménu</h4>
                          <p>Mám již registrovanou doménu u registrátora a chci ji použít</p>
                        </div>
                      </div>
                    </label>

                    <label className={`domain-radio-card ${domainOption === 'none' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="domain"
                        value="none"
                        checked={domainOption === 'none'}
                        onChange={(e) =>
                          setDomainOption(e.target.value as typeof domainOption)
                        }
                      />
                      <div className="radio-content">
                        <div className="radio-icon">
                          <FontAwesomeIcon icon={faGlobe} />
                        </div>
                        <div>
                          <h4>Zatím bez domény</h4>
                          <p>Doménu si zajistím později, nyní chci jen hosting</p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {domainOption === 'existing' && (
                    <motion.div
                      className="domain-input-section"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <input
                        type="text"
                        placeholder="např. mojeweb.cz"
                        value={domainName}
                        onChange={(e) => setDomainName(e.target.value)}
                        className="domain-input-field"
                      />
                      <p className="domain-help-text">
                        Po objednání vám pošleme instrukce, jak nasměrovat doménu na náš hosting.
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.section>

              {/* Addons */}
              <motion.section
                className="config-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <div className="config-section-inner">
                  <h2 className="section-heading">
                    <FontAwesomeIcon icon={faPlus} />
                    Doplňky a rozšíření
                  </h2>
                  <p className="section-description">Přizpůsobte si hosting přesně podle vašich potřeb</p>
                  <div className="addons-list">
                    {addons.map((addon) => (
                      <div key={addon.id} className="addon-item">
                        <div className="addon-inner">
                          <div className="addon-icon-wrapper">
                            <FontAwesomeIcon icon={addon.icon} />
                          </div>
                          <div className="addon-details">
                            <h4>{addon.name}</h4>
                            <p>{addon.description}</p>
                            <span className="addon-price-tag">
                              +{formatPrice(addon.price)}/{billingPeriod === 'yearly' ? 'měsíc' : 'měsíc'}
                            </span>
                          </div>
                          <div className="addon-quantity-controls">
                            <button
                              className="qty-btn"
                              onClick={() => updateAddonQuantity(addon.id, -1)}
                              disabled={addon.quantity === 0}
                            >
                              <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <span className="qty-display">{addon.quantity}</span>
                            <button
                              className="qty-btn"
                              onClick={() => updateAddonQuantity(addon.id, 1)}
                              disabled={addon.quantity >= (addon.max || Infinity)}
                            >
                              <FontAwesomeIcon icon={faPlus} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Contact Form */}
              <motion.section
                className="config-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <div className="config-section-inner">
                  <h2 className="section-heading">
                    <FontAwesomeIcon icon={faShoppingCart} />
                    Kontaktní údaje
                  </h2>

                  {!user ? (
                    <div className="login-prompt">
                      <div className="login-prompt-icon">
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      <h3>Přihlaste se pro rychlejší objednávku</h3>
                      <p>Po přihlášení se vaše údaje automaticky předvyplní.</p>
                      <button
                        className="login-prompt-btn"
                        onClick={() => navigate('/login', { state: { returnUrl: '/configurator', plan: selectedPlan } })}
                      >
                        <span>
                          <FontAwesomeIcon icon={faSignInAlt} />
                          Přihlásit se
                        </span>
                      </button>
                      <p className="login-prompt-divider">nebo vyplňte údaje ručně</p>
                    </div>
                  ) : (
                    <div className="logged-in-info">
                      <div className="user-badge">
                        <FontAwesomeIcon icon={faUser} />
                        <span>Přihlášen jako: <strong>{user.email}</strong></span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="config-form">
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Jméno a příjmení *</label>
                        <input
                          type="text"
                          value={formData.customerName}
                          onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                          required
                          placeholder="Jan Novák"
                        />
                      </div>
                      <div className="form-field">
                        <label>Email *</label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                          required
                          placeholder="jan@email.cz"
                          disabled={!!user}
                        />
                      </div>
                      <div className="form-field">
                        <label>Telefon</label>
                        <input
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                          placeholder="+420 123 456 789"
                        />
                      </div>
                      <div className="form-field">
                        <label>Adresa</label>
                        <input
                          type="text"
                          value={formData.customerAddress}
                          onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                          placeholder="Ulice 123, Praha"
                        />
                      </div>
                    </div>
                  </form>
                </div>
              </motion.section>
            </div>

            {/* Sidebar - Order Summary */}
            <div className="config-sidebar">
              <motion.div
                className="order-summary-sticky"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {/* Payment Method Selector */}
                <div className="payment-method-section">
                  <h4 className="payment-method-title">
                    <FontAwesomeIcon icon={faCreditCard} />
                    Platební metoda
                  </h4>
                  <div className="payment-methods">
                    <label
                      className={`payment-method-card${paymentProvider === 'stripe' ? ' active' : ''}`}
                      onClick={() => setPaymentProvider('stripe')}
                    >
                      <input
                        type="radio"
                        name="paymentProvider"
                        value="stripe"
                        checked={paymentProvider === 'stripe'}
                        onChange={() => setPaymentProvider('stripe')}
                      />
                      <div className="payment-method-info">
                        <span className="payment-method-name">💳 Platba kartou</span>
                        <span className="payment-method-desc">Visa, Mastercard, AMEX</span>
                      </div>
                      {billingPeriod === 'monthly' && (
                        <span className="payment-badge">Auto-renewal</span>
                      )}
                    </label>

                    <label
                      className={`payment-method-card${paymentProvider === 'paypal' ? ' active' : ''}`}
                      onClick={() => setPaymentProvider('paypal')}
                    >
                      <input
                        type="radio"
                        name="paymentProvider"
                        value="paypal"
                        checked={paymentProvider === 'paypal'}
                        onChange={() => setPaymentProvider('paypal')}
                      />
                      <div className="payment-method-info">
                        <span className="payment-method-name">🅿️ PayPal</span>
                        <span className="payment-method-desc">Platba přes PayPal účet</span>
                      </div>
                    </label>

                    <label
                      className={`payment-method-card${paymentProvider === 'gopay' ? ' active' : ''}`}
                      onClick={() => setPaymentProvider('gopay')}
                    >
                      <input
                        type="radio"
                        name="paymentProvider"
                        value="gopay"
                        checked={paymentProvider === 'gopay'}
                        onChange={() => setPaymentProvider('gopay')}
                      />
                      <div className="payment-method-info">
                        <span className="payment-method-name">🏦 GoPay</span>
                        <span className="payment-method-desc">Česká platební brána (CZK)</span>
                      </div>
                    </label>
                  </div>
                </div>

                <h3 className="summary-title">Shrnutí objednávky</h3>

                <div className="summary-section">
                  <div className="summary-row">
                    <span>Hosting plán: {selectedPlan.name}</span>
                    <span>{formatPrice(billingPeriod === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.price)}</span>
                  </div>

                  {addons.filter(a => a.quantity > 0).map(addon => (
                    <div key={addon.id} className="summary-row addon-row">
                      <span>{addon.name} × {addon.quantity}</span>
                      <span>+{formatPrice(addon.price * addon.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Promo code section */}
                <div className="promo-section">
                  <button
                    type="button"
                    className="promo-toggle"
                    onClick={() => setPromoOpen(!promoOpen)}
                  >
                    <FontAwesomeIcon icon={faTag} />
                    <span>Máte promo kód?</span>
                    <FontAwesomeIcon icon={promoOpen ? faChevronUp : faChevronDown} className="promo-toggle-arrow" />
                  </button>
                  {promoOpen && (
                    <motion.div
                      className="promo-input-section"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <div className="promo-input-row">
                        <input
                          type="text"
                          placeholder="Zadejte kód"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value);
                            if (promoResult) {
                              setPromoResult(null);
                              setPromoError('');
                            }
                          }}
                          className="promo-input-field"
                          disabled={promoLoading}
                        />
                        <button
                          type="button"
                          className="promo-apply-btn"
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoCode.trim()}
                        >
                          {promoLoading ? 'Ověřuji...' : 'Použít'}
                        </button>
                      </div>
                      {promoError && (
                        <p className="promo-error">{promoError}</p>
                      )}
                      {promoResult && promoResult.valid && (
                        <p className="promo-success">
                          <FontAwesomeIcon icon={faCheck} /> Sleva: -{promoResult.discount_type === 'percent'
                            ? `${promoResult.discount_value}%`
                            : formatPrice(promoResult.discount_amount)}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="summary-divider"></div>

                <div className="summary-period-info">
                  <FontAwesomeIcon icon={billingPeriod === 'yearly' ? faCalendar : faClock} />
                  <span>{billingPeriod === 'yearly' ? 'Roční platba' : 'Měsíční platba'}</span>
                </div>

                <div className="summary-total-section">
                  <div className="summary-row">
                    <span>Cena</span>
                    <span>{formatPrice(calculateTotal())}</span>
                  </div>

                  {promoResult && promoResult.valid && (
                    <div className="summary-row summary-row--discount">
                      <span>Sleva ({promoResult.code})</span>
                      <span style={{ color: 'var(--success-color)' }}>-{formatPrice(getPromoDiscount())}</span>
                    </div>
                  )}

                  {user && creditBalance > 0 && (
                    <div className="summary-row summary-row--credit">
                      <span><FontAwesomeIcon icon={faWallet} /> Kredit</span>
                      <span style={{ color: 'var(--success-color)' }}>-{formatPrice(getCreditApplied())}</span>
                    </div>
                  )}

                  <div className="summary-divider"></div>

                  <div className="total-row">
                    <span>Celkem</span>
                    <span className="total-amount">{formatPrice(getFinalTotal())}</span>
                  </div>

                  {user && creditBalance > 0 && getFinalTotal() === 0 && (
                    <p className="credit-covers-all">
                      <FontAwesomeIcon icon={faWallet} /> Bude zaplaceno kreditem
                    </p>
                  )}

                  {user && creditBalance > 0 && getFinalTotal() > 0 && (
                    <p className="credit-info-line">
                      <FontAwesomeIcon icon={faWallet} /> Dostupný kredit: {formatPrice(creditBalance)}
                    </p>
                  )}

                  <p className="total-period">
                    {billingPeriod === 'yearly' ? 'Fakturováno jednou ročně' : 'Fakturováno měsíčně'}
                  </p>
                </div>

                <MultiStateButton
                  state={buttonState}
                  onClick={handleSubmit}
                  idleText="Dokončit objednávku"
                  loadingText="Zpracování objednávky..."
                  successText="Objednávka odeslána!"
                  errorText="Zkusit znovu"
                  icon={faShoppingCart}
                />

                <div className="summary-guarantees">
                  <div className="guarantee-item">
                    <span className="icon">
                      <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none"></path>
                        <path fill="currentColor" d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"></path>
                      </svg>
                    </span>
                    <span>30denní záruka vrácení peněz</span>
                  </div>
                  <div className="guarantee-item">
                    <span className="icon">
                      <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none"></path>
                        <path fill="currentColor" d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"></path>
                      </svg>
                    </span>
                    <span>Bezplatná migrace</span>
                  </div>
                  <div className="guarantee-item">
                    <span className="icon">
                      <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h24v24H0z" fill="none"></path>
                        <path fill="currentColor" d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"></path>
                      </svg>
                    </span>
                    <span>SSL certifikát zdarma</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Modal */}
      <TwoFactorModal
        isOpen={show2FA}
        onClose={() => setShow2FA(false)}
        onVerify={handle2FAVerify}
        email={formData.customerEmail || user?.email || ''}
      />
    </div>
  );
};

export default Configurator;
