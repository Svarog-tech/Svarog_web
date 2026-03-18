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
    <section id="hosting" className="pricing-section">
      <div className="container">
        <motion.header
          className="pricing-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2>{t('plans.mainTitle')}</h2>
          <p>{t('plans.subtitle')}</p>
        </motion.header>

        <motion.div
          className="pricing-controls"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <div className="control-group">
            <button
              className={hostingType === 'webhosting' ? 'active' : ''}
              onClick={() => setHostingType('webhosting')}
            >
              {t('plans.webhosting')}
            </button>
            <button
              className={hostingType === 'wordpress' ? 'active' : ''}
              onClick={() => setHostingType('wordpress')}
            >
              {t('plans.wordpress')}
            </button>
          </div>

          <div className="control-group">
            <button
              className={billingCycle === 'monthly' ? 'active' : ''}
              onClick={() => setBillingCycle('monthly')}
            >
              {t('plans.monthly')}
            </button>
            <button
              className={billingCycle === 'yearly' ? 'active' : ''}
              onClick={() => setBillingCycle('yearly')}
            >
              {t('plans.yearly')} <span className="save">-20%</span>
            </button>
          </div>
        </motion.div>

        <div className={`pricing-grid cols-${hostingType === 'wordpress' ? '2' : '4'}`}>
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={`pricing-card${plan.popular ? ' recommended' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              {plan.popular && <span className="badge">{t('plans.recommended') || 'Recommended'}</span>}

              <h3>{plan.name}</h3>

              <div className="price">
                <span className="amount">
                  {formatPrice(billingCycle === 'yearly' ? plan.yearlyPrice * 12 : plan.price)}
                </span>
                <span className="period">/ {billingCycle === 'yearly' ? t('plans.year') : t('plans.month')}</span>
              </div>

              <p className="description">{plan.description}</p>

              <ul>
                {plan.features.map((feature, idx) => (
                  <li key={idx}>
                    <FontAwesomeIcon icon={faCheck} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button onClick={() => handleSelectPlan(plan.id)}>
                {t('plans.selectPlan')}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HostingPlansNew;
