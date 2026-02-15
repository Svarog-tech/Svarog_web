import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import ScrollToTop from './components/ScrollToTop';
import TriangularBackground from './components/TriangularBackground';
import Home from './pages/Home';
import Hosting from './pages/Hosting';
import DomainsSimple from './pages/DomainsSimple';
import Support from './pages/Support';
import About from './pages/About';
import Register from './pages/Register';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Tickets from './pages/Tickets';
import Profile from './pages/Profile';
import Configurator from './pages/Configurator';
import Admin from './pages/Admin';
import AdminTickets from './pages/AdminTickets';
import AdminUsers from './pages/AdminUsers';
import PaymentSuccess from './pages/PaymentSuccess';
import ServiceDetail from './pages/ServiceDetail';
import FileManager from './pages/FileManager';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <Router>
              <ScrollToTop />
          <div className="App">
            <TriangularBackground opacity={0.25} />
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/hosting" element={<Hosting />} />
              <Route path="/domains" element={<DomainsSimple />} />
              <Route path="/support" element={<Support />} />
              <Route path="/about" element={<About />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
              <Route path="/services/:id" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
              <Route path="/services/:id/files" element={<ProtectedRoute><FileManager /></ProtectedRoute>} />
              <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/configurator" element={<ProtectedRoute><Configurator /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              <Route path="/admin/tickets" element={<ProtectedRoute requireAdmin><AdminTickets /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
            </Routes>
            <Footer />
            <CookieBanner />
          </div>
            </Router>
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
