import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faTimes, faPaperPlane, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import './AssistantChat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `You are the helpful AI assistant for Alatyr Hosting, a Czech web hosting provider. You help customers with questions about hosting plans, domains, technical support, and general inquiries.

**About Alatyr Hosting:**
- Czech hosting provider with 10+ years of experience
- 99.9% uptime guarantee
- 24/7 customer support
- 10,000+ satisfied customers

**Hosting Plans (Webhosting):**
1. **Basic** - 5 GB storage, 1 domain, 1 email (1GB), 1 database, 3 CRON jobs, 1 subdomain - Ideal for small personal websites
2. **Standard** - 10 GB storage, 1 domain, 5 emails (5GB), 2 databases, 4 CRON jobs, 3 subdomains - For small businesses
3. **Pro** - 15 GB storage, 1 domain, 10 emails (10GB), 5 databases, 6 CRON jobs, 5 subdomains - For medium projects with higher traffic
4. **Ultimate** - 25 GB storage, 1 domain, unlimited emails, unlimited databases (10GB total), 10 CRON jobs, unlimited subdomains - For large websites with maximum performance

**WordPress Plans:**
1. **WP Start** - 10 GB storage, 1 database, no email, 3 CRON jobs, automatic WordPress installation and updates
2. **WP Pro** - 15 GB storage, 2 GB email, 1 database, 5 CRON jobs, automatic backups, WP-CLI access, staging environment, performance optimization

**All plans include:**
- Free SSL certificate
- Daily backups
- Unlimited bandwidth
- 30-day money-back guarantee
- Free migration from other providers

**Features:**
- SSD storage for fast performance
- Cloudflare CDN integration
- Advanced security with malware scanning
- Git integration (Pro plans)
- Staging environments (higher plans)

**Support options:**
- Support tickets for complex issues
- Live chat for quick help
- Phone support for urgent matters
- Email support (response within 2 hours)

**Company values:**
- Innovation - constantly improving services
- Reliability - stable and secure hosting
- Care - personalized customer support
- Performance - optimized infrastructure

**Contact:**
- Website: alatyrhosting.eu
- Support available 24/7

Respond in the same language the user writes in (Czech or English). Be friendly, helpful, and concise. If you don't know something specific, direct users to contact support for detailed assistance.`;

const AssistantChat: React.FC = () => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: language === 'cs'
          ? 'Ahoj! Jsem AI asistent Alatyr Hosting. Jak vam mohu pomoci? Mohu odpovedet na otazky o nasich hosting planech, domenach, technicke podpore a dalsich sluzbach.'
          : 'Hello! I\'m the AI assistant for Alatyr Hosting. How can I help you? I can answer questions about our hosting plans, domains, technical support, and other services.',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, language]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversationHistory = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user' as const, content: userMessage.content }
      ];

      const response = await fetch('/api/chat/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Guard': '1',
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: conversationHistory,
          systemPrompt: SYSTEM_PROMPT,
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.text ||
        (language === 'cs' ? 'Omlouvám se, nepodařilo se mi odpovědět. Zkuste to prosím znovu.' : 'Sorry, I couldn\'t generate a response. Please try again.');

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: language === 'cs'
          ? 'Omlouvam se, doslo k chybe pri zpracovani vasi zpravy. Zkuste to prosim znovu nebo kontaktujte nasi podporu.'
          : 'Sorry, an error occurred while processing your message. Please try again or contact our support.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Creative blob toggle button */}
      <motion.button
        className="assistant-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? (language === 'cs' ? 'Zavrit asistenta' : 'Close assistant') : (language === 'cs' ? 'Otevrit asistenta' : 'Open assistant')}
      >
        <span className="pulse-ring"></span>
        <span className="pulse-ring"></span>
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              className="icon-inner"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </motion.div>
          ) : (
            <motion.div
              key="robot"
              className="icon-inner"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <FontAwesomeIcon icon={faRobot} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="assistant-popup"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="assistant-header">
              <div className="assistant-header-content">
                <div className="assistant-avatar">
                  <div className="avatar-inner">
                    <FontAwesomeIcon icon={faRobot} />
                  </div>
                </div>
                <div className="assistant-info">
                  <h3>{language === 'cs' ? 'AI Asistent' : 'AI Assistant'}</h3>
                  <span className="assistant-status">
                    <span className="status-dot"></span>
                    Online
                  </span>
                </div>
              </div>
              <button
                className="assistant-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label={language === 'cs' ? 'Zavrit' : 'Close'}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* Messages */}
            <div className="assistant-messages">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`assistant-message ${message.role}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {message.role === 'assistant' && (
                    <div className="message-avatar">
                      <div className="avatar-icon">
                        <FontAwesomeIcon icon={faRobot} />
                      </div>
                    </div>
                  )}
                  <div className="message-content">
                    <p>{message.content}</p>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  className="assistant-message assistant"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="message-avatar">
                    <div className="avatar-icon">
                      <FontAwesomeIcon icon={faRobot} />
                    </div>
                  </div>
                  <div className="message-content typing">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="assistant-input-container">
              <input
                ref={inputRef}
                type="text"
                className="assistant-input"
                placeholder={language === 'cs' ? 'Napiste zpravu...' : 'Type a message...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
              <button
                className="assistant-send-btn"
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                aria-label={language === 'cs' ? 'Odeslat' : 'Send'}
              >
                <div className="btn-inner">
                  {isLoading ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faPaperPlane} />
                  )}
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AssistantChat;
