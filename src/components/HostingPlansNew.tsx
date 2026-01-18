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
    <section id="hosting" className="hosting-plans-new">
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
              className="plan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {plan.popular && (
                <div className="popular-stamp">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
              )}
              <div className="inner">
                <span className="pricing">
                  <span>
                    {formatPrice(billingCycle === 'yearly' ? plan.yearlyPrice * 12 : plan.price)}{' '}
                    <small>/ {billingCycle === 'yearly' ? 'rok' : 'měsíc'}</small>
                  </span>
                </span>
                <p className="title">{plan.name}</p>
                <p className="info">{plan.description}</p>
                <ul className="features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="icon">
                        <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 0h24v24H0z" fill="none"></path>
                          <path fill="currentColor" d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"></path>
                        </svg>
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="action">
                  <button className="button" onClick={() => handleSelectPlan(plan.id)}>
                    <span className="button__icon-wrapper">
                      <svg
                        viewBox="0 0 14 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="button__icon-svg"
                        width="10"
                      >
                        <path
                          d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"
                          fill="currentColor"
                        ></path>
                      </svg>

                      <svg
                        viewBox="0 0 14 15"
                        fill="none"
                        width="10"
                        xmlns="http://www.w3.org/2000/svg"
                        className="button__icon-svg button__icon-svg--copy"
                      >
                        <path
                          d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"
                          fill="currentColor"
                        ></path>
                      </svg>
                    </span>
                    Vybrat plán
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HostingPlansNew;
