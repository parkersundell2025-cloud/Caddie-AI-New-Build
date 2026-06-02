import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import EmailCapture from './EmailCapture';

export default function BottomCTA() {
  return (
    <section
      className="py-20 md:py-28 px-6 md:px-12 relative overflow-hidden"
      style={{ backgroundColor: '#1a2e1a' }}>
      
      {/* Radial gradient background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(168, 213, 162, 0.4) 0%, transparent 70%)'
        }} />
      

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-xs md:text-sm font-bold uppercase tracking-widest"
          style={{ color: '#a8d5a2' }}>
          
          Be First on the Green
        </motion.p>

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="font-serif font-bold text-4xl md:text-5xl text-white">
          
          Ready to transform your game?
        </motion.h2>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-white/70 text-base md:text-lg">
          
          Start your 7-day free trial today. No commitment — cancel anytime.
        </motion.p>

        {/* Email Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto">
          
          <p className="text-white/70 text-xs text-center mb-2">⚡ Join golfers already competing on the leaderboard and lowering their handicap.</p>
          <EmailCapture variant="bottom" />
        </motion.div>

        {/* Demo Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}>
          
          <Link
            to="/onboarding" className="inline-block px-8 py-3.5 rounded-full font-bold text-sm transition-all active:scale-95 hidden"

            style={{ backgroundColor: '#ffffff', color: '#1a2e1a' }}>
            
            Claim My Free Month →
          </Link>
        </motion.div>
      </div>
    </section>);

}