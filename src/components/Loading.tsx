import React from 'react';
import './Loading.css';

interface LoadingProps {
  /** Text pod spinnerem (volitelné) */
  message?: string;
  /** Minimální výška kontejneru (např. '60vh') */
  minHeight?: string;
  /** Dodatečná třída pro obal */
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({ message, minHeight = '40vh', className = '' }) => (
  <div className={`loading-page ${className}`.trim()} style={{ minHeight }} role="status" aria-label="Načítání">
    <div className="loading-spinner" aria-hidden="true" />
    {message && <p className="loading-message">{message}</p>}
  </div>
);

export default Loading;
