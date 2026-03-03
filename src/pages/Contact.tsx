import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faPhone, faMapMarkerAlt, faTicket, faComments, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import PageMeta from '../components/PageMeta';
import './Contact.css';

const Contact: React.FC = () => {
  const contactMethods = [
    {
      icon: faEnvelope,
      title: 'E-mail',
      link: 'mailto:info@alatyrhosting.eu',
      linkText: 'info@alatyrhosting.eu',
      description: 'Obecné dotazy'
    },
    {
      icon: faTicket,
      title: 'Technická podpora',
      link: '/support',
      linkText: 'Podpora a tickety',
      description: 'Pro zákazníky 24/7',
      isInternal: true
    },
    {
      icon: faPhone,
      title: 'Telefon',
      link: 'tel:+420123456789',
      linkText: '+420 123 456 789',
      description: 'Po–Pá 9–17'
    },
    {
      icon: faMapMarkerAlt,
      title: 'Sídlo',
      linkText: 'Náves 73, 664 08 Blažovice',
      description: 'Česká republika'
    }
  ];

  return (
    <main className="contact-page">
      <PageMeta
        title="Kontakt – Alatyr Hosting"
        description="Kontaktujte Alatyr Hosting: e-mail, telefon, podpora. Jsme tu pro vás 24/7."
        path="/contact"
      />

      {/* Hero Section */}
      <motion.section
        className="contact-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <div className="contact-hero-content">
            <motion.h1
              className="contact-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Kontaktujte <span className="gradient-text">nás</span>
            </motion.h1>
            <motion.p
              className="contact-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Jsme tu pro vás. Napište nám nebo zavolejte.
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Contact Methods Section */}
      <section className="contact-methods-section">
        <div className="container">
          <motion.div
            className="contact-methods-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="contact-header-icon">
              <FontAwesomeIcon icon={faComments} />
            </div>
            <h2 className="contact-methods-title">Způsoby kontaktu</h2>
          </motion.div>

          <div className="contact-grid">
            {contactMethods.map((method, index) => (
              <motion.div
                key={index}
                className="contact-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="contact-card-icon">
                  <FontAwesomeIcon icon={method.icon} />
                </div>
                <h3 className="contact-card-title">{method.title}</h3>
                {method.link ? (
                  method.isInternal ? (
                    <Link to={method.link} className="contact-card-link">{method.linkText}</Link>
                  ) : (
                    <a href={method.link} className="contact-card-link">{method.linkText}</a>
                  )
                ) : (
                  <span className="contact-card-text">{method.linkText}</span>
                )}
                <p className="contact-card-description">{method.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="contact-back"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Link to="/" className="back-link">
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Zpět na úvodní stránku</span>
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
