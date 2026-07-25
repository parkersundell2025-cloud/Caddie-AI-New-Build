import React, { useState } from 'react';

export default function RoundSetup({ onStart }) {
  const [courseName, setCourseName] = useState('');
  const [holes, setHoles] = useState(18);

  return (
    <div className="px-5 pt-2 flex flex-col gap-4">
      <div>
        <div className="cut-eyebrow text-cut-gold">New round</div>
        <h1 className="cut-headline text-[30px] text-cut-ink mt-2">
          Where are you <span className="italic text-cut-green">playing</span>?
        </h1>
      </div>

      <div className="cut-glass rounded-2xl p-4">
        <div className="cut-eyebrow text-cut-ink-mute mb-2.5">Course</div>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="Course name"
          className="w-full bg-cut-card-solid border border-white/10 rounded-xl px-4 py-3 text-[15px] text-cut-ink placeholder:text-cut-ink-mute outline-none focus:border-cut-green"
        />
      </div>

      <div className="cut-glass rounded-2xl p-4">
        <div className="cut-eyebrow text-cut-ink-mute mb-2.5">Holes</div>
        <div className="flex gap-2">
          {[9, 18].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setHoles(n)}
              className={`flex-1 py-4 rounded-[14px] text-lg font-bold transition-colors ${
                holes === n
                  ? 'bg-cut-green text-cut-bg shadow-[0_0_16px_rgba(95,190,126,.30)]'
                  : 'bg-cut-card-solid text-cut-ink-mute border border-white/10'
              }`}
            >
              {n} holes
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onStart(courseName.trim() || 'My course', holes)}
        className="w-full h-[54px] rounded-2xl bg-cut-green text-cut-bg text-[15px] font-bold shadow-[0_0_24px_rgba(95,190,126,.30)]"
      >
        Start round
      </button>
      <p className="text-center text-[11.5px] text-cut-ink-mute -mt-1">
        One screen per hole — score, fairway, green, putts. Saved when you finish.
      </p>
    </div>
  );
}
