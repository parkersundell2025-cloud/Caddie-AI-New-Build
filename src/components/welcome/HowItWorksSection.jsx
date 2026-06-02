import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    icon: '🏌️',
    title: 'Tell Us About Your Game',
    body: 'Answer a few quick questions about your handicap, goals and how often you can practice. Takes 2 minutes. Your personalized plan is ready immediately.',
  },
  {
    number: '02',
    icon: '📋',
    title: 'Practice With Purpose',
    body: 'Every session has specific drills targeting your exact weaknesses. Rate each drill after you complete it — Struggled, Okay, Good or Clicked — and your plan adapts automatically. The more you use it the smarter it gets.',
  },
  {
    number: '03',
    icon: '🏆',
    title: 'Compete and Win',
    body: 'Log your rounds, track your handicap and compete on the leaderboard. Top ranked golfer every month wins real prizes — free months, Caddie AI merch, rangefinders and eventually tour level drivers. The more you practice the higher you rank.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12" style={{ backgroundColor: '#142214' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-xs md:text-sm font-bold uppercase tracking-widest mb-2"
            style={{ color: '#a8d5a2' }}
          >
            Simple By Design
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="font-serif font-bold text-4xl md:text-5xl text-white"
          >
            Stop guessing what to practice in 3 steps
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              viewport={{ once: true }}
              className="rounded-2xl p-7 space-y-4"
              style={{ backgroundColor: 'rgba(249,249,247,0.04)', border: '1px solid rgba(249,249,247,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <span className="font-serif font-bold text-4xl" style={{ color: '#a8d5a2', opacity: 0.5 }}>{step.number}</span>
                <span className="text-3xl">{step.icon}</span>
              </div>
              <h3 className="text-white font-bold text-xl">{step.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}