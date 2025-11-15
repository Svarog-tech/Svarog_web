import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faBolt,
  faGem,
  faCheck,
  faShield,
  faStar,
  faLock,
  faWandMagicSparkles,
  faCrown
} from '@fortawesome/free-solid-svg-icons';
import { usePlanSelection } from '../hooks/usePlanSelection';
import { useWordPressPlans } from '../hooks/useWordPressPlans';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const iconMap: Record<string, IconDefinition> = {
  'basic': faRocket,
  'standard': faBolt,
  'pro': faGem,
  'ultimate': faCrown,
  'wp-start': faRocket,
  'wp-pro': faCrown
};

type HostingType = 'webhosting' | 'wordpress';

const HostingPlans: React.FC = () => {
  const navigate = useNavigate();
  const { plans: webPlans, selectedPlan: selectedWebPlan, selectedPlanId: selectedWebPlanId, selectPlan: selectWebPlan } = usePlanSelection();
  const { plans: wpPlans, selectedPlan: selectedWPPlan, selectedPlanId: selectedWPPlanId, selectPlan: selectWPPlan } = useWordPressPlans();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [hoveredPlan, setHoveredPlan] = useState<string>('');
  const [isYearly, setIsYearly] = useState(false);
  const [hostingType, setHostingType] = useState<HostingType>('webhosting');
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Dynamically get current plans based on hosting type
  const plans = hostingType === 'webhosting' ? webPlans : wpPlans;
  const selectedPlanId = hostingType === 'webhosting' ? selectedWebPlanId : selectedWPPlanId;
  const selectPlan = hostingType === 'webhosting' ? selectWebPlan : selectWPPlan;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    const planCards = document.querySelectorAll('.plan-card');
    planCards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  const handleSelectPlan = (planId: string) => {
    selectPlan(planId);
    const plan = plans.find((p: any) => p.id === planId);
    if (plan) {
      // Navigate to configurator with plan data
      navigate('/configurator', { state: { plan } });
    }
  };

  return (
    <motion.section
      className="hosting-plans"
      id="hosting"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: isInView ? 1 : 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="plans-background">
        <motion.div
          className="bg-gradient-1"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        ></motion.div>
        <motion.div
          className="bg-gradient-2"
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        ></motion.div>
        <div className="floating-shapes">
          <motion.div
            className="shape shape-1"
            animate={{
              y: [-20, 20, -20],
              x: [-15, 15, -15],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          ></motion.div>
          <motion.div
            className="shape shape-2"
            animate={{
              y: [20, -20, 20],
              x: [15, -15, 15],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          ></motion.div>
          <motion.div
            className="shape shape-3"
            animate={{
              y: [-10, 10, -10],
              rotate: [0, -180, 0]
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          ></motion.div>
        </div>
      </div>

      <div className="container">
        {/* New Compact Header Design */}
        <motion.div
          className="plans-header-compact"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.div
            className="plans-header-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: isInView ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {/* Left: Special Offer Badge */}
            <motion.div
              className="special-offer-badge"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: isInView ? 1 : 0, x: isInView ? 0 : -30 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} className="offer-icon" />
              <div className="offer-text">
                <div className="offer-title">Speciální nabídka</div>
                <div className="offer-discount">Sleva až 50%</div>
              </div>
            </motion.div>

            {/* Center: Main Title */}
            <motion.div
              className="plans-title-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <h2 className="plans-main-title">
                Vyberte si <span className="highlight-text">hosting plán</span>
              </h2>
            </motion.div>

            {/* Right: Guarantee Text */}
            <motion.div
              className="plans-guarantee-text"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: isInView ? 1 : 0, x: isInView ? 0 : 30 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <p>Všechny plány zahrnují 30-denní záruku vrácení peněz a bezplatnou migraci</p>
            </motion.div>
          </motion.div>

          {/* Hosting Type Toggle */}
          <motion.div
            className="hosting-type-toggle-wrapper"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="hosting-type-toggle">
              <motion.button
                className={`hosting-type-btn ${hostingType === 'webhosting' ? 'active' : ''}`}
                onClick={() => setHostingType('webhosting')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {hostingType === 'webhosting' && (
                  <motion.div
                    layoutId="hostingTypeBackground"
                    className="billing-active-bg"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="billing-text">Webhosting</span>
              </motion.button>
              <motion.button
                className={`hosting-type-btn ${hostingType === 'wordpress' ? 'active' : ''}`}
                onClick={() => setHostingType('wordpress')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {hostingType === 'wordpress' && (
                  <motion.div
                    layoutId="hostingTypeBackground"
                    className="billing-active-bg"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="billing-text">WordPress</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Billing Toggle */}
          <motion.div
            className="billing-toggle-wrapper"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            <div className="billing-toggle-compact">
              <motion.button
                className={`billing-btn-compact ${!isYearly ? 'active' : ''}`}
                onClick={() => setIsYearly(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {!isYearly && (
                  <motion.div
                    layoutId="billingBackground"
                    className="billing-active-bg"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="billing-text">Měsíčně</span>
              </motion.button>
              <motion.button
                className={`billing-btn-compact ${isYearly ? 'active' : ''}`}
                onClick={() => setIsYearly(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isYearly && (
                  <motion.div
                    layoutId="billingBackground"
                    className="billing-active-bg"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="billing-text">Ročně</span>
                <span className="billing-badge-compact">-10%</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>

        <div className={`plans-grid ${hostingType === 'wordpress' ? 'plans-grid-wp' : ''}`}>
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={`plan-card ${plan.popular ? 'popular' : ''} ${selectedPlanId === plan.id ? 'selected' : ''} ${hoveredPlan === plan.id ? 'hovered' : ''}`}
              initial={{ opacity: 0, y: 50 }}
              animate={{
                opacity: isInView ? 1 : 0,
                y: isInView ? 0 : 50
              }}
              transition={{
                duration: 0.6,
                delay: 0.6 + (index * 0.2),
                ease: "easeOut"
              }}
              whileHover={{
                y: -10,
                scale: 1.02,
                transition: { type: "spring", stiffness: 300 }
              }}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan('')}
            >
              {plan.popular && (
                <motion.div
                  className="popular-badge"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1 + (index * 0.2), type: "spring" }}
                >
                  <FontAwesomeIcon icon={faStar} className="badge-icon" />
                  <span>{t('plans.popular')}</span>
                </motion.div>
              )}

              <div className="plan-header">
                <motion.div
                  className="plan-icon"
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <FontAwesomeIcon icon={iconMap[plan.id]} />
                </motion.div>
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>
              </div>

              <div className="pricing">
                {/* Original Price - pouze pro roční platbu */}
                {isYearly && plan.originalYearlyPrice && (
                  <motion.div
                    className="original-price"
                    key={`original-${isYearly ? 'yearly' : 'monthly'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span>
                      {formatPrice(plan.originalYearlyPrice * 12)}
                    </span>
                  </motion.div>
                )}

                {/* Current Price */}
                <motion.div
                  className="current-price"
                  key={`price-${isYearly ? 'yearly' : 'monthly'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="amount">
                    {formatPrice(isYearly ? plan.yearlyPrice * 12 : plan.price)}
                  </span>
                </motion.div>

                {/* Period */}
                <motion.div
                  className="price-period"
                  key={`period-${isYearly ? 'yearly' : 'monthly'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  {isYearly ? t('plans.perYear') : t('plans.perMonth')}
                </motion.div>

                {/* Savings - pouze pro roční platbu */}
                {isYearly && plan.originalYearlyPrice && (
                  <motion.div
                    className="savings"
                    key={`savings-${isYearly ? 'yearly' : 'monthly'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    {t('plans.save')} {formatPrice((plan.originalYearlyPrice * 12) - (plan.yearlyPrice * 12))} {t('plans.saveAmount')}
                  </motion.div>
                )}
              </div>

              <ul className="features-list">
                {plan.features.map((feature, index) => (
                  <motion.li
                    key={index}
                    className="feature-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: isInView ? 1 : 0, x: isInView ? 0 : -20 }}
                    transition={{ delay: 1.2 + (index * 0.1) }}
                  >
                    <FontAwesomeIcon icon={faCheck} className="feature-icon" />
                    <span className="feature-text">{feature}</span>
                  </motion.li>
                ))}
              </ul>

              <motion.button
                className={`select-btn ${selectedPlanId === plan.id ? 'selected' : ''}`}
                onClick={() => handleSelectPlan(plan.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="btn-text">
                  {selectedPlanId === plan.id ? t('plans.selected') : t('plans.selectPlan')}
                </span>
                <FontAwesomeIcon
                  icon={selectedPlanId === plan.id ? faCheck : faRocket}
                  className="btn-icon"
                />
                <div className="btn-shine"></div>
              </motion.button>

              <div className="plan-guarantee">
                <FontAwesomeIcon icon={faShield} className="guarantee-icon" />
                <span>{t('plans.guarantee')}</span>
              </div>

              <div className="card-glow"></div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="plans-footer"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 1.5 }}
        >
          <div className="trust-signals">
            <motion.div
              className="trust-item"
              whileHover={{ scale: 1.1, y: -5 }}
            >
              <FontAwesomeIcon icon={faBolt} className="trust-icon" />
              <span>{t('plans.uptime99')}</span>
            </motion.div>
            <motion.div
              className="trust-item"
              whileHover={{ scale: 1.1, y: -5 }}
            >
              <FontAwesomeIcon icon={faLock} className="trust-icon" />
              <span>{t('plans.securePayments')}</span>
            </motion.div>
            <motion.div
              className="trust-item"
              whileHover={{ scale: 1.1, y: -5 }}
            >
              <FontAwesomeIcon icon={faRocket} className="trust-icon" />
              <span>{t('plans.quickActivation')}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default HostingPlans;