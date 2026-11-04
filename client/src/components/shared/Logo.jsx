import React from 'react';
import { Link } from 'react-router-dom';

export const Logo = ({ size = 'md', showTagline = true, to = '/' }) => {
  const sizeClasses = {
    sm: {
      topper: 'text-2xl',
      batch: 'text-xl px-2 py-0.5',
      tagline: 'text-[10px]',
      bolt: 'w-4 h-4',
    },
    md: {
      topper: 'text-3xl sm:text-4xl',
      batch: 'text-2xl sm:text-3xl px-2.5 py-1',
      tagline: 'text-xs',
      bolt: 'w-5 h-5',
    },
    lg: {
      topper: 'text-5xl sm:text-6xl',
      batch: 'text-4xl sm:text-5xl px-4 py-2',
      tagline: 'text-sm sm:text-base',
      bolt: 'w-7 h-7',
    },
  };

  const current = sizeClasses[size] || sizeClasses.md;

  const content = (
    <div className="inline-flex flex-col items-start select-none group cursor-pointer">
      <div className="flex items-center gap-1.5 font-heading uppercase tracking-wider">
        <span
          className={`${current.topper} font-black text-ink tracking-tight drop-shadow-[2px_2px_0px_#B8B0A0] transition-transform group-hover:scale-105`}
        >
          TOPPER
        </span>
        <span
          className={`${current.batch} font-comic bg-comic-yellow text-ink border-[3px] border-ink rounded-md shadow-[3px_3px_0px_#171510] -rotate-3 transition-transform group-hover:rotate-0 group-hover:scale-110 flex items-center gap-1`}
        >
          BATCH
          <svg
            className={`${current.bolt} text-punch-red fill-current`}
            viewBox="0 0 24 24"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </span>
      </div>
      {showTagline && (
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className={`${current.tagline} font-comic uppercase tracking-wider bg-punch-red text-cream px-2 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] font-bold rotate-1`}
          >
            ISS SEM, 9 POINTER FIX!
          </span>
        </div>
      )}
    </div>
  );

  if (to) {
    return <Link to={to} className="no-underline">{content}</Link>;
  }

  return content;
};

export default Logo;

