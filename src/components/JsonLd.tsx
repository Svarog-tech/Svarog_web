import React from 'react';

interface JsonLdProps {
  data: Record<string, any>;
}

/**
 * Renders JSON-LD structured data in a script tag.
 * Safe to use dangerouslySetInnerHTML here because data is always
 * a controlled, static schema object — never user input.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default JsonLd;
