import WelcomeNav from '@/components/welcome/WelcomeNav';
import HeroSection from '@/components/welcome/HeroSection';
import HowItWorksSection from '@/components/welcome/HowItWorksSection';
import FeaturesSection from '@/components/welcome/FeaturesSection';
import TestimonialsSection from '@/components/welcome/TestimonialsSection';
import FoundersSection from '@/components/welcome/FoundersSection';
import PrizeRoadmapSection from '@/components/welcome/PrizeRoadmapSection';
import ReferralSection from '@/components/welcome/ReferralSection';
import GetsSmarterSection from '@/components/welcome/GetsSmarterSection';
import ComparisonSection from '@/components/welcome/ComparisonSection';
import InstallAppSection from '@/components/welcome/InstallAppSection';
import BottomCTA from '@/components/welcome/BottomCTA';
import WelcomeFooter from '@/components/welcome/WelcomeFooter';

export default function Welcome() {
  return (
    <div style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}>
      <WelcomeNav />
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <GetsSmarterSection />
      <ComparisonSection />
      <TestimonialsSection />
      <FoundersSection />
      <PrizeRoadmapSection />
      <ReferralSection />
      <InstallAppSection />
      <BottomCTA />
      <WelcomeFooter />
    </div>
  );
}