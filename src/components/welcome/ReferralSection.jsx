import { motion } from 'framer-motion';

const stats = [
  '1 Referral = 1 Free Month',
  'No Limit On Earnings',
  'Automatic — No Codes Needed',
];

export default function ReferralSection() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12" style={{ backgroundColor: '#1a2e1a' }}>
      <div className="max-w-4xl mx-auto text-center space-y-10">
        <div className="space-y-4">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-xs md:text-sm font-bold uppercase tracking-widest"
            style={{ color: '#a8d5a2' }}
          >
            Earn Free Golf
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="font-serif font-bold text-4xl md:text-5xl text-white"
          >
            Refer a friend — get a free month
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-white/70 text-base md:text-lg max-w-2xl mx-auto"
          >
            Every golfer you refer who subscribes earns you one free month of Caddie AI. No limit. The more golfers you bring in the more free months you earn. Some of our members will never pay again.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="rounded-2xl px-6 py-5 text-center"
              style={{ backgroundColor: 'rgba(168,213,162,0.1)', border: '1px solid rgba(168,213,162,0.25)' }}
            >
              <p className="text-white font-bold text-base">{stat}</p>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-white/40 text-sm"
        >
          Referral tracking is built into the app. Share your unique link and we handle the rest.
        </motion.p>
      </div>
    </section>
  );
}