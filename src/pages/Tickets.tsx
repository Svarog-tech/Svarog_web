import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faPlus,
  faTimes,
  faCircle,
  faClock,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { createSupportTicket, API_BASE_URL } from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import { SkeletonList } from '../components/Skeleton';
import './Tickets.css';

interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_at: string;
}

const Tickets: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showError } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: 'general'
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const result = await response.json();
      if (result.success && result.tickets) {
        setTickets(result.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || !formData.message) {
      return;
    }

    setSubmitting(true);

    try {
      await createSupportTicket(formData);
      setSuccess(true);
      setFormData({
        subject: '',
        message: '',
        priority: 'medium',
        category: 'general'
      });

      // Načtení tiketů znovu
      fetchTickets();

      setTimeout(() => {
        setShowNewTicketForm(false);
        setSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error creating ticket:', error);
      showError(t('tickets.error.creating'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return t('tickets.status.open');
      case 'in_progress':
        return t('tickets.status.processing');
      case 'resolved':
        return t('tickets.status.resolved');
      case 'closed':
        return t('tickets.status.closed');
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'Urgentní';
      case 'high':
        return 'Vysoká';
      case 'medium':
        return 'Střední';
      case 'low':
        return 'Nízká';
      default:
        return priority;
    }
  };

  return (
    <>
      <main className="tickets-page">
        {/* Hero Section */}
        <motion.section
          className="tickets-hero"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="container">
            <div className="tickets-hero-content">
              <motion.h1
                className="tickets-title"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Support <span className="gradient-text">tikety</span>
              </motion.h1>
              <motion.p
                className="tickets-description"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Spravuj své support požadavky a komunikuj s naším týmem
              </motion.p>
            </div>
          </div>
        </motion.section>

        {/* Tickets Content Section */}
        <section className="tickets-content-section">
          <div className="container">
            <div className="tickets-header">
              <motion.button
                className="new-ticket-btn"
                onClick={() => setShowNewTicketForm(true)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FontAwesomeIcon icon={faPlus} />
                Nový tiket
              </motion.button>
            </div>

        {/* Tickets List */}
        {loading ? (
          <SkeletonList count={3} type="ticket" />
        ) : tickets.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <FontAwesomeIcon icon={faTicket} className="empty-icon" />
            <h3>Žádné tikety</h3>
            <p>
              Zatím nemáš žádné support tikety. Pokud potřebuješ pomoc, vytvoř nový tiket.
            </p>
            <button
              className="cta-button"
              onClick={() => setShowNewTicketForm(true)}
            >
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit tiket
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="tickets-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {tickets.map((ticket, index) => (
              <motion.div
                key={ticket.id}
                className="ticket-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="ticket-card-header">
                  <div className="ticket-info">
                    <h3 className="ticket-subject">{ticket.subject}</h3>
                    <div className="ticket-meta">
                      <span className={`priority-badge priority-${getPriorityColor(ticket.priority)}`}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                      <span className="ticket-date">
                        <FontAwesomeIcon icon={faClock} />
                        {new Date(ticket.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                  </div>
                  <div className={`ticket-status status-${getStatusColor(ticket.status)}`}>
                    <FontAwesomeIcon icon={faCircle} />
                    {getStatusLabel(ticket.status)}
                  </div>
                </div>
                <p className="ticket-message">{ticket.message}</p>
                <button className="view-ticket-btn">
                  Zobrazit detail
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* New Ticket Modal */}
        <AnimatePresence>
          {showNewTicketForm && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewTicketForm(false)}
            >
              <motion.div
                className="modal-content"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Nový support tiket</h2>
                  <button
                    className="close-modal-btn"
                    onClick={() => setShowNewTicketForm(false)}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {success ? (
                  <div className="success-message">
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <h3>Tiket byl úspěšně vytvořen!</h3>
                    <p>Náš tým se ti ozve co nejdříve.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="ticket-form">
                    <div className="form-group">
                      <label>Předmět *</label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Stručně popiš problém"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Priorita</label>
                        <select
                          value={formData.priority}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              priority: e.target.value as Ticket['priority']
                            })
                          }
                        >
                          <option value="low">Nízká</option>
                          <option value="medium">Střední</option>
                          <option value="high">Vysoká</option>
                          <option value="urgent">Urgentní</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Kategorie</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                          <option value="general">Obecné</option>
                          <option value="technical">Technická podpora</option>
                          <option value="billing">Fakturace</option>
                          <option value="domain">Domény</option>
                          <option value="hosting">Hosting</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Zpráva *</label>
                      <textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Podrobně popiš svůj problém nebo dotaz..."
                        rows={6}
                        required
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setShowNewTicketForm(false)}
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        className="submit-btn"
                        disabled={submitting}
                      >
                        {submitting ? 'Vytváření...' : 'Vytvořit tiket'}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </section>
      </main>
    </>
  );
};

export default Tickets;
