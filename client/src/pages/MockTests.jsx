import React from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../components/ui/ComicButton';
import { FileQuestion, Zap, BookOpen } from 'lucide-react';

export const MockTests = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 text-center select-none py-8">
      <div className="comic-box-lg bg-cream p-8 relative overflow-hidden">
        <div className="w-16 h-16 bg-comic-yellow border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#171510] text-ink">
          <FileQuestion className="w-8 h-8" />
        </div>

        <span className="font-comic text-xs uppercase bg-punch-red text-cream px-3 py-1 rounded border border-ink shadow-[2px_2px_0px_#171510] inline-block mb-3">
          SEMESTER FINALS PREPARATION
        </span>

        <h1 className="font-heading text-4xl sm:text-5xl uppercase tracking-tight text-ink mb-3">
          FULL-LENGTH MOCK EXAM ARENA
        </h1>

        <p className="font-sans text-xs sm:text-sm text-vintage-olive max-w-lg mx-auto mb-6 font-medium leading-relaxed">
          Simulated 3-hour semester exam papers with full-length MCQ sections and descriptive answer evaluation.
          Currently in beta testing with batch topper squads!
        </p>

        <div className="comic-dashed-box max-w-md mx-auto mb-8 p-4 text-xs font-mono text-left bg-white">
          <div className="font-bold text-ink mb-1">AVAILABLE NOW:</div>
          <div>• Daily 10-Question MCQ Battles</div>
          <div>• Unit-wise Previous Year Question Banks</div>
          <div>• AI Question & Answer Solver</div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/daily-challenge">
            <ComicButton variant="red" size="md" icon={<Zap className="w-4 h-4 fill-current" />}>
              PLAY DAILY BATTLE
            </ComicButton>
          </Link>
          <Link to="/question-bank">
            <ComicButton variant="yellow" size="md" icon={<BookOpen className="w-4 h-4" />}>
              BROWSE QUESTION BANK
            </ComicButton>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MockTests;

