import NavV2 from '@/components/welcome-v2/NavV2';
import { captureCampaignFromUrl } from '@/lib/campaign';
import HeroV2 from '@/components/welcome-v2/HeroV2';
import HowItWorksV2 from '@/components/welcome-v2/HowItWorksV2';
import ToolkitV2 from '@/components/welcome-v2/ToolkitV2';
import SmarterOverTimeV2 from '@/components/welcome-v2/SmarterOverTimeV2';
import PricingV2 from '@/components/welcome-v2/PricingV2';
import TestimonialsV2 from '@/components/welcome-v2/TestimonialsV2';
import FoundersV2 from '@/components/welcome-v2/FoundersV2';
import PrizesV2 from '@/components/welcome-v2/PrizesV2';
import ReferralV2 from '@/components/welcome-v2/ReferralV2';
import InstallV2 from '@/components/welcome-v2/InstallV2';
import FinalCTAV2 from '@/components/welcome-v2/FinalCTAV2';
import FooterV2 from '@/components/welcome-v2/FooterV2';
import { L, L_SANS } from '@/components/welcome-v2/shared';

// Staged redesign of /welcome ("The Cut" design language). Paints its own
// dark ground rather than relying on the theme-cut html class so it stays
// self-contained no matter where it's routed from.
export default function WelcomeV2() {
  // Capture before children render — they compute store hrefs on first paint
  captureCampaignFromUrl();

  return (
    <div style={{ background: L.bg, minHeight: '100vh', color: L.ink, fontFamily: L_SANS }}>
      <NavV2 />
      <HeroV2 />
      <HowItWorksV2 />
      <ToolkitV2 />
      <SmarterOverTimeV2 />
      <PricingV2 />
      <TestimonialsV2 />
      <FoundersV2 />
      <PrizesV2 />
      <ReferralV2 />
      <InstallV2 />
      <FinalCTAV2 />
      <FooterV2 />
    </div>
  );
}
