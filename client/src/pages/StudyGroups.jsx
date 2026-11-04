import React from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../components/ui/ComicButton';
import { Users, MessageCircle } from 'lucide-react';

export const StudyGroups = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 text-center select-none py-8">
      <div className="comic-box-lg bg-cream p-8">
        <div className="w-16 h-16 bg-victory-green text-cream border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#171510]">
          <Users className="w-8 h-8" />
        </div>

        <span className="font-comic text-xs uppercase bg-comic-yellow text-ink px-3 py-1 rounded border border-ink shadow-[2px_2px_0px_#171510] inline-block mb-3">
          SQUAD COLLABORATION
        </span>

        <h1 className="font-heading text-4xl sm:text-5xl uppercase tracking-tight text-ink mb-3">
          BATCH STUDY SQUADS
        </h1>

        <p className="font-sans text-xs sm:text-sm text-vintage-olive max-w-lg mx-auto mb-6 font-medium leading-relaxed">
          Form 4-to-6 member study squads to prepare together, pool notes, and challenge other peer squads in subject wars.
          In the meantime, coordinate with your batch in the Community Channels!
        </p>

        <Link to="/community">
          <ComicButton variant="yellow" size="md" icon={<MessageCircle className="w-4 h-4" />}>
            OPEN BATCH COMMUNITY CHANNELS
          </ComicButton>
        </Link>
      </div>
    </div>
  );
};

export default StudyGroups;

