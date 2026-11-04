import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/shared/Logo';
import ComicButton from '../components/ui/ComicButton';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center comic-halftone-light">
      <Logo size="lg" />

      <div className="comic-box-lg max-w-md w-full bg-white p-8 mt-8 space-y-4">
        <div className="font-heading text-8xl text-punch-red leading-none drop-shadow-[4px_4px_0px_#171510]">
          404
        </div>

        <h2 className="font-comic text-2xl uppercase tracking-wider text-ink">
          LOOKS LIKE THIS PAGE BUNKED CLASS!
        </h2>

        <p className="font-sans text-xs text-olive-dark font-medium leading-relaxed">
          The requested coordinate does not exist in the TopperBatch syllabus. Let's get you back to the arena.
        </p>

        <Link to="/dashboard" className="block pt-2">
          <ComicButton variant="yellow" size="md" className="w-full">
            RETURN TO DASHBOARD
          </ComicButton>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

