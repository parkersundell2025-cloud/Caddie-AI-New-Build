import { Link } from 'react-router-dom';
import { L, LandingWordmark, L_SANS } from './shared';

const links = [
  { l: 'Features', href: '#toolkit' },
  { l: 'Pricing', href: '#pricing' },
  // Mock pointed Shop at a local merch HTML file that doesn't exist here
  { l: 'Shop', href: '#' },
  { l: 'Reviews', href: '#reviews' },
  { l: 'Founders', href: '#founders' },
];

export default function NavV2() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(11,15,12,.78)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: `1px solid ${L.cardBorder}`,
      paddingTop: 'var(--sat, 0px)',
    }}>
      <div className="mx-auto flex h-[64px] max-w-[1400px] items-center px-5 md:h-[72px] md:px-10">
        <LandingWordmark size={22} color={L.cream} />
        <div style={{ flex: 1 }} />
        <div className="mr-7 hidden gap-7 md:flex">
          {links.map(item => (
            <a key={item.l} href={item.href} style={{
              fontSize: 13, color: 'rgba(244,239,227,.7)',
              fontWeight: 500, letterSpacing: -0.1, textDecoration: 'none',
            }}>{item.l}</a>
          ))}
        </div>
        <Link to="/signin" style={{
          padding: '10px 18px', background: 'transparent', color: L.cream,
          border: `1px solid ${L.cardBorder}`, borderRadius: 999,
          fontFamily: L_SANS, fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>Sign in</Link>
      </div>
    </nav>
  );
}
