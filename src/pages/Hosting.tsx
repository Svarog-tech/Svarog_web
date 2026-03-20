import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faHdd,
  faShieldHalved,
  faDatabase,
  faEnvelope,
  faCode,
  faRocket,
  faCheck,
  faArrowRight,
  faMicrochip,
  faMemory,
  faNetworkWired,
  faCloudArrowUp,
  faGlobe,
  faBolt,
  faLock
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import HostingPlansNew from '../components/HostingPlansNew';
import PageMeta from '../components/PageMeta';
import './Hosting.css';

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

// Server Diagram Component - Visual representation of server features
const ServerDiagram: React.FC = () => {
  const features = [
    { icon: faHdd, label: 'NVMe SSD', position: 'top-left' },
    { icon: faShieldHalved, label: 'SSL/TLS', position: 'top-right' },
    { icon: faDatabase, label: 'MariaDB', position: 'right' },
    { icon: faEnvelope, label: 'Email', position: 'bottom-right' },
    { icon: faCode, label: 'PHP 8.x', position: 'bottom-left' },
    { icon: faCloudArrowUp, label: 'Backups', position: 'left' },
  ];

  return (
    <div className="server-diagram">
      <div className="server-core">
        <div className="server-pulse"></div>
        <div className="server-icon">
          <FontAwesomeIcon icon={faServer} />
        </div>
      </div>

      <svg className="connection-lines" viewBox="0 0 400 400" preserveAspectRatio="none">
        {/* Connection lines from server edges to each feature */}
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
const BarChart: React.FC = () => {
  const data = [
    { label: 'CPU', value: 95, color: 'var(--primary-color)' },
    { label: 'RAM', value: 88, color: 'var(--accent-color)' },
    { label: 'I/O', value: 98, color: 'var(--success-color)' },
    { label: 'Net', value: 92, color: 'var(--warning-color)' },
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

// Timeline/Journey Component
const JourneyPath: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const steps = [
    { icon: faRocket, titleKey: 'hosting.journey.step1.title', descKey: 'hosting.journey.step1.desc' },
    { icon: faBolt, titleKey: 'hosting.journey.step2.title', descKey: 'hosting.journey.step2.desc' },
    { icon: faGlobe, titleKey: 'hosting.journey.step3.title', descKey: 'hosting.journey.step3.desc' },
  ];

  return (
    <div className="journey-path">
      <svg className="journey-line" viewBox="0 0 800 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary-color)" />
            <stop offset="50%" stopColor="var(--accent-color)" />
            <stop offset="100%" stopColor="var(--success-color)" />
          </linearGradient>
          <filter id="glow">
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
          stroke="url(#pathGradient)"
          strokeWidth="4"
          filter="url(#glow)"
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

// Tech Stack Flow
const TechFlow: React.FC = () => {
  const techs = [
    { name: 'HestiaCP', role: 'Control' },
    { name: 'LiteSpeed', role: 'Server' },
    { name: 'PHP 8.x', role: 'Backend' },
    { name: 'MariaDB', role: 'Database' },
    { name: 'Node.js', role: 'Runtime' },
  ];

  return (
    <div className="tech-flow">
      {techs.map((tech, index) => (
        <React.Fragment key={index}>
          <motion.div
            className="tech-node"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
          >
            <span className="tech-name">{tech.name}</span>
            <span className="tech-role">{tech.role}</span>
          </motion.div>
          {index < techs.length - 1 && (
            <motion.div
              className="tech-connector"
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

const Hosting: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <main className="hosting-page">
      <PageMeta
        title={`${t('hosting.title')}${t('hosting.titleHighlight')} – Alatyr Hosting`}
        description="Professional VPS hosting with full root access, NVMe storage, and 24/7 support."
        path="/hosting"
      />

      {/* Hero Header */}
      <section className="hosting-hero">
        {/* Animated Background */}
        <div className="hero-bg">
          <div className="hero-grid"></div>
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="hero-glow"></div>
          <svg className="hero-lines" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--primary-color)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,300 Q300,250 600,300 T1200,300" stroke="url(#heroLineGrad)" strokeWidth="1" fill="none" className="hero-wave-line" />
            <path d="M0,350 Q300,300 600,350 T1200,350" stroke="url(#heroLineGrad)" strokeWidth="1" fill="none" className="hero-wave-line delay-1" />
            <path d="M0,400 Q300,350 600,400 T1200,400" stroke="url(#heroLineGrad)" strokeWidth="1" fill="none" className="hero-wave-line delay-2" />
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
              {t('hosting.title')}{' '}
              <span className="gradient-text">{t('hosting.titleHighlight')}</span>
            </motion.h1>
            <motion.p
              className="hero-lead"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {t('hosting.description')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Server Diagram Section */}
      <section className="diagram-section">
        <div className="container">
          <div className="diagram-layout">
            <div className="diagram-text">
              <h2>{t('hosting.connected.title')} <span className="gradient-text">{t('hosting.connected.titleHighlight')}</span></h2>
              <p>{t('hosting.connected.desc')}</p>
              <ul className="feature-list">
                <li><FontAwesomeIcon icon={faCheck} /> {t('hosting.connected.feature1')}</li>
                <li><FontAwesomeIcon icon={faCheck} /> {t('hosting.connected.feature2')}</li>
                <li><FontAwesomeIcon icon={faCheck} /> {t('hosting.connected.feature3')}</li>
                <li><FontAwesomeIcon icon={faCheck} /> {t('hosting.connected.feature4')}</li>
              </ul>
            </div>
            <ServerDiagram />
          </div>
        </div>
      </section>

      {/* Performance Stats */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-header">
            <h2>{t('hosting.performance.title')} <span className="gradient-text">{t('hosting.performance.titleHighlight')}</span></h2>
            <p>{t('hosting.performance.subtitle')}</p>
          </div>

          <div className="stats-layout">
            <div className="stats-circles">
              <CircularStat value={99} label={t('hosting.performance.uptime')} suffix="%" color="var(--success-color)" />
              <CircularStat value={45} label={t('hosting.performance.response')} suffix="ms" color="var(--primary-color)" />
              <CircularStat value={10} label={t('hosting.performance.network')} suffix="Gb" color="var(--accent-color)" />
            </div>

            <div className="stats-bars">
              <h3>{t('hosting.performance.efficiency')}</h3>
              <BarChart />
            </div>

            <div className="stats-specs">
              <div className="spec-item">
                <FontAwesomeIcon icon={faMicrochip} />
                <div>
                  <strong>AMD EPYC</strong>
                  <span>{t('hosting.performance.latestCpu')}</span>
                </div>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faMemory} />
                <div>
                  <strong>DDR4 ECC</strong>
                  <span>{t('hosting.performance.eccRam')}</span>
                </div>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faHdd} />
                <div>
                  <strong>NVMe RAID-10</strong>
                  <span>{t('hosting.performance.redundantStorage')}</span>
                </div>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faLock} />
                <div>
                  <strong>DDoS Protected</strong>
                  <span>{t('hosting.performance.enterpriseSecurity')}</span>
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
            <h2>{t('hosting.journey.title')} <span className="gradient-text">{t('hosting.journey.titleHighlight')}</span></h2>
            <p>{t('hosting.journey.subtitle')}</p>
          </div>
          <JourneyPath t={t} />
        </div>
      </section>

      {/* Tech Stack */}
      <section className="tech-section">
        <div className="container">
          <div className="tech-header">
            <h2>{t('hosting.tech.title')} <span className="gradient-text">{t('hosting.tech.titleHighlight')}</span></h2>
            <p>{t('hosting.tech.subtitle')}</p>
          </div>
          <TechFlow />
        </div>
      </section>

      {/* Pricing */}
      <HostingPlansNew />

      {/* CTA */}
      <section className="hosting-cta">
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
            <h2>Ready to Launch?</h2>
            <p>Join thousands of satisfied customers with professional hosting</p>
            <div className="cta-buttons">
              <button className="btn-primary" onClick={() => navigate('/configurator')}>
                <span>Get Started</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
              <button className="btn-secondary" onClick={() => navigate('/support')}>
                <span>Talk to Sales</span>
              </button>
            </div>
            <div className="cta-guarantees">
              <span><FontAwesomeIcon icon={faCheck} /> 30-day money back</span>
              <span><FontAwesomeIcon icon={faCheck} /> Free migration</span>
              <span><FontAwesomeIcon icon={faCheck} /> 5-min setup</span>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Hosting;
