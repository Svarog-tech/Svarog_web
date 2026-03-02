import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import PageMeta from '../components/PageMeta';

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
      <PageMeta title="404 - Stránka nenalezena" description="Tato stránka neexistuje." path="/404" noindex />
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
        marginBottom: '1.5rem',
        color: 'var(--text-secondary, #666)',
        maxWidth: '450px',
      }}>
        {t('notFound.description') || 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '1rem' }}>
        <Link to="/" style={{ padding: '0.75rem 2rem', background: 'var(--primary-color, #e94560)', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem' }}>
          {t('notFound.backHome') || 'Zpět na hlavní stránku'}
        </Link>
        <Link to="/hosting" style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-alt)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem' }}>Webhosting</Link>
        <Link to="/support" style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-alt)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem' }}>Podpora</Link>
        <Link to="/contact" style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-alt)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem' }}>Kontakt</Link>
      </div>
    </div>
  );
};

export default NotFound;
