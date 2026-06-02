import React from 'react';
import { useNavigate } from 'react-router-dom';

const FAQ = [
  { q: 'How is my score calculated?', a: 'Your monthly score combines Activity (40%) and Improvement (60%). Each logged round earns 3 points, each completed practice session earns 1 point. Improvement is measured as a percentage relative to your handicap at the start of the month.' },
  { q: 'What counts as a practice session?', a: 'Any practice session completed through the My Plan tab counts toward your score.' },
  { q: 'What counts as a logged round?', a: 'Any round logged through the app counts toward your score.' },
  { q: 'When does the leaderboard reset?', a: 'Rankings reset on the 1st of every month. Your badges and Hall of Fame entries never reset.' },
  { q: 'How is the monthly winner chosen?', a: 'The player with the highest combined activity and improvement score at the end of the month wins a free month of Caddie AI.' },
  { q: 'What happens if there\'s a tie?', a: 'The player with the longest current streak wins. If streaks are also tied, both players receive a free month.' },
  { q: 'How do I earn badges?', a: 'Badges are earned automatically when you hit the required milestone. You\'ll receive an in-app notification when you earn one.' },
  { q: 'Where is the Hall of Fame?', a: 'The Hall of Fame lives at the bottom of the Leaderboard screen and shows every monthly winner permanently.' },
  { q: 'Can free trial users see the leaderboard?', a: 'Free trial users can see the leaderboard but names and scores are blurred. Subscribe to appear on the leaderboard and compete for the monthly prize.' },
];

export default function LeaderboardInfo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 py-6 space-y-6">
        {/* Scoring */}
        <div className="card-base p-5 space-y-3">
          <h2 className="font-black text-foreground text-base">How Scoring Works</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your monthly score combines two things: <strong className="text-foreground">Activity (40%)</strong> and <strong className="text-foreground">Improvement (60%)</strong>.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
              <span className="text-xl">⛳</span>
              <div>
                <p className="font-bold text-foreground text-sm">Logged Round</p>
                <p className="text-xs text-muted-foreground">3 points</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
              <span className="text-xl">🏌️</span>
              <div>
                <p className="font-bold text-foreground text-sm">Completed Practice Session</p>
                <p className="text-xs text-muted-foreground">1 point</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
              <span className="text-xl">📈</span>
              <div>
                <p className="font-bold text-foreground text-sm">Handicap Improvement</p>
                <p className="text-xs text-muted-foreground">% improvement vs your month-start baseline × 60%</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A beginner improving by 4 strokes earns the same improvement score as a scratch golfer improving by 4 strokes. Everyone competes on a level playing field.
          </p>
        </div>

        {/* Tips */}
        <div className="card-base p-5 space-y-3">
          <h2 className="font-black text-foreground text-base">Tips to Improve Your Rank</h2>
          {[
            'Log every round you play — each one is worth 3 points',
            'Complete practice sessions consistently — they add up fast',
            'Focus on handicap improvement — it counts for 60% of your score',
            'Build a streak — it\'s your tiebreaker if scores are level',
            'The more consistent you are the higher you rank',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-foreground text-background text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-sm text-foreground leading-snug">{tip}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="card-base p-5 space-y-4">
          <h2 className="font-black text-foreground text-base">FAQ</h2>
          {FAQ.map((item, i) => (
            <div key={i} className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0">
              <p className="font-bold text-foreground text-sm">{item.q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}