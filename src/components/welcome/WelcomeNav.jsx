import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function WelcomeNav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 w-full z-50 h-16 md:h-20 flex items-center px-6 md:px-12 border-b"
      style={{
        backgroundColor: 'rgba(26, 46, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        borderColor: 'rgba(249, 249, 247, 0.08)',
      }}
    >
      <div className="flex-1 flex items-center">
        <span className="font-serif font-bold text-white text-xl">Caddie <span className="text-xs font-medium" style={{ color: '#a8d5a2', verticalAlign: 'middle' }}>AI</span></span>
      </div>
      <Link
        to="/onboarding"
        className="px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
        style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
      >
        Sign In
      </Link>
    </motion.nav>
  );
}