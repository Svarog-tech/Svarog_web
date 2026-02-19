import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = ''
}) => (
  <div
    className={`skeleton ${className}`.trim()}
    style={{ width, height, borderRadius }}
  />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-card ${className}`.trim()}>
    <div className="skeleton-card-header">
      <Skeleton width="40px" height="40px" borderRadius="8px" />
      <Skeleton width="80px" height="20px" />
    </div>
    <Skeleton width="70%" height="1.2rem" className="skeleton-mb" />
    <Skeleton width="50%" height="0.9rem" className="skeleton-mb" />
    <div className="skeleton-row">
      <Skeleton width="45%" height="0.85rem" />
      <Skeleton width="45%" height="0.85rem" />
    </div>
    <div className="skeleton-card-footer">
      <Skeleton width="80px" height="32px" borderRadius="6px" />
      <Skeleton width="80px" height="32px" borderRadius="6px" />
    </div>
  </div>
);

export const SkeletonTicket: React.FC = () => (
  <div className="skeleton-ticket">
    <div className="skeleton-ticket-header">
      <div className="skeleton-ticket-info">
        <Skeleton width="60%" height="1.1rem" className="skeleton-mb" />
        <div className="skeleton-row">
          <Skeleton width="60px" height="22px" borderRadius="12px" />
          <Skeleton width="100px" height="0.85rem" />
        </div>
      </div>
      <Skeleton width="80px" height="24px" borderRadius="12px" />
    </div>
    <Skeleton width="90%" height="0.85rem" className="skeleton-mb-sm" />
    <Skeleton width="70%" height="0.85rem" className="skeleton-mb" />
    <Skeleton width="100px" height="32px" borderRadius="6px" />
  </div>
);

interface SkeletonListProps {
  count?: number;
  type?: 'card' | 'ticket';
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ count = 3, type = 'card' }) => (
  <div className={type === 'card' ? 'skeleton-grid' : 'skeleton-list'}>
    {Array.from({ length: count }).map((_, i) =>
      type === 'card' ? <SkeletonCard key={i} /> : <SkeletonTicket key={i} />
    )}
  </div>
);

export default Skeleton;
