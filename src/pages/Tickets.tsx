import React, { useState, useEffect, useMemo } from 'react';
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
import { createSupportTicket, createPublicTicket, apiCall } from '../lib/api';
import { SkeletonList } from '../components/Skeleton';
import TicketDetailModal from '../components/TicketDetailModal';
import './Tickets.css';

interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_at: string;
  updated_at?: string;
  last_reply_at?: string;
  resolved_at?: string;
}

const Tickets: React.FC = () => {
  const { user, profile } = useAuth();
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
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await apiCall<{ success: boolean; tickets: Ticket[] }>('/tickets');
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
      // Use public endpoint if not logged in (development mode)
      console.log('[Tickets] user:', user, 'isLoggedIn:', !!user);
      if (!user) {
        console.log('[Tickets] Using PUBLIC endpoint');
        await createPublicTicket({
          ...formData,
          email: 'test@example.com',
          name: 'Test User'
        });
      } else {
        console.log('[Tickets] Using AUTHENTICATED endpoint');
        await createSupportTicket(formData);
      }

      setSuccess(true);
      setFormData({
        subject: '',
        message: '',
        priority: 'medium',
        category: 'general'
      });

      // Načtení tiketů znovu (only if logged in)
      if (user) {
        fetchTickets();
      }

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

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'waiting':
        return 'purple';
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
      case 'waiting':
        return 'Čeká na odpověď';
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

  // Calculate ticket statistics
  const ticketStats = useMemo(() => {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
    };
    return stats;
  }, [tickets]);

  // Filter and sort tickets
  const filteredAndSortedTickets = useMemo(() => {
    let result = [...tickets];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(ticket => ticket.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return 0;
    });

    return result;
  }, [tickets, filterStatus, sortBy]);

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
            {/* Statistics */}
            {!loading && tickets.length > 0 && (
              <motion.div
                className="tickets-stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <motion.div
                  className="stat-item"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="stat-number">{ticketStats.total}</div>
                  <div className="stat-text">Celkem</div>
                </motion.div>
                <motion.div
                  className="stat-item stat-item--warning"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="stat-number">{ticketStats.open}</div>
                  <div className="stat-text">Otevřené</div>
                </motion.div>
                <motion.div
                  className="stat-item stat-item--info"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="stat-number">{ticketStats.inProgress}</div>
                  <div className="stat-text">Zpracovávané</div>
                </motion.div>
                <motion.div
                  className="stat-item stat-item--success"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="stat-number">{ticketStats.resolved}</div>
                  <div className="stat-text">Vyřešené</div>
                </motion.div>
              </motion.div>
            )}

            <motion.div
              className="tickets-header"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="tickets-controls">
                <div className="filter-group">
                  <label htmlFor="status-filter" className="filter-label">Stav:</label>
                  <select
                    id="status-filter"
                    className="filter-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Všechny</option>
                    <option value="open">Otevřené</option>
                    <option value="in_progress">Zpracovávané</option>
                    <option value="waiting">Čekající</option>
                    <option value="resolved">Vyřešené</option>
                    <option value="closed">Uzavřené</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="sort-select" className="filter-label">Seřadit:</label>
                  <select
                    id="sort-select"
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'priority')}
                  >
                    <option value="newest">Nejnovější</option>
                    <option value="oldest">Nejstarší</option>
                    <option value="priority">Priorita</option>
                  </select>
                </div>
              </div>
              <motion.button
                className="new-ticket-btn"
                onClick={() => setShowNewTicketForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FontAwesomeIcon icon={faPlus} />
                Nový tiket
              </motion.button>
            </motion.div>

        {/* Tickets List */}
        {loading ? (
          <SkeletonList count={3} type="ticket" />
        ) : filteredAndSortedTickets.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.4, 0.0, 0.2, 1] }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
            >
              <FontAwesomeIcon icon={faTicket} className="empty-icon" />
            </motion.div>
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {filterStatus !== 'all' ? 'Žádné tikety pro tento filtr' : 'Žádné tikety'}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {filterStatus !== 'all'
                ? 'Zkus změnit filtr nebo vytvoř nový tiket.'
                : 'Zatím nemáš žádné support tikety. Pokud potřebuješ pomoc, vytvoř nový tiket.'}
            </motion.p>
            {filterStatus !== 'all' && (
              <motion.button
                className="filter-reset-btn"
                onClick={() => setFilterStatus('all')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Zobrazit všechny tikety
              </motion.button>
            )}
            <motion.button
              className="cta-button"
              onClick={() => setShowNewTicketForm(true)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: filterStatus !== 'all' ? 0.7 : 0.6 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit tiket
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            className="tickets-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {filteredAndSortedTickets.map((ticket, index) => (
              <motion.div
                key={ticket.id}
                className="ticket-card"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.08,
                  ease: [0.4, 0.0, 0.2, 1]
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="ticket-card-header">
                  <div className="ticket-info">
                    <h3 className="ticket-subject">{ticket.subject}</h3>
                    <div className="ticket-meta">
                      <motion.span
                        className={`priority-badge priority-${getPriorityColor(ticket.priority)}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.08 + 0.2 }}
                      >
                        {getPriorityLabel(ticket.priority)}
                      </motion.span>
                      <span className="ticket-date">
                        <FontAwesomeIcon icon={faClock} />
                        {new Date(ticket.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                  </div>
                  <motion.div
                    className={`ticket-status status-${getStatusColor(ticket.status)}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 + 0.15 }}
                  >
                    <FontAwesomeIcon icon={faCircle} />
                    {getStatusLabel(ticket.status)}
                  </motion.div>
                </div>
                <p className="ticket-message">{ticket.message}</p>
                <motion.button
                  className="view-ticket-btn"
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setIsModalOpen(true);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Zobrazit detail
                </motion.button>
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
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                transition={{
                  type: "spring",
                  damping: 25,
                  stiffness: 300
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    Nový support tiket
                  </motion.h2>
                  <motion.button
                    className="close-modal-btn"
                    onClick={() => setShowNewTicketForm(false)}
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </motion.button>
                </div>

                {success ? (
                  <motion.div
                    className="success-message"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        delay: 0.2,
                        type: "spring",
                        stiffness: 200,
                        damping: 12
                      }}
                    >
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </motion.div>
                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      Tiket byl úspěšně vytvořen!
                    </motion.h3>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      Náš tým se ti ozve co nejdříve.
                    </motion.p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="ticket-form">
                    <motion.div
                      className="form-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <label>Předmět *</label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Stručně popiš problém"
                        required
                      />
                    </motion.div>

                    <motion.div
                      className="form-row"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
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
                    </motion.div>

                    <motion.div
                      className="form-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <label>Zpráva *</label>
                      <textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Podrobně popiš svůj problém nebo dotaz..."
                        rows={6}
                        required
                      />
                    </motion.div>

                    <motion.div
                      className="form-actions"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <motion.button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setShowNewTicketForm(false)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Zrušit
                      </motion.button>
                      <motion.button
                        type="submit"
                        className="submit-btn"
                        disabled={submitting}
                        whileHover={{ scale: submitting ? 1 : 1.02 }}
                        whileTap={{ scale: submitting ? 1 : 0.98 }}
                      >
                        {submitting ? 'Vytváření...' : 'Vytvořit tiket'}
                      </motion.button>
                    </motion.div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </section>
      </main>
      <TicketDetailModal
        ticket={selectedTicket ? { ...selectedTicket, user_id: user?.id || '', user_name: profile?.first_name || '' } : null}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTicket(null);
        }}
        onUpdate={() => {
          fetchTickets();
        }}
      />
    </>
  );
};

export default Tickets;
