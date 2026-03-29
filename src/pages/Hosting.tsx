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
        <line x1="165" y1="165" x2="80" y2="80" stroke="var(--primary-color)" strokeWidth="2.5" strokeOpacity="0.7" className="conn-line" />
        <line x1="235" y1="165" x2="320" y2="80" stroke="var(--primary-color)" strokeWidth="2.5" strokeOpacity="0.7" className="conn-line" />
        <line x1="240" y1="200" x2="363" y2="200" stroke="var(--primary-color)" strokeWidth="2.5" strokeOpacity="0.7" className="conn-line" />
        <line x1="230" y1="220" x2="320" y2="320" stroke="var(--primary-color)" strokeWidth="2.5" strokeOpacity="0.7" className="conn-line" />
        <line x1="170" y1="220" x2="80" y2="320" stroke="var(--primary-color)" strokeWidth="2.5" strokeOpacity="0.7" className="conn-line" />
        <line x1="160" y1="200" x2="37" y2="200" stroke="var(--primary-color)" strokeWidth="2.5" strokeOpacity="0.7" className="conn-line" />
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

// Chaotic Network Visualization
const NetworkDisplay: React.FC = () => {
  const nodes = [
    // Main cluster
    { id: 'a', x: 185, y: 175, size: 18, primary: true },
    { id: 'b', x: 255, y: 145, size: 12 },
    { id: 'c', x: 145, y: 120, size: 10 },
    { id: 'd', x: 95, y: 185, size: 11 },
    { id: 'e', x: 130, y: 255, size: 9 },
    { id: 'f', x: 220, y: 235, size: 13 },
    { id: 'g', x: 290, y: 210, size: 10 },
    // Scattered nodes
    { id: 'h', x: 320, y: 95, size: 8 },
    { id: 'i', x: 355, y: 175, size: 7 },
    { id: 'j', x: 340, y: 290, size: 9 },
    { id: 'k', x: 270, y: 340, size: 8 },
    { id: 'l', x: 160, y: 350, size: 7 },
    { id: 'm', x: 65, y: 310, size: 8 },
    { id: 'n', x: 45, y: 240, size: 6 },
    { id: 'o', x: 55, y: 130, size: 7 },
    { id: 'p', x: 95, y: 65, size: 8 },
    { id: 'q', x: 195, y: 55, size: 7 },
    { id: 'r', x: 280, y: 50, size: 6 },
    // Tiny outer nodes
    { id: 't1', x: 380, y: 130, size: 4 },
    { id: 't2', x: 375, y: 250, size: 5 },
    { id: 't3', x: 310, y: 370, size: 4 },
    { id: 't4', x: 85, y: 365, size: 5 },
    { id: 't5', x: 25, y: 175, size: 4 },
    { id: 't6', x: 35, y: 75, size: 5 },
    { id: 't7', x: 175, y: 25, size: 4 },
    { id: 't8', x: 350, y: 45, size: 5 },
  ];

  const connections = [
    // Core connections
    { from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'a', to: 'd' },
    { from: 'a', to: 'e' }, { from: 'a', to: 'f' }, { from: 'a', to: 'g' },
    { from: 'b', to: 'c' }, { from: 'b', to: 'f' }, { from: 'b', to: 'g' },
    { from: 'c', to: 'd' }, { from: 'd', to: 'e' }, { from: 'e', to: 'f' },
    { from: 'f', to: 'g' },
    // Branches out
    { from: 'b', to: 'h' }, { from: 'g', to: 'i' }, { from: 'g', to: 'j' },
    { from: 'f', to: 'k' }, { from: 'e', to: 'l' }, { from: 'e', to: 'm' },
    { from: 'd', to: 'n' }, { from: 'd', to: 'o' }, { from: 'c', to: 'p' },
    { from: 'c', to: 'q' }, { from: 'b', to: 'r' },
    // Cross connections
    { from: 'h', to: 'r' }, { from: 'i', to: 'j' }, { from: 'j', to: 'k' },
    { from: 'k', to: 'l' }, { from: 'l', to: 'm' }, { from: 'm', to: 'n' },
    { from: 'n', to: 'o' }, { from: 'o', to: 'p' }, { from: 'p', to: 'q' },
    { from: 'q', to: 'r' },
    // Tiny node connections
    { from: 'h', to: 't1' }, { from: 'i', to: 't1' }, { from: 'i', to: 't2' },
    { from: 'j', to: 't2' }, { from: 'j', to: 't3' }, { from: 'k', to: 't3' },
    { from: 'l', to: 't4' }, { from: 'm', to: 't4' }, { from: 'n', to: 't5' },
    { from: 'o', to: 't5' }, { from: 'o', to: 't6' }, { from: 'p', to: 't6' },
    { from: 'q', to: 't7' }, { from: 'r', to: 't7' }, { from: 'r', to: 't8' },
    { from: 'h', to: 't8' },
  ];

  const getNode = (id: string) => nodes.find(n => n.id === id)!;

  return (
    <div className="network-display">
      <svg className="network-svg" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
          </linearGradient>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {connections.map((conn, i) => {
          const from = getNode(conn.from);
          const to = getNode(conn.to);
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="url(#lineGrad)"
              strokeWidth="1"
              className="network-line"
              style={{ animationDelay: `${i * 0.03}s` }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size}
              className={`network-node ${node.primary ? 'primary' : ''}`}
              filter={node.size >= 8 ? 'url(#nodeGlow)' : undefined}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size * 0.35}
              className="node-core"
            />
          </g>
        ))}
      </svg>
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
        breadcrumbs={[
          { name: 'Alatyr Hosting', url: '/' },
          { name: 'Hosting', url: '/hosting' }
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          'name': 'Alatyr Hosting Plans',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'item': {
                '@type': 'Product',
                'name': 'Basic Webhosting',
                'description': 'Ideální pro malé osobní weby a začátečníky. 5 GB prostoru, SSL zdarma.',
                'brand': { '@type': 'Brand', 'name': 'Alatyr Hosting' },
                'offers': {
                  '@type': 'Offer',
                  'price': '25',
                  'priceCurrency': 'CZK',
                  'priceValidUntil': '2026-12-31',
                  'availability': 'https://schema.org/InStock',
                  'url': 'https://alatyrhosting.eu/hosting'
                }
              }
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'item': {
                '@type': 'Product',
                'name': 'Standard Webhosting',
                'description': 'Pro malé podnikatele a rozšiřující se weby. 10 GB prostoru, SSL zdarma.',
                'brand': { '@type': 'Brand', 'name': 'Alatyr Hosting' },
                'offers': {
                  '@type': 'Offer',
                  'price': '40',
                  'priceCurrency': 'CZK',
                  'priceValidUntil': '2026-12-31',
                  'availability': 'https://schema.org/InStock',
                  'url': 'https://alatyrhosting.eu/hosting'
                }
              }
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'item': {
                '@type': 'Product',
                'name': 'Pro Webhosting',
                'description': 'Pro středně velké projekty s vyšší návštěvností. 15 GB prostoru, SSL zdarma.',
                'brand': { '@type': 'Brand', 'name': 'Alatyr Hosting' },
                'offers': {
                  '@type': 'Offer',
                  'price': '80',
                  'priceCurrency': 'CZK',
                  'priceValidUntil': '2026-12-31',
                  'availability': 'https://schema.org/InStock',
                  'url': 'https://alatyrhosting.eu/hosting'
                }
              }
            },
            {
              '@type': 'ListItem',
              'position': 4,
              'item': {
                '@type': 'Product',
                'name': 'Ultimate Webhosting',
                'description': 'Pro velké weby s maximálním výkonem a funkcemi. 25 GB prostoru, SSL zdarma.',
                'brand': { '@type': 'Brand', 'name': 'Alatyr Hosting' },
                'offers': {
                  '@type': 'Offer',
                  'price': '200',
                  'priceCurrency': 'CZK',
                  'priceValidUntil': '2026-12-31',
                  'availability': 'https://schema.org/InStock',
                  'url': 'https://alatyrhosting.eu/hosting'
                }
              }
            }
          ]
        }}
      />

      {/* Hero Header */}
      <section className="hosting-hero">
        {/* Animated Background */}
        <div className="hero-bg">
          <div className="hero-grid"></div>
        </div>

        <div className="container">
          <div className="hero-layout">
            <motion.div
              className="hero-content"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {t('hosting.title')}{' '}
                <span className="gradient-text">{t('hosting.titleHighlight')}</span>
              </motion.h1>
              <motion.p
                className="hero-lead"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {t('hosting.description')}
              </motion.p>
              <motion.div
                className="hero-features"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="hero-feature">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>NVMe SSD Storage</span>
                </div>
                <div className="hero-feature">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>99.9% Uptime</span>
                </div>
                <div className="hero-feature">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>24/7 Support</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <NetworkDisplay />
            </motion.div>
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
        <div className="cta-noise"></div>
        <div className="container">
          <div className="cta-layout">
            <motion.div
              className="cta-terminal"
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
            >
              <div className="terminal-bar">
                <div className="terminal-dots">
                  <span></span><span></span><span></span>
                </div>
                <span className="terminal-title">alatyr-deploy</span>
              </div>
              <div className="terminal-body">
                <motion.div className="terminal-line" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.3 }} viewport={{ once: true }}>
                  <span className="t-prompt">$</span>
                  <span className="t-cmd">alatyr deploy --production</span>
                </motion.div>
                <motion.div className="terminal-line t-output" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.6 }} viewport={{ once: true }}>
                  <span className="t-check">&#10003;</span>
                  <span>SSL certificate provisioned</span>
                </motion.div>
                <motion.div className="terminal-line t-output" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.8 }} viewport={{ once: true }}>
                  <span className="t-check">&#10003;</span>
                  <span>NVMe storage allocated</span>
                </motion.div>
                <motion.div className="terminal-line t-output" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.0 }} viewport={{ once: true }}>
                  <span className="t-check">&#10003;</span>
                  <span>DDoS protection active</span>
                </motion.div>
                <motion.div className="terminal-line t-success" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.3 }} viewport={{ once: true }}>
                  <span className="t-arrow">&rarr;</span>
                  <span>Live at <strong>yoursite.cz</strong></span>
                </motion.div>
                <motion.div className="terminal-line" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.6 }} viewport={{ once: true }}>
                  <span className="t-prompt">$</span>
                  <span className="t-cursor"></span>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              className="cta-text"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
            >
              <h2>{t('hosting.cta.title')}</h2>
              <p>{t('hosting.cta.subtitle')}</p>
              <div className="cta-buttons">
                <button className="btn-cta-primary" onClick={() => navigate('/configurator')}>
                  <span>{t('hosting.cta.getStarted')}</span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>
                <button className="btn-cta-secondary" onClick={() => navigate('/support')}>
                  <span>{t('hosting.cta.talkToSales')}</span>
                </button>
              </div>
              <div className="cta-guarantees">
                <span><FontAwesomeIcon icon={faCheck} /> {t('hosting.cta.guarantee1')}</span>
                <span><FontAwesomeIcon icon={faCheck} /> {t('hosting.cta.guarantee2')}</span>
                <span><FontAwesomeIcon icon={faCheck} /> {t('hosting.cta.guarantee3')}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Hosting;
