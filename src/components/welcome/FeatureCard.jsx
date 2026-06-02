import { motion } from 'framer-motion';

export default function FeatureCard({ title, description, image, icon: Icon, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      viewport={{ once: true, margin: '-100px' }}
      className="flex flex-col"
    >
      <div className="relative h-48 md:h-56 rounded-2xl overflow-hidden mb-4 group">
        <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-black/70" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 213, 162, 0.2)' }}>
            <Icon className="w-6 h-6 md:w-8 md:h-8" style={{ color: '#a8d5a2' }} />
          </div>
        </div>
      </div>
      <h3 className="font-serif font-bold text-lg md:text-xl text-white mb-2 text-center md:text-left">{title}</h3>
      <p className="text-white/70 text-sm leading-relaxed text-center md:text-left">{description}</p>
    </motion.div>
  );
}