import { motion } from 'framer-motion';

export default function WelcomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="px-6 md:px-12 py-12 md:py-16 border-t"
      style={{
        backgroundColor: '#1a2e1a',
        borderColor: 'rgba(249, 249, 247, 0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Logo and Links */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mb-8 pb-8 border-b" style={{ borderColor: 'rgba(249, 249, 247, 0.08)' }}>
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-white text-xl">Caddie</span>
            <span className="text-xs font-medium" style={{ color: '#a8d5a2' }}>AI</span>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-6 md:gap-8">
            <a href="/privacy" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
              Privacy
            </a>
            <a href="/terms" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
              Terms
            </a>
            <a href="mailto:support@caddieaiapp.com" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
              Contact
            </a>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-white/50 text-xs text-center">
          © {currentYear} Caddie AI. All rights reserved.
        </p>
      </div>
    </motion.footer>
  );
}