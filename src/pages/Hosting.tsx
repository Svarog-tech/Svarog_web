import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faHdd,
  faShieldHalved,
  faGlobe,
  faClock,
  faDatabase,
  faEnvelope,
  faCode,
  faChartLine,
  faLock,
  faRocket,
  faCheck,
  faArrowRight,
  faChevronDown,
  faTerminal,
  faMicrochip,
  faMemory,
  faNetworkWired,
  faCloudArrowUp,
  faHeadset
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import HostingPlansNew from '../components/HostingPlansNew';
import PageMeta from '../components/PageMeta';
import './Hosting.css';

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

// Feature data
const features = [
  { icon: faHdd, title: 'NVMe SSD Storage', description: 'Ultra-fast NVMe drives for maximum performance' },
  { icon: faShieldHalved, title: 'Free SSL Certificate', description: 'Automatic SSL/TLS encryption for all domains' },
  { icon: faDatabase, title: 'MySQL/MariaDB', description: 'Reliable database management included' },
  { icon: faEnvelope, title: 'Email Hosting', description: 'Professional email with your domain' },
  { icon: faCode, title: 'PHP 8.x Support', description: 'Latest PHP versions with full control' },
  { icon: faCloudArrowUp, title: 'Daily Backups', description: 'Automated backups for peace of mind' },
  { icon: faNetworkWired, title: 'Unlimited Bandwidth', description: 'No traffic limits on your hosting' },
  { icon: faHeadset, title: '24/7 Support', description: 'Expert assistance whenever you need' }
];

// Server specs for infographic
const serverSpecs = [
  { label: 'CPU Performance', value: 95, color: 'var(--primary-color)' },
  { label: 'Memory Speed', value: 90, color: 'var(--accent-color)' },
  { label: 'Storage I/O', value: 98, color: 'var(--success-color)' },
  { label: 'Network Speed', value: 92, color: 'var(--warning-color)' }
];

// How it works steps
const steps = [
  { number: '01', title: 'Choose Your Plan', description: 'Select the hosting plan that fits your needs' },
  { number: '02', title: 'Quick Setup', description: 'Your server is ready in under 5 minutes' },
  { number: '03', title: 'Full Control', description: 'Access HestiaCP panel and manage everything' }
];

// Technology stack
const technologies = [
  { name: 'HestiaCP', description: 'Control Panel' },
  { name: 'LiteSpeed', description: 'Web Server' },
  { name: 'PHP 8.x', description: 'Server-side' },
  { name: 'MariaDB', description: 'Database' },
  { name: 'Node.js', description: 'Runtime' },
  { name: 'Python', description: 'Scripting' }
];

// FAQ data
const faqs = [
  {
    question: 'What control panel do you use?',
    answer: 'We use HestiaCP, a modern and user-friendly control panel that gives you full control over your hosting environment including websites, databases, email accounts, and DNS settings.'
  },
  {
    question: 'Do I get root/sudo access?',
    answer: 'Yes! All our VPS plans include full root access via SSH. You have complete control to install any software, configure services, and manage your server as you need.'
  },
  {
    question: 'How fast is the setup?',
    answer: 'Your hosting account is typically ready within 5 minutes of payment confirmation. You\'ll receive login credentials via email immediately.'
  },
  {
    question: 'What about backups?',
    answer: 'We perform automated daily backups of your data. You can also create manual backups anytime through the HestiaCP panel.'
  },
  {
    question: 'Can I upgrade my plan later?',
    answer: 'Absolutely! You can upgrade your hosting plan at any time. The upgrade is seamless with no downtime, and you only pay the difference.'
  }
];

