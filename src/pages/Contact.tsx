import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faPhone,
  faMapMarkerAlt,
  faClock,
  faCheck,
  faPaperPlane,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import {
  faFacebook as faFacebookBrand,
  faTwitter as faTwitterBrand,
  faLinkedin as faLinkedinBrand,
  faGithub as faGithubBrand
} from '@fortawesome/free-brands-svg-icons';
import PageMeta from '../components/PageMeta';
import './Contact.css';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const Contact: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Jméno je povinné';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail je povinný';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Neplatný e-mail';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Předmět je povinný';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Zpráva je povinná';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Zpráva musí mít alespoň 10 znaků';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const createConfetti = () => {
    const colors = ['var(--primary-color)', 'var(--accent-color)', 'var(--success-color)', 'var(--warning-color)'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 0.3}s`;
      confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
      document.body.appendChild(confetti);

      setTimeout(() => confetti.remove(), 4000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      createConfetti();

      // Reset form after success
      setTimeout(() => {
        setIsSuccess(false);
        setFormData({ name: '', email: '', subject: '', message: '' });
      }, 5000);
    }, 1500);
  };

  const contactInfo = [
    {
      icon: faEnvelope,
      title: 'E-mail',
      content: 'info@alatyrhosting.eu',
      link: 'mailto:info@alatyrhosting.eu'
    },
    {
      icon: faPhone,
      title: 'Telefon',
      content: '+420 123 456 789',
      link: 'tel:+420123456789'
    },
    {
      icon: faMapMarkerAlt,
      title: 'Adresa',
      content: 'Náves 73, 664 08 Blažovice, Česká republika'
    },
    {
      icon: faClock,
      title: 'Pracovní doba',
      content: 'Po–Pá: 9:00–17:00\nPodpora 24/7'
    }
  ];

  const socialLinks = [
    { icon: faFacebookBrand, url: 'https://facebook.com', label: 'Facebook' },
    { icon: faTwitterBrand, url: 'https://twitter.com', label: 'Twitter' },
    { icon: faLinkedinBrand, url: 'https://linkedin.com', label: 'LinkedIn' },
    { icon: faGithubBrand, url: 'https://github.com', label: 'GitHub' }
  ];

  // Animation variants for staggered children
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <main className="contact-page">
      <PageMeta
        title="Kontakt – Alatyr Hosting"
        description="Kontaktujte Alatyr Hosting: e-mail, telefon, podpora. Jsme tu pro vás 24/7."
        path="/contact"
      />

      {/* Hero Section */}
      <section className="contact-hero">
        {/* Animated Background */}
        <div className="hero-bg">
          <div className="hero-grid"></div>
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
          <div className="hero-glow"></div>
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
          <motion.div
            className="hero-content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1 variants={itemVariants}>
              Kontaktujte <span className="gradient-text">nás</span>
            </motion.h1>
            <motion.p className="hero-lead" variants={itemVariants}>
              Jsme tu pro vás. Napište nám nebo zavolejte.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact-section">
        <div className="container">
          <div className="contact-layout">
            {/* Contact Form */}
            <motion.div
              className="contact-form-wrapper"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="contact-form">
                {!isSuccess ? (
                  <>
                    <div className="form-header">
                      <h2>Napište nám zprávu</h2>
                      <p>Odpovíme vám co nejdříve</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                      <motion.div
                        className="form-group"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        viewport={{ once: true }}
                      >
                        <label className="form-label" htmlFor="name">Jméno</label>
                        <div className="input-wrapper">
                          <FontAwesomeIcon icon={faUser} className="input-icon" />
                          <input
                            type="text"
                            id="name"
                            name="name"
                            className={`form-input ${errors.name ? 'error' : formData.name ? 'success' : ''}`}
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Vaše jméno"
                          />
                        </div>
                        {errors.name && <span className="error-message">{errors.name}</span>}
                      </motion.div>

                      <motion.div
                        className="form-group"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        viewport={{ once: true }}
                      >
                        <label className="form-label" htmlFor="email">E-mail</label>
                        <div className="input-wrapper">
                          <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                          <input
                            type="email"
                            id="email"
                            name="email"
                            className={`form-input ${errors.email ? 'error' : formData.email && validateEmail(formData.email) ? 'success' : ''}`}
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="vas@email.cz"
                          />
                        </div>
                        {errors.email && <span className="error-message">{errors.email}</span>}
                      </motion.div>

                      <motion.div
                        className="form-group"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        viewport={{ once: true }}
                      >
                        <label className="form-label" htmlFor="subject">Předmět</label>
                        <div className="input-wrapper">
                          <FontAwesomeIcon icon={faPaperPlane} className="input-icon" />
                          <input
                            type="text"
                            id="subject"
                            name="subject"
                            className={`form-input ${errors.subject ? 'error' : formData.subject ? 'success' : ''}`}
                            value={formData.subject}
                            onChange={handleChange}
                            placeholder="O čem chcete psát?"
                          />
                        </div>
                        {errors.subject && <span className="error-message">{errors.subject}</span>}
                      </motion.div>

                      <motion.div
                        className="form-group"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        viewport={{ once: true }}
                      >
                        <label className="form-label" htmlFor="message">Zpráva</label>
                        <textarea
                          id="message"
                          name="message"
                          className={`form-textarea ${errors.message ? 'error' : formData.message.length >= 10 ? 'success' : ''}`}
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Vaše zpráva..."
                          rows={5}
                        />
                        {errors.message && <span className="error-message">{errors.message}</span>}
                      </motion.div>

                      <motion.button
                        type="submit"
                        className="submit-button"
                        disabled={isSubmitting}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        viewport={{ once: true }}
                      >
                        <span>
                          {isSubmitting ? 'Odesílání...' : (
                            <>
                              <FontAwesomeIcon icon={faPaperPlane} /> Odeslat zprávu
                            </>
                          )}
                        </span>
                      </motion.button>
                    </form>
                  </>
                ) : (
                  <div className="form-success">
                    <motion.div
                      className="success-icon"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    >
                      <FontAwesomeIcon icon={faCheck} className="success-checkmark" />
                    </motion.div>
                    <h3 className="success-title">Zpráva odeslána!</h3>
                    <p className="success-message">
                      Děkujeme za vaši zprávu. Odpovíme vám co nejdříve.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              className="contact-info"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={containerVariants}
            >
              {/* Info Cards */}
              {contactInfo.map((info, index) => (
                <motion.div
                  key={index}
                  className="info-card"
                  variants={itemVariants}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="info-icon-wrapper">
                    <FontAwesomeIcon icon={info.icon} />
                  </div>
                  <div className="info-content">
                    <h3>{info.title}</h3>
                    {info.link ? (
                      <a href={info.link}>{info.content}</a>
                    ) : (
                      <p style={{ whiteSpace: 'pre-line' }}>{info.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Social Links */}
              <motion.div
                className="social-links"
                variants={itemVariants}
              >
                <h3>Sledujte nás</h3>
                <div className="social-icons">
                  {socialLinks.map((social, index) => (
                    <motion.a
                      key={index}
                      href={social.url}
                      className="social-icon"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FontAwesomeIcon icon={social.icon} />
                    </motion.a>
                  ))}
                </div>
              </motion.div>

              {/* Decorative Map */}
              <motion.div
                className="decorative-map"
                variants={itemVariants}
              >
                <div className="map-overlay">
                  <div className="map-pin">
                    <FontAwesomeIcon icon={faMapMarkerAlt} />
                  </div>
                  <div className="map-location">
                    Blažovice, Česká republika
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
