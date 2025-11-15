import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faCheck,
  faServer,
  faEnvelope,
  faDatabase,
  faShieldAlt,
  faNetworkWired,
  faGlobe,
  faPlus,
  faMinus,
  faArrowRight,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { createOrder, Order } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';

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

const OrderForm: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<HostingPlan | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [domainOption, setDomainOption] = useState<'new' | 'existing' | 'none'>('new');
  const [domainName, setDomainName] = useState('');
  const { formatPrice } = useCurrency();

  const [addons, setAddons] = useState<Addon[]>([
    {
      id: 'storage',
      name: '+10 GB prostoru',
      description: 'Rozšíření úložného prostoru',
      price: 20,
      icon: faServer,
      quantity: 0,
      max: 10
    },
    {
      id: 'email',
      name: '+1 e-mail schránka',
      description: 'Přidání další e-mailové schránky',
      price: 5,
      icon: faEnvelope,
      quantity: 0,
      max: 20
    },
    {
      id: 'database',
      name: '+1 databáze',
      description: 'Přidání další databáze',
      price: 10,
      icon: faDatabase,
      quantity: 0,
      max: 10
    },
    {
      id: 'backup',
      name: 'Zálohy 3× denně',
      description: 'Automatické zálohování třikrát denně',
      price: 30,
      icon: faShieldAlt,
      quantity: 0,
      max: 1
    },
    {
      id: 'ip',
      name: 'Dedikovaná IP',
      description: 'Vlastní dedikovaná IP adresa',
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

  useEffect(() => {
    const handlePlanSelect = (event: any) => {
      setSelectedPlan(event.detail);
      setIsVisible(true);
      setCurrentStep(1);
      // Reset addons when new plan is selected
      setAddons(addons.map(addon => ({ ...addon, quantity: 0 })));
    };

    window.addEventListener('selectPlan', handlePlanSelect);
    return () => window.removeEventListener('selectPlan', handlePlanSelect);
  }, []);

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
        ? addon.price * 0.9 // 10% discount for yearly
        : addon.price;
      return sum + (addonPrice * addon.quantity);
    }, 0);

    return billingPeriod === 'yearly' ? planPrice + (addonsTotal * 12) : planPrice + addonsTotal;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsLoading(true);
    try {
      const selectedAddons = addons.filter(a => a.quantity > 0).map(a => ({
        id: a.id,
        name: a.name,
        quantity: a.quantity,
        price: a.price
      }));

      const orderData: Omit<Order, 'id' | 'created_at'> = {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        price: calculateTotal(),
        customer_email: formData.customerEmail,
        customer_name: formData.customerName,
        status: 'pending'
      };

      await createOrder(orderData);
      setOrderSuccess(true);
      setFormData({ customerName: '', customerEmail: '', customerPhone: '', customerAddress: '' });
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Chyba při vytváření objednávky. Zkuste to prosím znovu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setOrderSuccess(false);
    setCurrentStep(1);
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="configurator-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="configurator-container"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <button className="configurator-close" onClick={handleClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>

            {orderSuccess ? (
              <motion.div
                className="order-success-screen"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="success-icon">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <h2>Objednávka úspěšně vytvořena!</h2>
                <p>Děkujeme za vaši objednávku. Brzy vás budeme kontaktovat s dalšími informacemi na emailu:</p>
                <p className="success-email">{formData.customerEmail}</p>
                <button className="success-close-btn" onClick={handleClose}>
                  Zavřít
                </button>
              </motion.div>
            ) : (
              <>
                {/* Progress Steps */}
                <div className="configurator-steps">
                  <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
                    <div className="step-number">1</div>
                    <div className="step-label">Plán & Období</div>
                  </div>
                  <div className="step-line"></div>
                  <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
                    <div className="step-number">2</div>
                    <div className="step-label">Doplňky</div>
                  </div>
                  <div className="step-line"></div>
                  <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
                    <div className="step-number">3</div>
                    <div className="step-label">Kontakt</div>
                  </div>
                </div>

                <div className="configurator-content">
                  {/* Step 1: Plan & Billing */}
                  {currentStep === 1 && selectedPlan && (
                    <motion.div
                      className="config-step"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <h2>Vybraný plán</h2>
                      <div className="selected-plan-card">
                        <h3>{selectedPlan.name}</h3>
                        <p className="plan-desc">{selectedPlan.description}</p>
                        <div className="plan-price-display">
                          <span className="price-amount">{formatPrice(billingPeriod === 'yearly' ? selectedPlan.yearlyPrice * 12 : selectedPlan.price)}</span>
                          <span className="price-period">/{billingPeriod === 'yearly' ? 'rok' : 'měsíc'}</span>
                        </div>
                      </div>

                      <h3 className="section-title">Fakturační období</h3>
                      <div className="billing-options">
                        <motion.div
                          className={`billing-option ${billingPeriod === 'monthly' ? 'selected' : ''}`}
                          onClick={() => setBillingPeriod('monthly')}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="option-header">
                            <h4>Měsíčně</h4>
                            <div className="option-price">{formatPrice(selectedPlan.price)}/měsíc</div>
                          </div>
                        </motion.div>

                        <motion.div
                          className={`billing-option ${billingPeriod === 'yearly' ? 'selected' : ''}`}
                          onClick={() => setBillingPeriod('yearly')}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="option-header">
                            <h4>Ročně</h4>
                            <div className="option-price">{formatPrice(selectedPlan.yearlyPrice * 12)}/rok</div>
                          </div>
                          <div className="option-badge">Ušetříte 10%</div>
                        </motion.div>
                      </div>

                      <h3 className="section-title">Doména</h3>
                      <div className="domain-options">
                        <label className={`domain-option ${domainOption === 'new' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="domain"
                            value="new"
                            checked={domainOption === 'new'}
                            onChange={(e) => setDomainOption(e.target.value as any)}
                          />
                          <div className="option-content">
                            <FontAwesomeIcon icon={faGlobe} />
                            <div>
                              <h4>Registrovat novou doménu</h4>
                              <p>Najdu si novou doménu</p>
                            </div>
                          </div>
                        </label>

                        <label className={`domain-option ${domainOption === 'existing' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="domain"
                            value="existing"
                            checked={domainOption === 'existing'}
                            onChange={(e) => setDomainOption(e.target.value as any)}
                          />
                          <div className="option-content">
                            <FontAwesomeIcon icon={faGlobe} />
                            <div>
                              <h4>Použít existující doménu</h4>
                              <p>Mám již registrovanou doménu</p>
                            </div>
                          </div>
                        </label>

                        <label className={`domain-option ${domainOption === 'none' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="domain"
                            value="none"
                            checked={domainOption === 'none'}
                            onChange={(e) => setDomainOption(e.target.value as any)}
                          />
                          <div className="option-content">
                            <FontAwesomeIcon icon={faGlobe} />
                            <div>
                              <h4>Zatím bez domény</h4>
                              <p>Doménu vyřeším později</p>
                            </div>
                          </div>
                        </label>
                      </div>

                      {(domainOption === 'new' || domainOption === 'existing') && (
                        <motion.div
                          className="domain-input-wrapper"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                        >
                          <input
                            type="text"
                            placeholder={domainOption === 'new' ? 'např. mojeweb.cz' : 'Zadejte vaši doménu'}
                            value={domainName}
                            onChange={(e) => setDomainName(e.target.value)}
                            className="domain-input"
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Step 2: Addons */}
                  {currentStep === 2 && (
                    <motion.div
                      className="config-step"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <h2>Doplňky a rozšíření</h2>
                      <p className="step-description">Přizpůsobte si hosting dle vašich potřeb</p>

                      <div className="addons-grid">
                        {addons.map((addon) => (
                          <div key={addon.id} className="addon-card">
                            <div className="addon-icon">
                              <FontAwesomeIcon icon={addon.icon} />
                            </div>
                            <div className="addon-info">
                              <h4>{addon.name}</h4>
                              <p>{addon.description}</p>
                              <div className="addon-price">
                                +{formatPrice(addon.price)}/{billingPeriod === 'yearly' ? 'rok' : 'měsíc'}
                              </div>
                            </div>
                            <div className="addon-controls">
                              <button
                                className="addon-btn"
                                onClick={() => updateAddonQuantity(addon.id, -1)}
                                disabled={addon.quantity === 0}
                              >
                                <FontAwesomeIcon icon={faMinus} />
                              </button>
                              <span className="addon-quantity">{addon.quantity}</span>
                              <button
                                className="addon-btn"
                                onClick={() => updateAddonQuantity(addon.id, 1)}
                                disabled={addon.quantity >= (addon.max || Infinity)}
                              >
                                <FontAwesomeIcon icon={faPlus} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Contact Info */}
                  {currentStep === 3 && (
                    <motion.div
                      className="config-step"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <h2>Kontaktní údaje</h2>
                      <form onSubmit={handleSubmit} className="contact-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Jméno a příjmení *</label>
                            <input
                              type="text"
                              value={formData.customerName}
                              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                              required
                              placeholder="Jan Novák"
                            />
                          </div>
                          <div className="form-group">
                            <label>Email *</label>
                            <input
                              type="email"
                              value={formData.customerEmail}
                              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                              required
                              placeholder="jan@email.cz"
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Telefon</label>
                            <input
                              type="tel"
                              value={formData.customerPhone}
                              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                              placeholder="+420 123 456 789"
                            />
                          </div>
                          <div className="form-group">
                            <label>Adresa</label>
                            <input
                              type="text"
                              value={formData.customerAddress}
                              onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                              placeholder="Ulice 123, Praha"
                            />
                          </div>
                        </div>

                        <div className="order-summary">
                          <h3>Shrnutí objednávky</h3>
                          <div className="summary-item">
                            <span>Plán {selectedPlan?.name}</span>
                            <span>{formatPrice(billingPeriod === 'yearly' ? selectedPlan!.yearlyPrice * 12 : selectedPlan!.price)}</span>
                          </div>
                          {addons.filter(a => a.quantity > 0).map(addon => (
                            <div key={addon.id} className="summary-item addon-item">
                              <span>{addon.name} × {addon.quantity}</span>
                              <span>+{formatPrice(addon.price * addon.quantity * (billingPeriod === 'yearly' ? 12 : 1))}</span>
                            </div>
                          ))}
                          <div className="summary-divider"></div>
                          <div className="summary-total">
                            <span>Celkem</span>
                            <span className="total-price">{formatPrice(calculateTotal())}</span>
                          </div>
                          <div className="summary-period">
                            {billingPeriod === 'yearly' ? 'Za rok' : 'Za měsíc'}
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="submit-order-btn"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Zpracování...' : 'Dokončit objednávku'}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="configurator-navigation">
                  {currentStep > 1 && (
                    <button className="nav-btn prev-btn" onClick={prevStep}>
                      <FontAwesomeIcon icon={faArrowLeft} />
                      Zpět
                    </button>
                  )}
                  {currentStep < 3 && (
                    <button className="nav-btn next-btn" onClick={nextStep}>
                      Pokračovat
                      <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                  )}
                </div>

                {/* Price Summary Bar */}
                <div className="price-summary-bar">
                  <div className="summary-bar-content">
                    <span className="summary-label">Celková cena:</span>
                    <span className="summary-price">{formatPrice(calculateTotal())}</span>
                    <span className="summary-period">/{billingPeriod === 'yearly' ? 'rok' : 'měsíc'}</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderForm;
