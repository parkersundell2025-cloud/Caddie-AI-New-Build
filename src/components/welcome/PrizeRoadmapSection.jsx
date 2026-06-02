import { motion } from 'framer-motion';

const prizes = [
  {
    badge: 'NOW',
    badgeBg: '#a8d5a2',
    badgeText: '#1a2e1a',
    prize: '🏆 Free Month of Caddie AI',
    detail: 'Top ranked golfer every month wins a free month — automatically applied to their account',
  },
  {
    badge: 'COMING SOON',
    badgeBg: '#f59e0b',
    badgeText: '#1a2e1a',
    prize: '🧢 Caddie AI Merch Pack',
    detail: 'Branded hat, shirt and bag tag — rep the brand on the course',
  },
  {
    badge: 'GROWING',
    badgeBg: '#3b82f6',
    badgeText: '#ffffff',
    prize: '🔭 Premium Rangefinder',
    detail: 'A top rated golf rangefinder for the monthly champion',
  },
  {
    badge: 'SCALING',
    badgeBg: '#8b5cf6',
    badgeText: '#ffffff',
    prize: '🏌️ Tour Level Driver',
    detail: 'A brand new TaylorMade or Callaway driver — every single month',
  },
];

export default function PrizeRoadmapSection() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12" style={{ backgroundColor: '#142214' }}>
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-xs md:text-sm font-bold uppercase tracking-widest"
            style={{ color: '#a8d5a2' }}
          >
            The Prizes Get Bigger
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="font-serif font-bold text-4xl md:text-5xl text-white"
          >
            We are just getting started
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-white/60 text-base md:text-lg max-w-2xl mx-auto"
          >
            Right now our monthly leaderboard winner gets a free month of Caddie AI. As our community grows so do the prizes. Help us grow and the prizes grow with you.
          </motion.p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 scrollbar-none">
          {prizes.map((p, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="rounded-2xl p-6 space-y-3 flex-shrink-0 w-64 md:w-auto"
              style={{ backgroundColor: 'rgba(249,249,247,0.04)', border: '1px solid rgba(249,249,247,0.08)' }}
            >
              <span
                className="inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ backgroundColor: p.badgeBg, color: p.badgeText }}
              >
                {p.badge}
              </span>
              <p className="text-white font-bold text-lg">{p.prize}</p>
              <p className="text-white/55 text-sm leading-relaxed">{p.detail}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center text-white/50 text-sm"
        >
          Prize upgrades are tied to subscriber milestones. Every referral gets us closer. Refer a friend after joining and earn a free month while helping unlock bigger prizes for everyone.
        </motion.p>
      </div>
    </section>
  );
}