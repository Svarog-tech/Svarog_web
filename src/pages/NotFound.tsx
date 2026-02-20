import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const NotFound: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontSize: '6rem',
        fontWeight: 800,
        background: 'linear-gradient(135deg, var(--primary-color, #e94560), var(--accent-color, #0f3460))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '0.5rem',
        lineHeight: 1,
      }}>
        404
      </h1>
      <h2 style={{
        fontSize: '1.5rem',
        marginBottom: '1rem',
        color: 'var(--text-primary, #1a1a2e)',
      }}>
        {t('notFound.title') || 'Stránka nenalezena'}
      </h2>
      <p style={{
        marginBottom: '2rem',
        color: 'var(--text-secondary, #666)',
        maxWidth: '450px',
      }}>
        {t('notFound.description') || 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.'}
      </p>
      <Link
        to="/"
        style={{
          padding: '0.75rem 2rem',
          background: 'var(--primary-color, #e94560)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '1rem',
          transition: 'opacity 0.2s',
        }}
      >
        {t('notFound.backHome') || 'Zpět na hlavní stránku'}
      </Link>
    </div>
  );
};

export default NotFound;
