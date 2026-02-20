import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import Header from './components/Header';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import ScrollToTop from './components/ScrollToTop';
import TriangularBackground from './components/TriangularBackground';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Loading from './components/Loading';

// Lazy-loaded pages – každá stránka se načte až když ji uživatel navštíví
const Home = lazy(() => import('./pages/Home'));
const Hosting = lazy(() => import('./pages/Hosting'));
const DomainsSimple = lazy(() => import('./pages/DomainsSimple'));
const Support = lazy(() => import('./pages/Support'));
const About = lazy(() => import('./pages/About'));
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Services = lazy(() => import('./pages/Services'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const FileManager = lazy(() => import('./pages/FileManager'));
const EmailManager = lazy(() => import('./pages/EmailManager'));
const DomainManager = lazy(() => import('./pages/DomainManager'));
const DatabaseManager = lazy(() => import('./pages/DatabaseManager'));
const DNSManager = lazy(() => import('./pages/DNSManager'));
const FTPManager = lazy(() => import('./pages/FTPManager'));
const BackupManager = lazy(() => import('./pages/BackupManager'));
const CronJobsManager = lazy(() => import('./pages/CronJobsManager'));
const Tickets = lazy(() => import('./pages/Tickets'));
const Profile = lazy(() => import('./pages/Profile'));
const Configurator = lazy(() => import('./pages/Configurator'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminTickets = lazy(() => import('./pages/AdminTickets'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Contact = lazy(() => import('./pages/Contact'));

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <ToastProvider>
              <Router>
              <ScrollToTop />
              <a href="#main-content" className="skip-link">Přeskočit na obsah</a>
              <div className="App">
                <TriangularBackground opacity={0.25} />
                <Header />
                <div id="main-content" tabIndex={-1}>
                <ErrorBoundary>
                  <Suspense fallback={<Loading message="Načítám..." minHeight="60vh" />}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/hosting" element={<Hosting />} />
                      <Route path="/domains" element={<DomainsSimple />} />
                      <Route path="/support" element={<Support />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/payment/success" element={<PaymentSuccess />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />

                      {/* Protected routes */}
                      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                      <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
                      <Route path="/services/:id" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
                      <Route path="/services/:id/files" element={<ProtectedRoute><FileManager /></ProtectedRoute>} />
                      <Route path="/services/:id/emails" element={<ProtectedRoute><EmailManager /></ProtectedRoute>} />
                      <Route path="/services/:id/domains" element={<ProtectedRoute><DomainManager /></ProtectedRoute>} />
                      <Route path="/services/:id/databases" element={<ProtectedRoute><DatabaseManager /></ProtectedRoute>} />
                      <Route path="/services/:id/dns" element={<ProtectedRoute><DNSManager /></ProtectedRoute>} />
                      <Route path="/services/:id/ftp" element={<ProtectedRoute><FTPManager /></ProtectedRoute>} />
                      <Route path="/services/:id/backups" element={<ProtectedRoute><BackupManager /></ProtectedRoute>} />
                      <Route path="/services/:id/cron" element={<ProtectedRoute><CronJobsManager /></ProtectedRoute>} />
                      <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                      <Route path="/configurator" element={<ProtectedRoute><Configurator /></ProtectedRoute>} />

                      {/* Admin routes */}
                      <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
                      <Route path="/admin/tickets" element={<ProtectedRoute requireAdmin><AdminTickets /></ProtectedRoute>} />
                      <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />

                      {/* 404 catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
                </div>
                <CookieBanner />
                <Footer />
              </div>
            </Router>
            </ToastProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
