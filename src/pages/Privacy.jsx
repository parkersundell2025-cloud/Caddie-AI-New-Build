import WelcomeNav from '@/components/welcome/WelcomeNav';
import WelcomeFooter from '@/components/welcome/WelcomeFooter';

const sections = [
  {
    title: 'Introduction',
    content: 'This Privacy Policy describes how Caddie AI ("Company", "we", "our", or "us") collects, uses, and shares your information when you use our mobile application and website ("Service").',
  },
  {
    title: 'Information We Collect',
    content: 'We collect information you provide directly:',
    items: [
      'Email address when joining the waitlist',
      'Account details when you create an account',
      'Golf performance data including rounds, scores, and practice session information',
      'Chat conversations with our AI coach',
    ],
    additionalContent: 'We also automatically collect:',
    items2: [
      'Device and app usage information',
      'Performance metrics and analytics',
      'IP address and general location data',
    ],
  },
  {
    title: 'How We Use Your Information',
    content: 'We use the information we collect to:',
    items: [
      'Provide, maintain, and improve the Service',
      'Send you updates and promotional materials',
      'Personalize your AI coaching experience',
      'Analyze usage patterns to enhance features',
      'Comply with legal obligations',
    ],
  },
  {
    title: 'How We Share Your Information',
    content: 'We may share your information with:',
    items: [
      'Service providers who assist with payment processing, data analysis, and hosting',
      'Other users on our leaderboard (anonymous handicap and improvement data only)',
      'Legal authorities when required by law',
      'In the event of a business transfer or acquisition',
    ],
  },
  {
    title: 'Data Retention',
    content: 'We retain your personal information as long as your account is active or as needed to provide the Service. You may request deletion of your data by contacting us.',
  },
  {
    title: 'Security',
    content: 'We implement appropriate technical and organizational measures to protect your information. However, no method of transmission over the internet is 100% secure.',
  },
  {
    title: "Children's Privacy",
    content: 'Our Service is not directed to children under 13. We do not knowingly collect information from children under 13. If we become aware of such collection, we will delete the information promptly.',
  },
  {
    title: 'Your Rights',
    content: 'Depending on your location, you may have rights to:',
    items: [
      'Access your personal information',
      'Correct inaccurate data',
      'Request deletion of your data',
      'Opt-out of marketing communications',
    ],
  },
  {
    title: 'Third Party Services',
    content: 'We use the following third-party services:',
    items: [
      'Stripe for payment processing',
      'Apple App Store and Google Play for distribution',
      'Base44 for backend infrastructure',
    ],
  },
  {
    title: 'Changes to This Policy',
    content: 'We may update this Privacy Policy periodically. We will notify you of significant changes by updating the "effective date" at the top of this policy.',
  },
  {
    title: 'Contact Us',
    content: 'If you have questions about this Privacy Policy, please contact us at support@caddieaiapp.com.',
  },
];

export default function Privacy() {
  return (
    <div style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7', minHeight: '100vh' }} className="flex flex-col">
      <WelcomeNav />
      
      <main className="flex-1 pt-24 md:pt-32 pb-20 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-serif font-bold text-4xl md:text-5xl mb-2">Privacy Policy</h1>
          <p className="text-white/60 text-sm mb-12">Last updated: April 2026</p>

          <div className="space-y-8 md:space-y-12">
            {sections.map((section, idx) => (
              <div key={idx} className="pb-8 border-b" style={{ borderColor: 'rgba(249, 249, 247, 0.08)' }}>
                <h2 className="font-serif font-bold text-2xl md:text-3xl mb-4" style={{ color: '#a8d5a2' }}>
                  {section.title}
                </h2>
                <p className="text-white/80 mb-4 leading-relaxed">{section.content}</p>
                {section.items && (
                  <ul className="space-y-2 ml-4 mb-4">
                    {section.items.map((item, i) => (
                      <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                        <span className="flex-shrink-0 mt-1.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.additionalContent && (
                  <p className="text-white/80 mb-4 leading-relaxed">{section.additionalContent}</p>
                )}
                {section.items2 && (
                  <ul className="space-y-2 ml-4">
                    {section.items2.map((item, i) => (
                      <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                        <span className="flex-shrink-0 mt-1.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <WelcomeFooter />
    </div>
  );
}