// Progress Bar Component
const ProgressBar: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <div className="progress-item">
    <div className="progress-header">
      <span className="progress-label">{label}</span>
      <span className="progress-value">{value}%</span>
    </div>
    <div className="progress-track">
      <motion.div
        className="progress-fill"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        whileInView={{ width: `${value}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        viewport={{ once: true }}
      />
    </div>
  </div>
);

// FAQ Item Component
const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`faq-item ${isOpen ? 'open' : ''}`}>
      <button className="faq-question" onClick={() => setIsOpen(!isOpen)}>
        <span>{question}</span>
        <FontAwesomeIcon icon={faChevronDown} className="faq-icon" />
      </button>
      <div className="faq-answer">
        <p>{answer}</p>
      </div>
    </div>
  );
};

const Hosting: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <main className="hosting-info-page">
      <PageMeta
        title={`${t('hosting.title')}${t('hosting.titleHighlight')} – Alatyr Hosting`}
        description="Professional VPS hosting with full root access, NVMe storage, and 24/7 support. Fast, secure, and reliable hosting solutions."
        path="/hosting"
      />

      {/* Page Header */}
      <section className="hosting-header">
        <div className="container">
          <motion.div
            className="header-content"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.span className="header-eyebrow" variants={fadeIn}>
              Web Hosting
            </motion.span>
            <motion.h1 className="header-title" variants={fadeIn}>
              {t('hosting.title')}{' '}
              <span className="text-gradient">{t('hosting.titleHighlight')}</span>
            </motion.h1>
            <motion.p className="header-description" variants={fadeIn}>
              {t('hosting.description')}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">What's Included</h2>
            <p className="section-subtitle">Everything you need for professional web hosting</p>
          </div>

          <motion.div
            className="features-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
          >
            {features.map((feature, index) => (
              <motion.div key={index} className="feature-card" variants={fadeIn}>
                <div className="feature-icon">
                  <FontAwesomeIcon icon={feature.icon} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Performance Infographic */}
      <section className="performance-section">
        <div className="container">
          <div className="performance-layout">
            <div className="performance-info">
              <span className="section-eyebrow">Server Performance</span>
              <h2 className="section-title">Enterprise-Grade Infrastructure</h2>
              <p className="section-description">
                Our servers are optimized for maximum performance with the latest hardware
                and software configurations.
              </p>

              <div className="performance-metrics">
                {serverSpecs.map((spec, index) => (
                  <ProgressBar key={index} {...spec} />
                ))}
              </div>
            </div>

            <div className="performance-visual">
              <div className="server-card">
                <div className="server-header">
                  <FontAwesomeIcon icon={faServer} />
                  <span>Server Specifications</span>
                </div>
                <div className="server-specs">
                  <div className="spec-row">
                    <FontAwesomeIcon icon={faMicrochip} />
                    <span className="spec-label">CPU</span>
                    <span className="spec-value">AMD EPYC / Intel Xeon</span>
                  </div>
                  <div className="spec-row">
                    <FontAwesomeIcon icon={faMemory} />
                    <span className="spec-label">RAM</span>
                    <span className="spec-value">DDR4 ECC Memory</span>
                  </div>
                  <div className="spec-row">
                    <FontAwesomeIcon icon={faHdd} />
                    <span className="spec-label">Storage</span>
                    <span className="spec-value">NVMe SSD RAID-10</span>
                  </div>
                  <div className="spec-row">
                    <FontAwesomeIcon icon={faNetworkWired} />
                    <span className="spec-label">Network</span>
                    <span className="spec-value">10 Gbps Uplink</span>
                  </div>
                </div>
                <div className="server-uptime">
                  <div className="uptime-badge">
                    <span className="uptime-value">99.9%</span>
                    <span className="uptime-label">Uptime SLA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="steps-section">
        <div className="container">
          <div className="section-header centered">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Get started in three simple steps</p>
          </div>

          <div className="steps-grid">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                className="step-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <div className="step-number">{step.number}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
                {index < steps.length - 1 && <div className="step-connector" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="tech-section">
        <div className="container">
          <div className="section-header centered">
            <h2 className="section-title">Technology Stack</h2>
            <p className="section-subtitle">Powered by industry-leading technologies</p>
          </div>

          <div className="tech-grid">
            {technologies.map((tech, index) => (
              <motion.div
                key={index}
                className="tech-card"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <span className="tech-name">{tech.name}</span>
                <span className="tech-desc">{tech.description}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Hosting Plans */}
      <HostingPlansNew />

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="container">
          <div className="section-header centered">
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle">Everything you need to know about our hosting</p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, index) => (
              <FAQItem key={index} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="hosting-cta">
        <div className="container">
          <div className="cta-card">
            <div className="cta-content">
              <FontAwesomeIcon icon={faRocket} className="cta-icon" />
              <h2 className="cta-title">Ready to Get Started?</h2>
              <p className="cta-description">
                Join thousands of satisfied customers and experience professional hosting.
              </p>
              <div className="cta-features">
                <span><FontAwesomeIcon icon={faCheck} /> 30-day money back guarantee</span>
                <span><FontAwesomeIcon icon={faCheck} /> Free migration support</span>
                <span><FontAwesomeIcon icon={faCheck} /> Setup in under 5 minutes</span>
              </div>
            </div>
            <div className="cta-actions">
              <button className="primary-btn" onClick={() => navigate('/configurator')}>
                <span>
                  Choose Your Plan
                  <FontAwesomeIcon icon={faArrowRight} />
                </span>
              </button>
              <button className="secondary-btn" onClick={() => navigate('/support')}>
                <span>Contact Sales</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Hosting;
