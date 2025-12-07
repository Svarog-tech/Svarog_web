import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { usePlanSelection, HostingPlan } from '../hooks/usePlanSelection';
import { useWordPressPlans, WordPressPlan } from '../hooks/useWordPressPlans';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import './HostingPlansNew.css';

type HostingType = 'webhosting' | 'wordpress';

const HostingPlansNew: React.FC = () => {
  const navigate = useNavigate();
  const { plans: webPlans, selectPlan: selectWebPlan } = usePlanSelection();
  const { plans: wpPlans, selectPlan: selectWPPlan } = useWordPressPlans();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [hostingType, setHostingType] = useState<HostingType>('webhosting');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans: (HostingPlan | WordPressPlan)[] = hostingType === 'webhosting' ? webPlans : wpPlans;
  const selectPlan = hostingType === 'webhosting' ? selectWebPlan : selectWPPlan;

  const handleSelectPlan = (planId: string) => {
    selectPlan(planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      navigate('/configurator', { state: { plan } });
    }
  };

  return (
    <section className="hosting-plans-new">
      <div className="container">
        {/* Header */}
        <div className="plans-header-new">
          <h2 className="plans-title-new">Vyberte si hosting plán</h2>
          <p className="plans-subtitle-new">Jednoduché ceny, žádné skryté poplatky</p>
        </div>

        {/* Toggle Switches */}
        <div className="plans-toggles">
          {/* Hosting Type Toggle */}
          <div className="toggle-group">
            <button
              className={`toggle-btn ${hostingType === 'webhosting' ? 'active' : ''}`}
              onClick={() => setHostingType('webhosting')}
            >
              Webhosting
            </button>
            <button
              className={`toggle-btn ${hostingType === 'wordpress' ? 'active' : ''}`}
              onClick={() => setHostingType('wordpress')}
            >
              WordPress
            </button>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="toggle-group">
            <button
              className={`toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Měsíčně
            </button>
            <button
              className={`toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('yearly')}
            >
              Ročně
              <span className="save-badge">-10%</span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className={`plans-grid-new ${hostingType === 'wordpress' ? 'grid-2' : 'grid-4'}`}>
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={`plan-card-new ${plan.popular ? 'popular' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {plan.popular && (
                <div className="popular-badge-new">Nejpopulárnější</div>
              )}

              <div className="plan-header-new">
                <h3 className="plan-name-new">{plan.name}</h3>
                <div className="plan-price-new">
                  <span className="price-amount">
                    {formatPrice(billingCycle === 'yearly' ? plan.yearlyPrice * 12 : plan.price)}
                  </span>
                  <span className="price-period">
                    /{billingCycle === 'yearly' ? 'rok' : 'měsíc'}
                  </span>
                </div>
                <p className="plan-description-new">{plan.description}</p>
              </div>

              <ul className="features-list-new">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="feature-item-new">
                    <FontAwesomeIcon icon={faCheck} className="check-icon" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className="select-btn-new"
                onClick={() => handleSelectPlan(plan.id)}
              >
                Vybrat plán
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HostingPlansNew;
