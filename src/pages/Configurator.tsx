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
import { createOrder, Order } from '../lib/supabase';
// MFA není momentálně implementováno v MySQL verzi
// import { supabase } from '../lib/auth';
import { createGoPayPayment } from '../services/paymentService';
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

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  quantity: number;
  max?: number;
}

const Configurator: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice } = useCurrency();
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
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');

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

      // Vytvoření platby v GoPay
      const payment = await createGoPayPayment({
        orderId: order.id,
        amount: calculateTotal(),
        currency: 'CZK',
        description: `Hosting ${selectedPlan.name}`,
        customerEmail: formData.customerEmail,
        customerName: formData.customerName,
        returnUrl: `${window.location.origin}/payment/success`,
        notifyUrl: `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/gopay/webhook`
      });

      if (payment.success && payment.paymentUrl) {
        // Přesměrování na platební bránu GoPay
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
                Zpět na hlavní stránku
              </button>
              <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                Přejít do dashboardu
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
          <button className="back-btn" onClick={() => navigate('/hosting')}>
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět na plány
          </button>
          <h1>Konfigurace hostingu</h1>
          <p>Přizpůsobte si hosting přesně podle vašich potřeb</p>
        </div>
      </div>

      <div className="configurator-layout">
        <div className="container">
          <div className="config-grid">
            {/* Main Content */}
            <div className="config-main">
              {/* Selected Plan */}
              <section className="config-section">
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
                        <FontAwesomeIcon icon={faCheck} />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Billing Period */}
              <section className="config-section">
                <h2 className="section-heading">
                  <FontAwesomeIcon icon={faCalendar} />
                  Fakturační období
                </h2>
                <div className="billing-cards">
                  <motion.div
                    className={`billing-card ${billingPeriod === 'monthly' ? 'selected' : ''}`}
                    onClick={() => setBillingPeriod('monthly')}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="billing-icon">
                      <FontAwesomeIcon icon={faClock} />
                    </div>
                    <h3>Měsíční platba</h3>
                    <p className="billing-price">{formatPrice(selectedPlan.price)}/měsíc</p>
                    <p className="billing-desc">Platba každý měsíc, kdykoliv zrušitelné</p>
                  </motion.div>

                  <motion.div
                    className={`billing-card ${billingPeriod === 'yearly' ? 'selected' : ''}`}
                    onClick={() => setBillingPeriod('yearly')}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="billing-icon">
                      <FontAwesomeIcon icon={faCalendar} />
                    </div>
                    <div className="save-badge">Ušetříte 10%</div>
                    <h3>Roční platba</h3>
                    <p className="billing-price">{formatPrice(selectedPlan.yearlyPrice)}/měsíc</p>
                    <p className="billing-desc">Fakturováno jednou ročně - {formatPrice(selectedPlan.yearlyPrice * 12)}/rok</p>
                  </motion.div>
                </div>
              </section>

              {/* Domain Selection */}
              <section className="config-section">
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
                      onChange={(e) => setDomainOption(e.target.value as any)}
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
                      onChange={(e) => setDomainOption(e.target.value as any)}
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
              </section>

              {/* Addons */}
              <section className="config-section">
                <h2 className="section-heading">
                  <FontAwesomeIcon icon={faPlus} />
                  Doplňky a rozšíření
                </h2>
                <p className="section-description">Přizpůsobte si hosting přesně podle vašich potřeb</p>
                <div className="addons-list">
                  {addons.map((addon) => (
                    <div key={addon.id} className="addon-item">
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
                  ))}
                </div>
              </section>

              {/* Contact Form */}
              <section className="config-section">
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
                      <FontAwesomeIcon icon={faSignInAlt} />
                      Přihlásit se
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
              </section>
            </div>

            {/* Sidebar - Order Summary */}
            <div className="config-sidebar">
              <div className="order-summary-sticky">
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

                <div className="summary-divider"></div>

                <div className="summary-period-info">
                  <FontAwesomeIcon icon={billingPeriod === 'yearly' ? faCalendar : faClock} />
                  <span>{billingPeriod === 'yearly' ? 'Roční platba' : 'Měsíční platba'}</span>
                </div>

                <div className="summary-total-section">
                  <div className="total-row">
                    <span>Celkem</span>
                    <span className="total-amount">{formatPrice(calculateTotal())}</span>
                  </div>
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
                    <FontAwesomeIcon icon={faCheck} />
                    <span>30denní záruka vrácení peněz</span>
                  </div>
                  <div className="guarantee-item">
                    <FontAwesomeIcon icon={faCheck} />
                    <span>Bezplatná migrace</span>
                  </div>
                  <div className="guarantee-item">
                    <FontAwesomeIcon icon={faCheck} />
                    <span>SSL certifikát zdarma</span>
                  </div>
                </div>
              </div>
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
