import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faHeart,
  faRocket,
  faCheck,
  faArrowRight,
  faLightbulb,
  faShieldHalved,
  faHeadset,
  faHandshake,
  faChartLine,
  faPeopleGroup,
  faGlobe,
  faBolt,
  faBuilding,
  faMapMarkerAlt,
  faClock,
  faLock
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import PageMeta from '../components/PageMeta';
import './About.css';

// Animated counter hook
const useAnimatedValue = (end: number, duration: number = 2000) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setValue(end);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return { value, ref };
};

// Company Diagram Component - Visual representation of company values
const CompanyDiagram: React.FC = () => {
  const features = [
    { icon: faLightbulb, label: 'Innovation', position: 'top-left' },
    { icon: faShieldHalved, label: 'Quality', position: 'top-right' },
    { icon: faHeadset, label: 'Support', position: 'right' },
    { icon: faHandshake, label: 'Trust', position: 'bottom-right' },
    { icon: faChartLine, label: 'Growth', position: 'bottom-left' },
    { icon: faPeopleGroup, label: 'Community', position: 'left' },
  ];

  return (
    <div className="company-diagram">
      <div className="company-core">
        <div className="company-pulse"></div>
        <div className="company-icon">
          <FontAwesomeIcon icon={faHeart} />
        </div>
        <span className="company-label">Alatyr</span>
      </div>

      <svg className="connection-lines" viewBox="0 0 400 400" preserveAspectRatio="none">
        <line x1="165" y1="165" x2="80" y2="80" stroke="var(--primary-color)" strokeWidth="2" strokeOpacity="0.5" className="conn-line" />
        <line x1="235" y1="165" x2="320" y2="80" stroke="var(--primary-color)" strokeWidth="2" strokeOpacity="0.5" className="conn-line" />
        <line x1="240" y1="200" x2="363" y2="200" stroke="var(--primary-color)" strokeWidth="2" strokeOpacity="0.5" className="conn-line" />
        <line x1="230" y1="220" x2="320" y2="320" stroke="var(--primary-color)" strokeWidth="2" strokeOpacity="0.5" className="conn-line" />
        <line x1="170" y1="220" x2="80" y2="320" stroke="var(--primary-color)" strokeWidth="2" strokeOpacity="0.5" className="conn-line" />
        <line x1="160" y1="200" x2="37" y2="200" stroke="var(--primary-color)" strokeWidth="2" strokeOpacity="0.5" className="conn-line" />
      </svg>

      {features.map((feature, index) => (
        <motion.div
          key={index}
          className={`feature-node ${feature.position}`}
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 + 0.3 }}
          viewport={{ once: true }}
        >
          <div className="node-icon">
            <FontAwesomeIcon icon={feature.icon} />
          </div>
          <span className="node-label">{feature.label}</span>
        </motion.div>
      ))}
    </div>
  );
};

// Circular Stats Component
const CircularStat: React.FC<{ value: number; label: string; suffix?: string; color: string }> = ({
  value, label, suffix = '', color
}) => {
  const { value: animatedValue, ref } = useAnimatedValue(value);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className="circular-stat" ref={ref}>
      <svg viewBox="0 0 120 120" className="stat-ring">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-light)" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          viewport={{ once: true }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <div className="stat-content">
        <span className="stat-value">{animatedValue}{suffix}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
};

// Animated Bar Chart
const BarChart: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const data = [
    { label: t('about.chart.satisfaction'), value: 95, color: 'var(--primary-color)' },
    { label: t('about.chart.reliability'), value: 99, color: 'var(--accent-color)' },
    { label: t('about.chart.support'), value: 92, color: 'var(--success-color)' },
    { label: t('about.chart.innovation'), value: 88, color: 'var(--warning-color)' },
  ];

  return (
    <div className="bar-chart">
      {data.map((item, index) => (
        <div key={index} className="bar-item">
          <div className="bar-track">
            <motion.div
              className="bar-fill"
              style={{ backgroundColor: item.color }}
              initial={{ height: 0 }}
              whileInView={{ height: `${item.value}%` }}
              transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }}
              viewport={{ once: true }}
            />
          </div>
          <span className="bar-label">{item.label}</span>
          <span className="bar-value">{item.value}%</span>
        </div>
      ))}
    </div>
  );
};

