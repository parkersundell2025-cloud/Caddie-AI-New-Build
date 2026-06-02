import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const basicFeatures = [
  'Personalized weekly practice plans',
  'AI coach with real-time game knowledge',
  'Round and session logging',
  'Handicap tracking and progress monitoring',
  'Competitive leaderboard and badges',
  '7-day free trial',
];

const proFeatures = [
  'Everything in Basic',
  'Monthly Game Plan — personalized strategic roadmap updated every month',
  'Pre-Round Game Plan — tactical briefing from your coach before every round',
  'Weekly Performance Report — every Monday morning breakdown of your game',
  'Competitor Intel — see how your improvement compares to golfers at your level',
  'Deeper coach memory and context — your full history, not just recent sessions',
  '7-day free trial',
];

function PlanCard({ title, price, features, isPro }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className={`rounded-2xl p-8 md:p-10 relative ${
        isPro ? 'md:scale-105' : ''
      }`}
      style={{
        backgroundColor: isPro
          ? 'linear-gradient(135deg, rgba(168, 213, 162, 0.15), rgba(168, 213, 162, 0.05))'
          : 'rgba(249, 249, 247, 0.04)',
        border: `1px solid ${isPro ? 'rgba(168, 213, 162, 0.3)' : 'rgba(249, 249, 247, 0.08)'}`,
      }}
    >
      {isPro && (
        <div className="absolute -top-4 left-8 px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}>
          MOST POPULAR
        </div>
      )}

      <h3 className={`font-serif font-bold text-xl mb-2 ${isPro ? 'text-green-400' : 'text-white'}`}>
        {title}
      </h3>
      <div className="mb-6">
        <span className={`text-3xl md:text-4xl font-bold ${isPro ? 'text-green-400' : 'text-white'}`}>
          ${price}
        </span>
        <span className="text-white/60 text-sm ml-1">/ month</span>
      </div>

      <div className="space-y-3">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: isPro ? '#a8d5a2' : '#a8d5a2' }} />
            <p className="text-white/80 text-sm leading-relaxed">{feature}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function ComparisonSection() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12" style={{ backgroundColor: '#1a2e1a' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 md:mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-xs md:text-sm font-bold uppercase tracking-widest mb-2"
            style={{ color: '#a8d5a2' }}
          >
            The Value
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="font-serif font-bold text-4xl md:text-5xl text-white"
          >
            A better way to invest in your game
          </motion.h2>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <PlanCard title="Caddie AI Basic" price="15" features={basicFeatures} isPro={false} />
          <PlanCard title="Caddie AI Pro" price="29" features={proFeatures} isPro={true} />
        </div>
      </div>
    </section>
  );
}