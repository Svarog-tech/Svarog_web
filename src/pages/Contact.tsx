import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faPhone, faMapMarkerAlt, faTicket } from '@fortawesome/free-solid-svg-icons';
import PageMeta from '../components/PageMeta';
import './Contact.css';

const Contact: React.FC = () => {
  return (
    <main className="contact-page">
      <PageMeta
        title="Kontakt – Alatyr Hosting"
        description="Kontaktujte Alatyr Hosting: e-mail, telefon, podpora. Jsme tu pro vás 24/7."
        path="/contact"
      />
      <div className="container">
        <motion.article
          className="contact-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Kontakt</h1>
          <p className="contact-lead">Jsme tu pro vás. Napište nám nebo zavolejte.</p>

          <section className="contact-methods">
            <div className="contact-card">
              <FontAwesomeIcon icon={faEnvelope} className="contact-card-icon" />
              <h2>E-mail</h2>
              <a href="mailto:info@alatyrhosting.eu">info@alatyrhosting.eu</a>
              <p>Obecné dotazy</p>
            </div>
            <div className="contact-card">
              <FontAwesomeIcon icon={faTicket} className="contact-card-icon" />
              <h2>Technická podpora</h2>
              <Link to="/support">Podpora a tickety</Link>
              <p>Pro zákazníky 24/7</p>
            </div>
            <div className="contact-card">
              <FontAwesomeIcon icon={faPhone} className="contact-card-icon" />
              <h2>Telefon</h2>
              <a href="tel:+420123456789">+420 123 456 789</a>
              <p>Po–Pá 9–17</p>
            </div>
            <div className="contact-card">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="contact-card-icon" />
              <h2>Sídlo</h2>
              <span>Náves 73, 664 08 Blažovice, Česká republika</span>
            </div>
          </section>

          <p className="contact-back">
            <Link to="/">← Zpět na úvodní stránku</Link>
          </p>
        </motion.article>
      </div>
    </main>
  );
};

export default Contact;
