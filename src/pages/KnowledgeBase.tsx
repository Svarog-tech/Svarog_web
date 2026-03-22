import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faEye,
  faThumbsUp,
  faThumbsDown,
  faChevronLeft,
  faChevronRight,
  faBookOpen,
  faFolder,
  faRocket,
  faServer,
  faEnvelope,
  faGlobe,
  faShieldAlt,
  faFileInvoice,
  faCalendarAlt,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { motion } from 'framer-motion';
import PageMeta from '../components/PageMeta';
import { getKBCategories, getKBArticles, getKBArticle, rateKBArticle } from '../lib/api';
import type { KBCategory, KBArticle } from '../lib/api';
import './KnowledgeBase.css';

// Map icon name strings to FontAwesome icons
const iconMap: Record<string, typeof faRocket> = {
  faRocket,
  faServer,
  faEnvelope,
  faGlobe,
  faFolder,
  faShieldAlt,
  faFileInvoice,
  faBookOpen,
};

function getIcon(iconName: string | null) {
  if (!iconName) return faBookOpen;
  return iconMap[iconName] || faBookOpen;
}

// Simple markdown-like renderer for article content
function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>);
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith('- ')) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(<li key={i}>{renderInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`}>{items}</ol>);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    elements.push(<p key={i}>{renderInline(line)}</p>);
    i++;
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderCode(text.slice(lastIndex, match.index)));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = boldRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(renderCode(text.slice(lastIndex)));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderCode(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const codeRegex = /`(.+?)`/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<code key={match.index}>{match[1]}</code>);
    lastIndex = codeRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// Format date
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

const KnowledgeBase: React.FC = () => {
  const { categorySlug, articleSlug } = useParams<{ categorySlug?: string; articleSlug?: string }>();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);

  // Determine current view
  const view = articleSlug ? 'article' : 'list';

  // Load categories
  useEffect(() => {
    getKBCategories().then(setCategories).catch(() => {});
  }, []);

  // Load articles list
  useEffect(() => {
    if (view !== 'list') return;
    setLoading(true);
    getKBArticles({ category: categorySlug, search: searchQuery, page })
      .then((result) => {
        setArticles(result.articles);
        setTotalPages(result.pagination.totalPages);
      })
      .catch(() => {
        setArticles([]);
      })
      .finally(() => setLoading(false));
  }, [view, categorySlug, searchQuery, page]);

  // Load single article
  useEffect(() => {
    if (view !== 'article' || !articleSlug) return;
    setLoading(true);
    setVoted(null);
    getKBArticle(articleSlug)
      .then(setArticle)
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [view, articleSlug]);

  // Reset page on category/search change
  useEffect(() => {
    setPage(1);
  }, [categorySlug, searchQuery]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    if (categorySlug || articleSlug) {
      navigate('/kb');
    }
  }, [searchInput, categorySlug, articleSlug, navigate]);

  const handleCategoryClick = useCallback((slug: string) => {
    setSearchQuery('');
    setSearchInput('');
    if (categorySlug === slug) {
      navigate('/kb');
    } else {
      navigate(`/kb/${slug}`);
    }
  }, [categorySlug, navigate]);

  const handleRate = useCallback(async (helpful: boolean) => {
    if (!article || voted) return;
    try {
      await rateKBArticle(article.id, helpful);
      setVoted(helpful ? 'yes' : 'no');
    } catch {
      // ignore
    }
  }, [article, voted]);

  // Active category
  const activeCategory = useMemo(
    () => categories.find(c => c.slug === categorySlug),
    [categories, categorySlug]
  );

  // SEO meta
  const metaTitle = article
    ? `${article.title} | Nápověda | Alatyr Hosting`
    : activeCategory
      ? `${activeCategory.name} | Nápověda | Alatyr Hosting`
      : 'Nápověda | Alatyr Hosting';

  const metaDescription = article
    ? article.excerpt || article.title
    : activeCategory
      ? activeCategory.description || `Články v kategorii ${activeCategory.name}`
      : 'Nápověda a návody pro zákazníky Alatyr Hosting. Najděte odpovědi na časté dotazy.';

  const metaPath = article
    ? `/kb/article/${article.slug}`
    : categorySlug
      ? `/kb/${categorySlug}`
      : '/kb';

  // JSON-LD for articles
  const articleJsonLd = article ? {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    'headline': article.title,
    'description': article.excerpt || '',
    'datePublished': article.created_at,
    'dateModified': article.updated_at,
    'publisher': {
      '@type': 'Organization',
      'name': 'Alatyr Hosting'
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `https://alatyrhosting.eu/kb/article/${article.slug}`
    }
  } : undefined;

  const breadcrumbs = [
    { name: 'Alatyr Hosting', url: '/' },
    { name: 'Nápověda', url: '/kb' },
  ];
  if (activeCategory && !article) {
    breadcrumbs.push({ name: activeCategory.name, url: `/kb/${activeCategory.slug}` });
  }
  if (article) {
    if (article.category_slug) {
      breadcrumbs.push({ name: article.category_name || '', url: `/kb/${article.category_slug}` });
    }
    breadcrumbs.push({ name: article.title, url: `/kb/article/${article.slug}` });
  }

  return (
    <>
      <PageMeta
        title={metaTitle}
        description={metaDescription}
        path={metaPath}
        breadcrumbs={breadcrumbs}
        jsonLd={articleJsonLd}
      />
      <main className="kb-page">
        {/* Hero */}
        <section className="kb-hero">
          <div className="hero-bg">
            <div className="hero-grid"></div>
          </div>
          <div className="container">
            <motion.div
              className="kb-hero-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1>
                Centrum
                <span className="gradient-text">nápovědy</span>
              </h1>
              <p>Najděte odpovědi na své otázky, návody a řešení běžných problémů.</p>
              <form onSubmit={handleSearch} className="kb-search-wrapper">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  className="kb-search-input"
                  placeholder="Hledejte v článcích..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </form>
            </motion.div>
          </div>
        </section>

        <div className="container">
          {/* Breadcrumbs (not on main page) */}
          {(categorySlug || articleSlug) && (
            <nav className="kb-breadcrumbs" aria-label="Breadcrumb">
              <Link to="/kb">Nápověda</Link>
              {activeCategory && !article && (
                <>
                  <span className="separator">/</span>
                  <span className="current">{activeCategory.name}</span>
                </>
              )}
              {article && (
                <>
                  {article.category_slug && (
                    <>
                      <span className="separator">/</span>
                      <Link to={`/kb/${article.category_slug}`}>{article.category_name}</Link>
                    </>
                  )}
                  <span className="separator">/</span>
                  <span className="current">{article.title}</span>
                </>
              )}
            </nav>
          )}

          {/* ARTICLE DETAIL VIEW */}
          {view === 'article' && (
            <section className="kb-article-detail">
              {loading ? (
                <div className="kb-loading">
                  <div className="spinner"></div>
                  <span>Načítám článek...</span>
                </div>
              ) : article ? (
                <>
                  <div className="kb-article-header">
                    <Link
                      to={article.category_slug ? `/kb/${article.category_slug}` : '/kb'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem', color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}
                    >
                      <FontAwesomeIcon icon={faArrowLeft} />
                      Zpět na články
                    </Link>
                    <h1>{article.title}</h1>
                    <div className="kb-article-info">
                      {article.category_name && (
                        <Link to={`/kb/${article.category_slug}`} className="kb-article-category-badge">
                          <FontAwesomeIcon icon={getIcon(null)} />
                          {article.category_name}
                        </Link>
                      )}
                      <span className="info-item">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        {formatDate(article.updated_at || article.created_at)}
                      </span>
                      <span className="info-item">
                        <FontAwesomeIcon icon={faEye} />
                        {article.views} zobrazení
                      </span>
                    </div>
                  </div>

                  <div className="kb-article-body">
                    {renderContent(article.content)}
                  </div>

                  {/* Helpfulness rating */}
                  <div className="kb-helpful-section">
                    <div className="kb-helpful-title">Byl tento článek užitečný?</div>
                    <div className="kb-helpful-buttons">
                      <button
                        className={`kb-helpful-btn yes ${voted === 'yes' ? 'voted' : ''}`}
                        onClick={() => handleRate(true)}
                        disabled={!!voted}
                      >
                        <FontAwesomeIcon icon={faThumbsUp} />
                        Ano
                      </button>
                      <button
                        className={`kb-helpful-btn no ${voted === 'no' ? 'voted' : ''}`}
                        onClick={() => handleRate(false)}
                        disabled={!!voted}
                      >
                        <FontAwesomeIcon icon={faThumbsDown} />
                        Ne
                      </button>
                    </div>
                    {voted && (
                      <div className="kb-helpful-thanks">
                        Děkujeme za vaši zpětnou vazbu!
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="kb-empty">
                  <div className="kb-empty-icon">
                    <FontAwesomeIcon icon={faBookOpen} />
                  </div>
                  <h3>Článek nebyl nalezen</h3>
                  <p>Zkuste vyhledat jiný článek nebo se vraťte na hlavní stránku nápovědy.</p>
                  <Link to="/kb" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                    Zpět na nápovědu
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <>
              {/* Categories */}
              <section className="kb-categories-section">
                <h2 className="kb-section-title">Kategorie</h2>
                <div className="kb-categories-grid">
                  {categories.map((cat) => (
                    <motion.div
                      key={cat.id}
                      className={`kb-category-card ${categorySlug === cat.slug ? 'active' : ''}`}
                      onClick={() => handleCategoryClick(cat.slug)}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      whileHover={{ y: -2 }}
                    >
                      <div className="kb-category-icon">
                        <FontAwesomeIcon icon={getIcon(cat.icon)} />
                      </div>
                      <div className="kb-category-name">{cat.name}</div>
                      <div className="kb-category-count">
                        {cat.article_count} {cat.article_count === 1 ? 'článek' : cat.article_count >= 2 && cat.article_count <= 4 ? 'články' : 'článků'}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Articles */}
              <section className="kb-articles-section">
                <h2 className="kb-section-title">
                  {searchQuery
                    ? `Výsledky hledání: "${searchQuery}"`
                    : activeCategory
                      ? `Články: ${activeCategory.name}`
                      : 'Všechny články'}
                </h2>

                {loading ? (
                  <div className="kb-loading">
                    <div className="spinner"></div>
                    <span>Načítám články...</span>
                  </div>
                ) : articles.length === 0 ? (
                  <div className="kb-empty">
                    <div className="kb-empty-icon">
                      <FontAwesomeIcon icon={faBookOpen} />
                    </div>
                    <h3>Žádné články nenalezeny</h3>
                    <p>
                      {searchQuery
                        ? 'Zkuste jiný vyhledávací dotaz.'
                        : 'V této kategorii zatím nejsou žádné články.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="kb-articles-list">
                      {articles.map((art) => (
                        <Link
                          key={art.id}
                          to={`/kb/article/${art.slug}`}
                          className="kb-article-card"
                        >
                          <div className="kb-article-title">{art.title}</div>
                          {art.excerpt && (
                            <div className="kb-article-excerpt">{art.excerpt}</div>
                          )}
                          <div className="kb-article-meta">
                            <span className="meta-item">
                              <FontAwesomeIcon icon={faFolder} />
                              {art.category_name}
                            </span>
                            <span className="meta-item">
                              <FontAwesomeIcon icon={faEye} />
                              {art.views}
                            </span>
                            <span className="meta-item">
                              <FontAwesomeIcon icon={faCalendarAlt} />
                              {formatDate(art.updated_at || art.created_at)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="kb-pagination">
                        <button
                          className="kb-pagination-btn"
                          disabled={page <= 1}
                          onClick={() => setPage(p => p - 1)}
                          aria-label="Předchozí stránka"
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            className={`kb-pagination-btn ${page === p ? 'active' : ''}`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          className="kb-pagination-btn"
                          disabled={page >= totalPages}
                          onClick={() => setPage(p => p + 1)}
                          aria-label="Další stránka"
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default KnowledgeBase;
