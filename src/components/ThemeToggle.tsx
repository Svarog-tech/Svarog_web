import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      className="theme-toggle"
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <motion.div
        className="theme-toggle-icon"
        animate={{ rotate: theme === 'dark' ? 360 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <FontAwesomeIcon
          icon={theme === 'light' ? faMoon : faSun}
        />
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggle;