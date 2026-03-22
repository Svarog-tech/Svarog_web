import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeadset,
  faTicket,
  faEnvelope,
  faChevronDown,
  faTerminal,
  faSearch,
  faBook,
  faComments,
  faPhone,
  faCheck,
  faBolt,
  faShieldHalved
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import PageMeta from '../components/PageMeta';
import './Support.css';

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

// Status Board Component - Hero element
const StatusBoard: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const agents = useAnimatedValue(12);
  const response = useAnimatedValue(2);
  const resolved = useAnimatedValue(47);

  return (
    <motion.div
      className="status-board"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <div className="status-board-header">
        <div className="window-dots">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
        </div>
        <span className="status-board-title">{t('support.statusBoard.title')}</span>
      </div>
      <div className="status-board-content">
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span className="status-text">{t('support.statusBoard.online')}</span>
        </div>
        <div className="status-metrics">
          <div className="metric-item" ref={agents.ref}>
            <span className="metric-value">{agents.value}</span>
            <span className="metric-label">{t('support.statusBoard.agents')}</span>
          </div>
          <div className="metric-item" ref={response.ref}>
            <span className="metric-value">{response.value}min</span>
            <span className="metric-label">{t('support.statusBoard.avgResponse')}</span>
          </div>
          <div className="metric-item" ref={resolved.ref}>
            <span className="metric-value">{resolved.value}</span>
            <span className="metric-label">{t('support.statusBoard.resolved')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Channel Console Component - Unique hexagonal design
const ChannelConsole: React.FC<{ t: (key: string) => string; navigate: (path: string) => void }> = ({ t, navigate }) => {
  const [hoveredChannel, setHoveredChannel] = useState<number | null>(null);

  const channels = [
    {
      icon: faTicket,
      title: 'support.radar.ticket.title',
      response: 'support.radar.ticket.response',
      action: 'support.radar.ticket.action',
      status: 'online',
      color: '#10b981',
      onClick: () => navigate('/tickets')
    },
    {
      icon: faHeadset,
      title: 'support.radar.chat.title',
      response: 'support.radar.chat.response',
      action: 'support.radar.chat.action',
      status: 'online',
      color: '#3b82f6',
      onClick: () => {}
    },
    {
      icon: faEnvelope,
      title: 'support.radar.email.title',
      response: 'support.radar.email.response',
      action: 'support.radar.email.action',
      status: 'online',
      color: '#06b6d4',
      onClick: () => window.location.href = 'mailto:support@svarog.tech'
    }
  ];

  return (
    <div className="channel-console">
      {/* Decorative scan line */}
      <div className="console-scanline"></div>

      {/* Channel hexagons */}
      <div className="channel-grid">
        {channels.map((channel, index) => (
          <motion.div
            key={index}
            className={`channel-hex ${hoveredChannel === index ? 'active' : ''}`}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            viewport={{ once: true }}
            onMouseEnter={() => setHoveredChannel(index)}
            onMouseLeave={() => setHoveredChannel(null)}
            onClick={channel.onClick}
            style={{ '--channel-color': channel.color } as React.CSSProperties}
          >
            {/* Hex background layers */}
            <div className="hex-glow"></div>
            <div className="hex-border"></div>
            <div className="hex-inner">
              {/* Status beacon */}
              <div className="channel-beacon">
                <span className="beacon-dot"></span>
                <span className="beacon-ring"></span>
              </div>

              {/* Icon */}
              <div className="channel-icon-wrap">
                <FontAwesomeIcon icon={channel.icon} />
              </div>

              {/* Info */}
              <h3 className="channel-name">{t(channel.title)}</h3>
              <span className="channel-time">{t(channel.response)}</span>

              {/* Action indicator */}
              <div className="channel-action">
                <span className="action-pulse"></span>
                <span className="action-text">{t(channel.action)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom accent bar */}
      <div className="console-accent">
        <div className="accent-segment"></div>
        <div className="accent-segment"></div>
        <div className="accent-segment"></div>
      </div>
    </div>
  );
};

// Response Gauge Component
const ResponseGauge: React.FC<{ value: number; label: string; suffix: string; color: string }> = ({
  value, label, suffix, color
}) => {
  const circumference = 2 * Math.PI * 40;
  const displayValue = suffix === 'min' ? value : value;
  const percentage = suffix === 'min' ? Math.min(value / 10 * 100, 100) : Math.min(value / 5 * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="gauge">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        <circle
          cx="50"
          cy="50"
          r="40"
          className="gauge-bg"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="40"
          className="gauge-fill"
          stroke={color}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          viewport={{ once: true }}
        />
      </svg>
      <div className="gauge-content">
        <span className="gauge-value">{displayValue}{suffix}</span>
        <span className="gauge-label">{label}</span>
      </div>
    </div>
  );
};

// Animated Activity Graph
const ActivityGraph: React.FC = () => {
  return (
    <svg viewBox="0 0 400 80" className="graph-svg">
      <defs>
        <linearGradient id="supportGraphGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary-color)" />
          <stop offset="100%" stopColor="var(--accent-color)" />
        </linearGradient>
        <linearGradient id="supportGraphFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,60 Q40,40 80,50 T160,35 T240,45 T320,30 T400,40"
        fill="none"
        stroke="url(#supportGraphGradient)"
        strokeWidth="2.5"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        viewport={{ once: true }}
      />
      <motion.path
        d="M0,60 Q40,40 80,50 T160,35 T240,45 T320,30 T400,40 L400,80 L0,80 Z"
        fill="url(#supportGraphFill)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        viewport={{ once: true }}
      />
    </svg>
  );
};

// Operations Dashboard Component
const OperationsDashboard: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  return (
    <motion.div
      className="dashboard-window"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="dashboard-header">
        <div className="window-dots">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
        </div>
        <span className="dashboard-title">{t('support.dashboard.windowTitle')}</span>
      </div>
      <div className="dashboard-content">
        <div className="response-gauges">
          <ResponseGauge value={2} label={t('support.dashboard.chat')} suffix="min" color="var(--success-color)" />
          <ResponseGauge value={2} label={t('support.dashboard.ticket')} suffix="h" color="var(--primary-color)" />
          <ResponseGauge value={4} label={t('support.dashboard.email')} suffix="h" color="var(--accent-color)" />
        </div>

        <div className="activity-graph">
          <div className="graph-header">
            <span className="graph-title">{t('support.dashboard.activity')}</span>
            <span className="graph-period">{t('support.dashboard.period')}</span>
          </div>
          <ActivityGraph />
        </div>

        <div className="status-leds">
          <div className="led-item">
            <span className="led green pulse"></span>
            <span className="led-label">{t('support.dashboard.servers')}</span>
          </div>
          <div className="led-item">
            <span className="led green"></span>
            <span className="led-label">{t('support.dashboard.api')}</span>
          </div>
          <div className="led-item">
            <span className="led blue"></span>
            <span className="led-label">{t('support.dashboard.queue')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Knowledge Path Component
const KnowledgePath: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const steps = [
    { icon: faSearch, title: 'support.path.step1.title', desc: 'support.path.step1.desc' },
    { icon: faBook, title: 'support.path.step2.title', desc: 'support.path.step2.desc' },
    { icon: faComments, title: 'support.path.step3.title', desc: 'support.path.step3.desc' },
    { icon: faHeadset, title: 'support.path.step4.title', desc: 'support.path.step4.desc' }
  ];

  return (
    <div className="knowledge-path">
      <div className="path-line">
        <motion.div
          className="path-line-fill"
          initial={{ width: 0 }}
          whileInView={{ width: '100%' }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          viewport={{ once: true }}
        />
      </div>
      <div className="path-steps">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            className="path-step"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            viewport={{ once: true }}
          >
            <div className="step-marker-wrapper">
              <div className="step-ring"></div>
              <div className="step-marker">
                <FontAwesomeIcon icon={step.icon} />
              </div>
              <span className="step-number">{index + 1}</span>
            </div>
            <div className="step-content">
              <h4>{t(step.title)}</h4>
              <p>{t(step.desc)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// FAQ Terminal Component
const FAQTerminal: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqItems = [
    // Hosting
    { question: 'support.faq.q1.question', answer: 'support.faq.q1.answer' },
    { question: 'support.faq.q2.question', answer: 'support.faq.q2.answer' },
    { question: 'support.faq.q3.question', answer: 'support.faq.q3.answer' },
    { question: 'support.faq.q4.question', answer: 'support.faq.q4.answer' },
    { question: 'support.faq.q5.question', answer: 'support.faq.q5.answer' },
    { question: 'support.faq.q6.question', answer: 'support.faq.q6.answer' },
    { question: 'support.faq.q7.question', answer: 'support.faq.q7.answer' },
    { question: 'support.faq.q8.question', answer: 'support.faq.q8.answer' },
    { question: 'support.faq.q9.question', answer: 'support.faq.q9.answer' },
    { question: 'support.faq.q10.question', answer: 'support.faq.q10.answer' },
    // E-mail
    { question: 'support.faq.q11.question', answer: 'support.faq.q11.answer' },
    { question: 'support.faq.q12.question', answer: 'support.faq.q12.answer' },
    { question: 'support.faq.q13.question', answer: 'support.faq.q13.answer' },
    // DNS & Domeny
    { question: 'support.faq.q14.question', answer: 'support.faq.q14.answer' },
    { question: 'support.faq.q15.question', answer: 'support.faq.q15.answer' },
    { question: 'support.faq.q16.question', answer: 'support.faq.q16.answer' },
    // Platby & Fakturace
    { question: 'support.faq.q17.question', answer: 'support.faq.q17.answer' },
    { question: 'support.faq.q18.question', answer: 'support.faq.q18.answer' },
    { question: 'support.faq.q19.question', answer: 'support.faq.q19.answer' },
    { question: 'support.faq.q20.question', answer: 'support.faq.q20.answer' },
    // Bezpecnost
    { question: 'support.faq.q21.question', answer: 'support.faq.q21.answer' },
    { question: 'support.faq.q22.question', answer: 'support.faq.q22.answer' },
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <motion.div
      className="faq-terminal"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="terminal-header">
        <div className="window-dots">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
        </div>
        <span className="terminal-title">
          <FontAwesomeIcon icon={faTerminal} />
          <span>{t('support.faq.terminalTitle')}</span>
        </span>
      </div>
      <div className="terminal-body">
        <div className="terminal-prompt">
          <span className="prompt-symbol">$</span>
          <span className="prompt-text">{t('support.faq.prompt')}</span>
          <span className="cursor-blink"></span>
        </div>

        <div className="faq-list-terminal">
          {faqItems.map((item, index) => (
            <div key={index} className="faq-item-terminal">
              <button
                className={`faq-question-terminal ${expandedFaq === index ? 'active' : ''}`}
                onClick={() => toggleFaq(index)}
                aria-expanded={expandedFaq === index}
              >
                <span className="faq-cmd-symbol">&gt;</span>
                <span className="faq-question-text-terminal">{t(item.question)}</span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`faq-chevron ${expandedFaq === index ? 'rotated' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {expandedFaq === index && (
                  <motion.div
                    className="faq-answer-terminal"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="faq-answer-content">
                      <span className="faq-output-prefix">// output:</span>
                      <p className="faq-answer-text-terminal">{t(item.answer)}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Main Support Page Component
const Support: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      <PageMeta
        title={`${t('support.meta.title')} | Alatyr Hosting`}
        description={t('support.meta.description')}
        path="/support"
        breadcrumbs={[
          { name: 'Alatyr Hosting', url: '/' },
          { name: t('support.meta.title'), url: '/support' }
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          'mainEntity': [
            {
              '@type': 'Question',
              'name': 'Jak rychle je můj hosting aktivován?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Hosting je automaticky aktivován během několika minut po dokončení platby.' }
            },
            {
              '@type': 'Question',
              'name': 'Mohu migrovat svůj existující web?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Ano, poskytujeme bezplatnou migraci vašeho webu z jiného poskytovatele.' }
            },
            {
              '@type': 'Question',
              'name': 'Jaká je uptime záruka?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Garantujeme 99.9% uptime. V případě neplnění vám vrátíme poměrnou část platby.' }
            },
            {
              '@type': 'Question',
              'name': 'Mohu upgradovat svůj plán později?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Ano, můžete kdykoliv upgradovat na vyšší plán bez výpadku služeb.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak nastavím vlastní doménu?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Vlastní doménu nastavíte v sekci Domény v administračním panelu. Stačí přidat doménu a nasměrovat DNS záznamy na naše servery.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak získám SSL certifikát?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'SSL certifikát Let\'s Encrypt je automaticky vydán a obnoven pro všechny domény na našem hostingu zdarma.' }
            },
            {
              '@type': 'Question',
              'name': 'Jaké PHP verze podporujete?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Podporujeme PHP verze 7.4, 8.0, 8.1, 8.2 a 8.3. Verzi můžete přepínat v administračním panelu.' }
            },
            {
              '@type': 'Question',
              'name': 'Podporujete Node.js?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Ano, podporujeme Node.js aplikace. Můžete je nasadit přes administrační panel nebo přes SSH přístup.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak se připojím přes FTP?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'FTP přístupové údaje naleznete v detailu vaší služby v panelu. Doporučujeme používat SFTP pro bezpečnější přenos souborů.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak vytvořím databázi?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Databázi vytvoříte v sekci Databáze v administračním panelu. Podporujeme MySQL/MariaDB a PostgreSQL.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak vytvořím e-mailový účet?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'E-mailový účet vytvoříte v sekci E-maily v administračním panelu. Zadejte požadovanou adresu a heslo.' }
            },
            {
              '@type': 'Question',
              'name': 'Jaká je maximální velikost přílohy?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Maximální velikost přílohy e-mailu je 25 MB. Pro větší soubory doporučujeme použít sdílení přes odkaz.' }
            },
            {
              '@type': 'Question',
              'name': 'Mohu přistupovat k e-mailu přes IMAP/POP3?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Ano, podporujeme IMAP i POP3 protokol. Nastavení naleznete v detailu e-mailového účtu v administračním panelu.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak nastavím DNS záznamy?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'DNS záznamy spravujete v sekci DNS v administračním panelu. Můžete přidávat A, AAAA, CNAME, MX, TXT a další záznamy.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak přenesu doménu k vám?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Pro přenos domény potřebujete autorizační kód (EPP) od současného registrátora. Přenos zadáte v sekci Domény.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak dlouho trvá registrace domény?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Registrace nové domény je obvykle dokončena do několika minut. Přenos existující domény může trvat 5-7 dní.' }
            },
            {
              '@type': 'Question',
              'name': 'Jaké platební metody přijímáte?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Přijímáme platby kartou (Visa, Mastercard), PayPal, GoPay a bankovním převodem.' }
            },
            {
              '@type': 'Question',
              'name': 'Mohu získat fakturu?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Ano, faktury jsou automaticky generovány po zaplacení. Naleznete je v sekci Fakturace ve formátu HTML i PDF.' }
            },
            {
              '@type': 'Question',
              'name': 'Co se stane po vypršení služby?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Po vypršení služby máte 7denní ochrannou lhůtu, během které můžete službu obnovit. Poté jsou data smazána.' }
            },
            {
              '@type': 'Question',
              'name': 'Nabízíte vrácení peněz?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Ano, nabízíme 30denní garanci vrácení peněz. Pokud nejste spokojeni, kontaktujte naši podporu.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak je můj hosting zabezpečen?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Používáme firewall, DDoS ochranu, automatické bezpečnostní aktualizace a izolaci účtů pro maximální bezpečnost.' }
            },
            {
              '@type': 'Question',
              'name': 'Jak fungují zálohy?',
              'acceptedAnswer': { '@type': 'Answer', 'text': 'Automatické zálohy probíhají denně a uchováváme je po dobu 7 dní. Zálohu můžete obnovit z administračního panelu.' }
            }
          ]
        }}
      />
      <main className="support-page">
        {/* Hero Section - Command Center Entry */}
        <section className="support-hero">
          <div className="hero-bg">
            <div className="hero-grid"></div>
            <div className="radar-sweep"></div>
            <div className="hero-orb hero-orb-1"></div>
            <div className="hero-orb hero-orb-2"></div>
            <div className="hero-particles">
              {[...Array(15)].map((_, i) => (
                <span
                  key={i}
                  className="particle"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${4 + Math.random() * 3}s`
                  }}
                />
              ))}
            </div>
          </div>

          <div className="container">
            <div className="hero-content">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {t('support.title')}
                <span className="gradient-text">{t('support.titleHighlight')}</span>
              </motion.h1>
              <motion.p
                className="hero-description"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {t('support.description')}
              </motion.p>

              <StatusBoard t={t} />

              <motion.div
                className="terminal-search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <div className="terminal-search-wrapper">
                  <span className="terminal-prefix">$</span>
                  <input
                    type="text"
                    className="terminal-search-input"
                    placeholder={t('support.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Support Radar Section */}
        <section className="support-radar-section">
          <div className="container">
            <motion.div
              className="section-header"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="section-eyebrow">{t('support.radar.eyebrow')}</span>
              <h2 className="section-title">
                {t('support.radar.title')}
                <span className="gradient-text">{t('support.radar.titleHighlight')}</span>
              </h2>
              <p className="section-description">{t('support.radar.description')}</p>
            </motion.div>

            <ChannelConsole t={t} navigate={navigate} />
          </div>
        </section>

        {/* Operations Dashboard Section */}
        <section className="dashboard-section">
          <div className="container">
            <div className="dashboard-layout">
              <motion.div
                className="dashboard-intro"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <span className="section-eyebrow">{t('support.dashboard.eyebrow')}</span>
                <h2 className="section-title">
                  {t('support.dashboard.title')}
                  <span className="gradient-text">{t('support.dashboard.titleHighlight')}</span>
                </h2>
                <p className="section-description">{t('support.dashboard.description')}</p>
              </motion.div>

              <OperationsDashboard t={t} />
            </div>
          </div>
        </section>

        {/* Knowledge Path Section */}
        <section className="knowledge-section">
          <div className="container">
            <motion.div
              className="section-header"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="section-eyebrow">{t('support.path.eyebrow')}</span>
              <h2 className="section-title">
                {t('support.path.title')}
                <span className="gradient-text">{t('support.path.titleHighlight')}</span>
              </h2>
            </motion.div>

            <KnowledgePath t={t} />
          </div>
        </section>

        {/* FAQ Terminal Section */}
        <section className="faq-section">
          <div className="container">
            <motion.div
              className="section-header"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="section-eyebrow">{t('support.faq.eyebrow')}</span>
              <h2 className="section-title">
                {t('support.faq.title')}
                <span className="gradient-text">{t('support.faq.titleHighlight')}</span>
              </h2>
            </motion.div>

            <FAQTerminal t={t} />
          </div>
        </section>

        {/* Emergency CTA Section */}
        <section className="emergency-section">
          <div className="container">
            <motion.div
              className="emergency-card"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="emergency-rings">
                <div className="e-ring e-ring-1"></div>
                <div className="e-ring e-ring-2"></div>
                <div className="e-ring e-ring-3"></div>
              </div>

              <div className="emergency-icon">
                <FontAwesomeIcon icon={faPhone} />
              </div>

              <h2 className="emergency-title">{t('support.emergency.title')}</h2>
              <p className="emergency-subtitle">{t('support.emergency.subtitle')}</p>

              <div className="emergency-buttons">
                <button
                  className="emergency-btn-primary"
                  onClick={() => navigate('/tickets')}
                >
                  <FontAwesomeIcon icon={faBolt} />
                  <span>{t('support.emergency.cta')}</span>
                </button>
                <button
                  className="emergency-btn-secondary"
                  onClick={() => window.location.href = 'mailto:urgent@svarog.tech'}
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>{t('support.emergency.ctaSecondary')}</span>
                </button>
              </div>

              <div className="emergency-guarantees">
                <span><FontAwesomeIcon icon={faCheck} /> {t('support.emergency.guarantee1')}</span>
                <span><FontAwesomeIcon icon={faCheck} /> {t('support.emergency.guarantee2')}</span>
                <span><FontAwesomeIcon icon={faShieldHalved} /> {t('support.emergency.guarantee3')}</span>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Support;
