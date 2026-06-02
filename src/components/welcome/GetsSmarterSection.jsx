import { motion } from 'framer-motion';

const milestones = [
  {
    icon: '🏌️',
    title: 'Week 1',
    body: 'Your practice plan is built around your onboarding data. Your coach learns your goals, your handicap and your weakest areas.',
  },
  {
    icon: '📈',
    title: 'Month 1',
    body: 'Your drills start adapting based on your ratings. Your coach references specific sessions and rounds in its advice. Your handicap tracker shows real movement.',
  },
  {
    icon: '🏆',
    title: 'Month 3',
    body: 'Your coach has deep context on your game. Your skill profile shows clear trends. You are competing on the leaderboard and your drills are significantly more advanced than when you started.',
  },
  {
    icon: '🎯',
    title: 'Month 6+',
    body: 'Your coach knows your game better than most playing partners. Your practice is fully personalized. You are a measurably better golfer.',
  },
];

export default function GetsSmarterSection() {
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
            Built to Improve With You
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="font-serif font-bold text-4xl md:text-5xl text-white mb-4"
          >
            The more you use it the smarter it gets
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-white/60 text-base md:text-lg max-w-2xl mx-auto"
          >
            Caddie AI is not a static app. Every session you complete, every round you log and every drill you rate makes your coaching more personalized.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {milestones.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="rounded-2xl p-6 space-y-3"
              style={{ backgroundColor: 'rgba(249,249,247,0.04)', border: '1px solid rgba(249,249,247,0.08)' }}
            >
              <div className="text-3xl">{m.icon}</div>
              <h3 className="text-white font-bold text-xl">{m.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{m.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}