import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowLeft, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Privacy.css';

interface Section {
  id: string;
  titleCs: string;
  titleEn: string;
  contentCs: string;
  contentEn: string;
}

const Privacy: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sections: Section[] = [
    {
      id: 'section-1',
      titleCs: '1. Správce údajů',
      titleEn: '1. Data controller',
      contentCs: 'Správcem vašich osobních údajů je Alatyr Hosting, Náves 73, 664 08 Blažovice, Česká republika, ID: 09992961, Non-VAT payer. Kontakt: info@alatyrhosting.eu.',
      contentEn: 'The controller of your personal data is Alatyr Hosting, Náves 73, 664 08 Blažovice, Czech Republic, ID: 09992961, Non-VAT payer. Contact: info@alatyrhosting.eu.'
    },
    {
      id: 'section-2',
      titleCs: '2. Jaké údaje zpracováváme',
      titleEn: '2. Data we process',
      contentCs: 'Zpracováváme zejména identifikační a kontaktní údaje (jméno, příjmení, e-mail, adresa), fakturační údaje (údaje o platbách, vyfakturovaných službách) a technické údaje o využívání našich služeb (např. logy přístupů do administrace).',
      contentEn: 'We process in particular identification and contact details (name, surname, e-mail, address), billing data (payments, invoiced services) and technical data related to the use of our services (such as access logs to the control panel).'
    },
    {
      id: 'section-3',
      titleCs: '3. Účely a právní základy zpracování',
      titleEn: '3. Purposes and legal bases',
      contentCs: 'Údaje zpracováváme především pro plnění smlouvy (poskytování hostingu a souvisejících služeb), plnění zákonných povinností (účetnictví, daňové předpisy) a pro oprávněný zájem (zabezpečení služeb, zlepšování funkcí, ochrana proti zneužití).',
      contentEn: 'We process your data mainly for the performance of a contract (provision of hosting and related services), for compliance with legal obligations (accounting and tax regulations) and for our legitimate interests (service security, service improvement, fraud prevention).'
    },
    {
      id: 'section-4',
      titleCs: '4. Doba uchování',
      titleEn: '4. Retention period',
      contentCs: 'Osobní údaje uchováváme po dobu trvání smluvního vztahu a po nezbytnou dobu poté, zejména z důvodu zákonných povinností (typicky 5–10 let u účetních dokladů) a ochrany našich právních nároků.',
      contentEn: 'Personal data is stored for the duration of the contractual relationship and for the period necessary afterwards, in particular due to statutory obligations (typically 5–10 years for accounting documents) and to protect our legal claims.'
    },
    {
      id: 'section-5',
      titleCs: '5. Cookies',
      titleEn: '5. Cookies',
      contentCs: 'Používáme technicky nezbytné cookies pro zajištění funkčnosti webu (přihlášení, jazykové preference). Další kategorie cookies jsou používány pouze na základě vašeho souhlasu, který lze kdykoliv změnit prostřednictvím cookie banneru.',
      contentEn: 'We use strictly necessary cookies to ensure the proper functioning of the website (login, language preferences). Other categories of cookies are used only based on your consent, which you can change at any time via the cookie banner.'
    },
    {
      id: 'section-6',
      titleCs: '6. Příjemci údajů',
      titleEn: '6. Data recipients',
      contentCs: 'Vaše údaje mohou být předávány pouze důvěryhodným zpracovatelům, kteří nám pomáhají s provozem služeb (např. poskytovatelé hostingové infrastruktury, platební brány, e-mailové služby) a kteří jsou smluvně vázáni k ochraně osobních údajů.',
      contentEn: 'Your data may be shared only with trusted processors helping us operate our services (for example infrastructure providers, payment gateways, e-mail service providers) who are contractually bound to protect personal data.'
    },
    {
      id: 'section-7',
      titleCs: '7. Vaše práva',
      titleEn: '7. Your rights',
      contentCs: 'Máte právo na přístup k osobním údajům, jejich opravu nebo výmaz, omezení zpracování, námitku proti zpracování a právo na přenositelnost údajů. Stížnost můžete podat u Úřadu pro ochranu osobních údajů.',
      contentEn: 'You have the right to access your personal data, request rectification or erasure, restriction of processing, object to processing and the right to data portability. You may lodge a complaint with the relevant data protection authority.'
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  return (
    <main className="privacy-page">
      <PageMeta
        title={isCs ? 'Zásady ochrany soukromí – Alatyr Hosting' : 'Privacy Policy – Alatyr Hosting'}
        description={
          isCs
            ? 'Zásady ochrany osobních údajů Alatyr Hosting. Jak zpracováváme vaše údaje, cookies a vaše práva podle GDPR.'
            : 'Privacy policy of Alatyr Hosting. How we process your personal data, use cookies and what rights you have under GDPR.'
        }
        path="/privacy"
      />

      {/* Hero Section */}
      <section className="privacy-hero">
        <div className="container">
          <motion.div
            className="privacy-hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="privacy-icon-wrapper">
              <FontAwesomeIcon icon={faShieldAlt} className="privacy-icon" />
            </div>

            <h1>
              {isCs ? 'Zásady ochrany ' : 'Privacy '}
              <span className="gradient-text">{isCs ? 'soukromí' : 'Policy'}</span>
            </h1>

            <p className="privacy-updated">
              {isCs ? 'Naposledy aktualizováno: únor 2026' : 'Last updated: February 2026'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="privacy-toc-section">
        <div className="container">
          <motion.div
            className="privacy-toc"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2>{isCs ? 'Obsah' : 'Contents'}</h2>
            <ul className="privacy-toc-list">
              {sections.map((section) => (
                <li key={section.id} className="privacy-toc-item">
                  <a
                    href={`#${section.id}`}
                    className="privacy-toc-link"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(section.id);
                    }}
                  >
                    {isCs ? section.titleCs : section.titleEn}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="privacy-content-section">
        <div className="container">
          <div className="privacy-content">
            {sections.map((section, index) => (
              <motion.section
                key={section.id}
                id={section.id}
                className="privacy-section"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <h2>{isCs ? section.titleCs : section.titleEn}</h2>
                <p>{isCs ? section.contentCs : section.contentEn}</p>
              </motion.section>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="privacy-footer">
        <div className="container">
          <Link to="/" className="back-link">
            <FontAwesomeIcon icon={faArrowLeft} />
            {isCs ? 'Zpět na úvodní stránku' : 'Back to homepage'}
          </Link>
        </div>
      </section>

      {/* Back to Top Button */}
      <button
        className={`privacy-back-to-top ${showBackToTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label={isCs ? 'Zpět nahoru' : 'Back to top'}
      >
        <FontAwesomeIcon icon={faArrowUp} />
      </button>
    </main>
  );
};

export default Privacy;
