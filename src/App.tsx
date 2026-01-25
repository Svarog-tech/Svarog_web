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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/services" element={<Services />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/configurator" element={<Configurator />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/users" element={<AdminUsers />} />
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
