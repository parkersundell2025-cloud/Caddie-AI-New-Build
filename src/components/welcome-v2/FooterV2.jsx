import { Link } from 'react-router-dom';
import { L, LandingWordmark } from './shared';

const navLinks = [
  { l: 'Features', href: '#toolkit' },
  { l: 'Pricing', href: '#pricing' },
  // Mock pointed Shop at a local merch HTML file that doesn't exist here
  { l: 'Shop', href: '#' },
  { l: 'Reviews', href: '#reviews' },
  { l: 'Founders', href: '#founders' },
];

const linkStyle = { fontSize: 13, color: L.inkSoft, fontWeight: 500, textDecoration: 'none' };

export default function FooterV2() {
  return (
    <footer className="px-5 pb-9 pt-12 md:px-10 md:pt-[60px]" style={{ borderTop: `1px solid ${L.cardBorder}`, background: L.bg }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="flex flex-col items-start gap-6 pb-9 md:flex-row md:items-center md:justify-between" style={{ borderBottom: `1px solid ${L.cardBorder}` }}>
          <LandingWordmark size={26} color={L.cream} />
          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {navLinks.map(item => (
              <a key={item.l} href={item.href} style={linkStyle}>{item.l}</a>
            ))}
            <Link to="/signin" style={linkStyle}>Sign in</Link>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 pt-7 md:flex-row md:items-center md:justify-between">
          <div style={{ fontSize: 12, color: L.inkMute }}>© 2026 Caddie AI. All rights reserved.</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12, color: L.inkMute }}>
            <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