// Journey/Timeline Component
const JourneyPath: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const steps = [
    { icon: faRocket, titleKey: 'about.journey.step1.title', descKey: 'about.journey.step1.desc' },
    { icon: faBolt, titleKey: 'about.journey.step2.title', descKey: 'about.journey.step2.desc' },
    { icon: faGlobe, titleKey: 'about.journey.step3.title', descKey: 'about.journey.step3.desc' },
  ];

  return (
    <div className="journey-path">
      <svg className="journey-line" viewBox="0 0 800 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="aboutPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary-color)" />
            <stop offset="50%" stopColor="var(--accent-color)" />
            <stop offset="100%" stopColor="var(--success-color)" />
          </linearGradient>
          <filter id="aboutGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <motion.path
          d="M0,50 Q200,20 400,50 T800,50"
          fill="none"
          stroke="url(#aboutPathGradient)"
          strokeWidth="4"
          filter="url(#aboutGlow)"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          viewport={{ once: true }}
        />
      </svg>
      <div className="journey-stops">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            className="journey-stop"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.2, duration: 0.5 }}
            viewport={{ once: true }}
          >
            <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="stop-marker-wrapper">
              <div className="marker-ring"></div>
              <div className="stop-marker">
                <FontAwesomeIcon icon={step.icon} />
              </div>
              <div className="marker-glow"></div>
            </div>
            <div className="stop-content">
              <h4>{t(step.titleKey)}</h4>
              <p>{t(step.descKey)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Values Flow
const ValuesFlow: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const values = [
    { name: t('about.values.reliability.title'), role: t('about.flow.foundation') },
    { name: t('about.values.innovation.title'), role: t('about.flow.driver') },
    { name: t('about.flow.quality'), role: t('about.flow.standard') },
    { name: t('about.values.care.title'), role: t('about.flow.priority') },
    { name: t('about.flow.excellence'), role: t('about.flow.goal') },
  ];

  return (
    <div className="values-flow">
      {values.map((value, index) => (
        <React.Fragment key={index}>
          <motion.div
            className="value-node"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
          >
            <span className="value-name">{value.name}</span>
            <span className="value-role">{value.role}</span>
          </motion.div>
          {index < values.length - 1 && (
            <motion.div
              className="value-connector"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ delay: index * 0.1 + 0.1 }}
              viewport={{ once: true }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const About: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <main className="about-page">
      <PageMeta
        title={`${t('about.title')} ${t('about.titleHighlight')} – Alatyr Hosting`}
        description="Poznejte tým Alatyr Hosting. Profesionální webhosting s důrazem na spolehlivost, inovace a zákaznickou podporu."
        path="/about"
      />

      {/* Hero Header */}
      <section className="about-hero">
        {/* Animated Background */}
        <div className="hero-bg">
          <div className="hero-grid"></div>
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="hero-glow"></div>
          <svg className="hero-lines" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="aboutHeroLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--primary-color)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,300 Q300,250 600,300 T1200,300" stroke="url(#aboutHeroLineGrad)" strokeWidth="1" fill="none" className="hero-wave-line" />
            <path d="M0,350 Q300,300 600,350 T1200,350" stroke="url(#aboutHeroLineGrad)" strokeWidth="1" fill="none" className="hero-wave-line delay-1" />
            <path d="M0,400 Q300,350 600,400 T1200,400" stroke="url(#aboutHeroLineGrad)" strokeWidth="1" fill="none" className="hero-wave-line delay-2" />
          </svg>
          <div className="hero-particles">
            {[...Array(20)].map((_, i) => (
              <span key={i} className="particle" style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }} />
            ))}
          </div>
        </div>

        <div className="container">
          <div className="hero-content">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0 }}
            >
              {t('about.title')}{' '}
              <span className="gradient-text">{t('about.titleHighlight')}</span>
            </motion.h1>
            <motion.p
              className="hero-lead"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {t('about.description')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Company Diagram Section */}
      <section className="diagram-section">
        <div className="container">
          <div className="diagram-layout">
            <div className="diagram-text">
              <h2>{t('about.diagram.title')} <span className="gradient-text">{t('about.diagram.titleHighlight')}</span></h2>
              <p>{t('about.diagram.desc')}</p>
              <ul className="feature-list">
                <li><FontAwesomeIcon icon={faCheck} /> {t('about.diagram.feature1')}</li>
                <li><FontAwesomeIcon icon={faCheck} /> {t('about.diagram.feature2')}</li>
                <li><FontAwesomeIcon icon={faCheck} /> {t('about.diagram.feature3')}</li>
                <li><FontAwesomeIcon icon={faCheck} /> {t('about.diagram.feature4')}</li>
              </ul>
            </div>
            <CompanyDiagram />
          </div>
        </div>
      </section>

      {/* Performance Stats */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-header">
            <h2>{t('about.stats.title')} <span className="gradient-text">{t('about.stats.titleHighlight')}</span></h2>
            <p>{t('about.stats.subtitle')}</p>
          </div>

          <div className="stats-layout">
            <div className="stats-circles">
              <CircularStat value={99} label={t('about.stats.uptime')} suffix="%" color="var(--success-color)" />
              <CircularStat value={95} label={t('about.stats.satisfaction')} suffix="%" color="var(--primary-color)" />
              <CircularStat value={5} label={t('about.stats.years')} suffix="+" color="var(--accent-color)" />
            </div>

            <div className="stats-bars">
              <h3>{t('about.chart.title')}</h3>
              <BarChart t={t} />
            </div>

            <div className="stats-specs">
              <div className="spec-item">
                <FontAwesomeIcon icon={faUsers} />
                <div>
                  <strong>{t('about.specs.team')}</strong>
                  <span>{t('about.specs.teamDesc')}</span>
                </div>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                <div>
                  <strong>{t('about.specs.location')}</strong>
                  <span>{t('about.specs.locationDesc')}</span>
                </div>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faClock} />
                <div>
                  <strong>{t('about.specs.operations')}</strong>
                  <span>{t('about.specs.operationsDesc')}</span>
                </div>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faLock} />
                <div>
                  <strong>{t('about.specs.security')}</strong>
                  <span>{t('about.specs.securityDesc')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section className="journey-section">
        <div className="container">
          <div className="journey-header">
            <h2>{t('about.journey.title')} <span className="gradient-text">{t('about.journey.titleHighlight')}</span></h2>
            <p>{t('about.journey.subtitle')}</p>
          </div>
          <JourneyPath t={t} />
        </div>
      </section>

      {/* Values Flow */}
      <section className="values-section">
        <div className="container">
          <div className="values-header">
            <h2>{t('about.valuesTitle')} <span className="gradient-text">{t('about.valuesDescription')}</span></h2>
            <p>{t('about.values.subtitle')}</p>
          </div>
          <ValuesFlow t={t} />
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta">
        <div className="container">
          <motion.div
            className="cta-content"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="cta-visual">
              <div className="cta-rings">
                <div className="ring ring-1"></div>
                <div className="ring ring-2"></div>
                <div className="ring ring-3"></div>
              </div>
              <FontAwesomeIcon icon={faRocket} className="cta-icon" />
            </div>
            <h2>{t('about.cta.title')}</h2>
            <p>{t('about.cta.description')}</p>
            <div className="cta-buttons">
              <button className="btn-primary" onClick={() => navigate('/configurator')}>
                <span>{t('about.cta.button')}</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
              <button className="btn-secondary" onClick={() => navigate('/support')}>
                <span>{t('about.cta.contact')}</span>
              </button>
            </div>
            <div className="cta-guarantees">
              <span><FontAwesomeIcon icon={faCheck} /> {t('about.cta.badge1')}</span>
              <span><FontAwesomeIcon icon={faCheck} /> {t('about.cta.badge2')}</span>
              <span><FontAwesomeIcon icon={faCheck} /> {t('about.cta.badge3')}</span>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default About;
