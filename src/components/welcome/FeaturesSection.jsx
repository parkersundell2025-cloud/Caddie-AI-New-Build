import { motion } from 'framer-motion';
import { Target, Trophy, MessageCircle } from 'lucide-react';
import FeatureCard from './FeatureCard';

const features = [
  {
    title: 'Practice Plans That Get Harder As You Improve',
    description: 'Your weekly plan is built around your specific strengths and weaknesses. As you rate each drill the plan adapts — harder when you are clicking, scaled back when you are struggling. 70 drills across 6 categories. No two weeks are the same.',
    image: '/images/welcome/feature-1.png',
    icon: Target,
  },
  {
    title: 'Compete for Real Golf Gear Every Month',
    description: 'The leaderboard ranks every golfer based on how much they practice AND how much they improve — not just their handicap. It is a level playing field. Right now the top player wins a free month. As we grow the prizes get bigger — rangefinders, TaylorMade drivers and Caddie AI merch. New prize every month.',
    image: '/images/welcome/feature-2.png',
    icon: Trophy,
  },
  {
    title: 'A Coach That Learns Your Game Over Time',
    description: 'Your AI coach knows your handicap, every round you have logged, every drill you have rated and every skill area you are working on. The more you use Caddie AI the smarter your coach gets. Ask it anything — technique, strategy, what to work on next. Real advice based on your actual game. Available 24 hours a day.',
    image: '/images/welcome/feature-3.png',
    icon: MessageCircle,
  },
];

export default function FeaturesSection() {
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
            The Toolkit
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="font-serif font-bold text-4xl md:text-5xl text-white"
          >
            Everything your game needs
          </motion.h2>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}