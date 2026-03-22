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
import AssistantChat from './components/AssistantChat';
import ScrollToTop from './components/ScrollToTop';
import TriangularBackground from './components/TriangularBackground';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
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
const ControlPanel = lazy(() => import('./components/ControlPanel'));
const ServiceOverview = lazy(() => import('./components/ServiceOverview'));
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
const AdminHestiaCP = lazy(() => import('./pages/AdminHestiaCP'));
const AdminPromo = lazy(() => import('./pages/AdminPromo'));
const AdminEmailTemplates = lazy(() => import('./pages/AdminEmailTemplates'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminTax = lazy(() => import('./pages/AdminTax'));
const Affiliate = lazy(() => import('./pages/Affiliate'));
const AdminAffiliate = lazy(() => import('./pages/AdminAffiliate'));
const Billing = lazy(() => import('./pages/Billing'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const AMLPolicy = lazy(() => import('./pages/AMLPolicy'));
const SecurityIncidents = lazy(() => import('./pages/SecurityIncidents'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Status = lazy(() => import('./pages/Status'));

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
                <main id="main-content" role="main" tabIndex={-1}>
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
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/aml" element={<AMLPolicy />} />
                      <Route path="/security-incidents" element={<SecurityIncidents />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/status" element={<Status />} />
                      <Route path="/kb" element={<KnowledgeBase />} />
                      <Route path="/kb/:categorySlug" element={<KnowledgeBase />} />
                      <Route path="/kb/article/:articleSlug" element={<KnowledgeBase />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/payment/success" element={<PaymentSuccess />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />

                      {/* Protected routes */}
                      <Route path="/dashboard" element={<ProtectedRoute><PageErrorBoundary pageName="Dashboard"><Dashboard /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/services" element={<ProtectedRoute><PageErrorBoundary pageName="Services"><Services /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/services/:id" element={<ProtectedRoute><PageErrorBoundary pageName="ControlPanel"><ControlPanel /></PageErrorBoundary></ProtectedRoute>}>
                        <Route index element={<ServiceOverview />} />
                        <Route path="files" element={<PageErrorBoundary pageName="FileManager"><FileManager /></PageErrorBoundary>} />
                        <Route path="emails" element={<EmailManager />} />
                        <Route path="domains" element={<DomainManager />} />
                        <Route path="databases" element={<DatabaseManager />} />
                        <Route path="dns" element={<DNSManager />} />
                        <Route path="ftp" element={<FTPManager />} />
                        <Route path="backups" element={<BackupManager />} />
                        <Route path="cron" element={<CronJobsManager />} />
                      </Route>
                      <Route path="/tickets" element={<ProtectedRoute allowGuest><PageErrorBoundary pageName="Tickets"><Tickets /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><PageErrorBoundary pageName="Profile"><Profile /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/configurator" element={<ProtectedRoute><PageErrorBoundary pageName="Configurator"><Configurator /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/billing" element={<ProtectedRoute><PageErrorBoundary pageName="Billing"><Billing /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/affiliate" element={<ProtectedRoute><PageErrorBoundary pageName="Affiliate"><Affiliate /></PageErrorBoundary></ProtectedRoute>} />

                      {/* Admin routes */}
                      <Route path="/admin" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="Admin"><Admin /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/tickets" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminTickets"><AdminTickets /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/users" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminUsers"><AdminUsers /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/hestiacp" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminHestiaCP"><AdminHestiaCP /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/promo" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminPromo"><AdminPromo /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/email-templates" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminEmailTemplates"><AdminEmailTemplates /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminAnalytics"><AdminAnalytics /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/tax" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminTax"><AdminTax /></PageErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/affiliate" element={<ProtectedRoute requireAdmin><PageErrorBoundary pageName="AdminAffiliate"><AdminAffiliate /></PageErrorBoundary></ProtectedRoute>} />

                      {/* 404 catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
                </main>
                <CookieBanner />
                <Footer />
              </div>
              <AssistantChat />
            </Router>
            </ToastProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
