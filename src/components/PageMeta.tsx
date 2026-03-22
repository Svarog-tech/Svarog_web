import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getBaseUrl } from '../lib/seo';
import { useLanguage } from '../contexts/LanguageContext';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  jsonLd?: Record<string, unknown>;
}

const PageMeta: React.FC<PageMetaProps> = ({ title, description, path, noindex, breadcrumbs, jsonLd }) => {
  const base = getBaseUrl();
  const canonical = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const { language } = useLanguage();

  const breadcrumbJsonLd = breadcrumbs && breadcrumbs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url.startsWith('http') ? item.url : `${base}${item.url}`
    }))
  } : null;

  return (
    <Helmet>
      <html lang={language} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${base}/alatyrlogo-removebg-preview.png`} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${base}/alatyrlogo-removebg-preview.png`} />
      {/* hrefLang: Czech site only, no separate /en/ routes */}
      <link rel="alternate" hrefLang="cs" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />
      {breadcrumbJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      )}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default PageMeta;
