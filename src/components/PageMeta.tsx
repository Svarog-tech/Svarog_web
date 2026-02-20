import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getBaseUrl } from '../lib/seo';

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
}

const PageMeta: React.FC<PageMetaProps> = ({ title, description, path }) => {
  const base = getBaseUrl();
  const canonical = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default PageMeta;
