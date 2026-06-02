import { motion } from 'framer-motion';

const PARKER_PHOTO = "https://drive.google.com/uc?export=view&id=1JnIqNDgZCpS2HCqYmBB5RQG90UoIIiMm";
const TEAGAN_PHOTO = "https://drive.google.com/uc?export=view&id=13Z00r7HPMThrahSq3eeb-xllpfo9jIpQ";

const founders = [
{
  name: 'Parker Sundell',
  title: 'Founder & CEO',
  photo: PARKER_PHOTO,
  bio: "Parker Sundell is a lifelong golfer from Michigan, currently playing to a 13 handicap. A self-taught builder and entrepreneur, Parker saw a gap in the golf world — fitness apps had transformed how athletes train, but golfers were still showing up to the range with no plan. He built Caddie AI to change that. As Founder of Caddie AI, Parker leads product development, technology, and company vision — building the app he always wished existed for his own game."
},
{
  name: 'Teagan Miller',
  title: 'Co-Founder & Head of Brand Growth',
  photo: TEAGAN_PHOTO,
  bio: "Teagan Miller is an ex-Division 1 golfer with 5 years of collegiate experience. Currently a swing coach at Conaway Golf Performance and golf content creator behind @tmillergolf. A former top 500 ranked junior golfer in the world, Teagan combines competitive experience with data-driven coaching to help players improve more efficiently. As Co-Founder of Caddie AI, Teagan helps shape the AI and software to provide proven, personalized practice plans for golfers of all skill levels."
}];


const photoStyle = {
  width: '150px',
  height: '150px',
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid #a8d5a2',
  display: 'block',
  margin: '0 auto 20px auto'
};

export default function FoundersSection() {
  return (
    <section className="py-24 px-6" style={{ backgroundColor: '#1a2e1a' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 space-y-3">
          
          <h2
            className="text-4xl sm:text-5xl font-black"
            style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}>
            
            Meet the Founders
          </h2>
          <p className="text-base" style={{ color: 'rgba(249,249,247,0.6)' }}>
            Built by golfers who understand the game
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Parker */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0 }}
            className="flex flex-col items-center text-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(168,213,162,0.2)',
              borderRadius: '16px',
              padding: '32px'
            }}>
            <img src="/images/welcome/founder-parker.jpg" alt="Parker Sundell" style={photoStyle} />
            <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}>Parker Sundell</h3>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#a8d5a2', letterSpacing: '0.08em' }}>Founder & CEO</p>
            <p className="text-sm text-left leading-relaxed" style={{ color: 'rgba(249,249,247,0.7)', lineHeight: '1.7' }}>
              Parker Sundell is a lifelong golfer from Michigan, currently playing to a 13 handicap. A self-taught builder and entrepreneur, Parker saw a gap in the golf world — fitness apps had transformed how athletes train, but golfers were still showing up to the range with no plan. He built Caddie AI to change that. As Founder of Caddie AI, Parker leads product development, technology, and company vision — building the app he always wished existed for his own game.
            </p>
          </motion.div>

          {/* Teagan */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-col items-center text-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(168,213,162,0.2)',
              borderRadius: '16px',
              padding: '32px'
            }}>
            <img src="/images/welcome/founder-teagan.jpg" alt="Teagan Miller" style={{ ...photoStyle, objectPosition: 'top' }} />
            <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}>Teagan Miller</h3>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#a8d5a2', letterSpacing: '0.08em' }}>Co-Founder & Head of Brand Growth</p>
            <p className="text-sm text-left leading-relaxed" style={{ color: 'rgba(249,249,247,0.7)', lineHeight: '1.7' }}>
              Teagan Miller is an ex-Division 1 golfer with 5 years of collegiate experience. Currently a swing coach at Conaway Golf Performance and golf content creator behind @tmillergolf. A former top 500 ranked junior golfer in the world, Teagan combines competitive experience with data-driven coaching to help players improve more efficiently. As Co-Founder of Caddie AI, Teagan helps shape the AI and software to provide proven, personalized practice plans for golfers of all skill levels.
            </p>
          </motion.div>

        </div>
      </div>
    </section>);

}