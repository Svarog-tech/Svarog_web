import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAdmin?: boolean;
  allowGuest?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false, allowGuest = false }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return null;
  }

  // Allow guest access in development mode when allowGuest is true
  if (!user) {
    if (allowGuest && import.meta.env.DEV) {
      return children;
    }
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !profile?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
