import WelcomeNav from '@/components/welcome/WelcomeNav';
import WelcomeFooter from '@/components/welcome/WelcomeFooter';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Google Play + App Store both require a public account-deletion page:
// it must name the app/developer, give clear steps to request deletion, and
// state what data is deleted vs. kept and any retention period. This page is
// linked from the Play "Data safety" Delete Account URL and is publicly
// reachable at https://caddieaiapp.com/delete-account.

const sections = [
  {
    title: 'Deleting your Caddie AI account',
    content:
      'This page explains how to request deletion of your Caddie AI account and the data associated with it. Caddie AI is operated by Caddie AI LLC. You can delete your account directly in the app, or by contacting us.',
  },
  {
    title: 'Delete your account in the app',
    content: 'The fastest way to delete your account and all associated data:',
    items: [
      'Open the Caddie AI app and sign in.',
      'Go to Settings → Manage Subscription.',
      'Tap "Delete Account".',
      'Confirm. Your account, all associated data, and any active subscription are permanently removed. This cannot be undone.',
    ],
  },
  {
    title: 'Request deletion by email',
    content:
      'If you cannot access the app, email us from the email address associated with your account and we will process the deletion:',
    items: [
      'Email: support@caddieaiapp.com',
      'Subject: "Delete my account"',
      'Include the email address you use to sign in so we can verify and locate your account.',
    ],
  },
  {
    title: 'What data is deleted',
    content:
      'When your account is deleted, we permanently remove the personal data we hold about you, including:',
    items: [
      'Your account and profile (name, email, profile photo).',
      'Your golf data — logged rounds, practice sessions, handicap history, and skill ratings.',
      'Your conversations with the AI coach and any generated practice plans and reports.',
      'Your leaderboard entries and badges.',
      'Your device push-notification tokens.',
    ],
  },
  {
    title: 'What is kept, and for how long',
    content:
      'A limited amount of data may be retained after account deletion where we are required to keep it or where it no longer identifies you:',
    items: [
      'Transaction and subscription records required for tax, accounting, and legal compliance may be retained for up to the period required by applicable law. Payment card details are never held by us — they are handled by Apple, Google, or Stripe under their own policies.',
      'Aggregated or anonymized data that no longer identifies you may be retained for analytics.',
      'Records we are legally obligated to keep, or that are needed to resolve disputes or enforce our agreements.',
    ],
  },
  {
    title: 'Timing',
    content:
      'In-app deletions take effect immediately. Email deletion requests are processed within 30 days of verification. If you have any questions, contact us at support@caddieaiapp.com.',
  },
];

export default function DeleteAccount() {
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <div style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7', minHeight: '100vh' }} className="flex flex-col">
      <WelcomeNav />

      <main className="flex-1 pt-24 md:pt-32 pb-20 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 mb-6 text-sm text-white/70 hover:text-white transition-colors active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-serif font-bold text-4xl md:text-5xl mb-2">Delete Your Account</h1>
          <p className="text-white/60 text-sm mb-12">Caddie AI · Account & data deletion</p>

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
              </div>
            ))}
          </div>
        </div>
      </main>

      <WelcomeFooter />
    </div>
  );
}
