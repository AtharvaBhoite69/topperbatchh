import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/shared/Logo';
import ComicButton from '../components/ui/ComicButton';
import ComicCard from '../components/ui/ComicCard';
import { Starburst, ComicBadge } from '../components/ui/ComicElements';
import { BookOpen, Bot, Zap, Trophy, MessageCircle, FileText, ArrowRight, ShieldCheck, Flame } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col font-sans selection:bg-comic-yellow selection:text-ink">
      {/* Top Navbar */}
      <header className="border-b-[4px] border-ink bg-cream/90 backdrop-blur-xs sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-[0px_4px_0px_#171510]">
        <Logo size="md" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login">
            <ComicButton variant="white" size="sm">
              LOGIN
            </ComicButton>
          </Link>
          <Link to="/register">
            <ComicButton variant="yellow" size="sm">
              JOIN THE BATCH!
            </ComicButton>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 py-12 sm:py-20 max-w-6xl mx-auto text-center comic-halftone-light flex flex-col items-center">
        {/* Presale-style Countdown badge from reference screenshot */}
        <div className="comic-box inline-flex items-center gap-3 bg-white px-4 py-2 mb-6">
          <span className="w-3 h-3 rounded-full bg-victory-green animate-ping" />
          <span className="font-comic text-xs sm:text-sm uppercase tracking-wider text-ink font-bold">
            STAGE 1 ACTIVE: SEMESTER EXAMS COUNTDOWN // 9-POINTER GUARANTEED
          </span>
        </div>

        {/* Big Impact Headline */}
        <h1 className="font-heading text-5xl sm:text-7xl lg:text-8xl uppercase tracking-tight text-ink leading-none max-w-4xl drop-shadow-[4px_4px_0px_#B8B0A0]">
          THE PRIVATE BATCH COMMUNITY THAT <span className="text-punch-red underline decoration-comic-yellow decoration-wavy">PUNCHES</span> ABOVE ITS WEIGHT.
        </h1>

        <p className="font-sans text-base sm:text-xl text-vintage-olive max-w-2xl mt-6 font-medium">
          Say goodbye to boring college portals. TopperBatch combines previous year question banks,
          RAG-powered AI PDF answers, daily MCQ competition arenas, and private batch discussions.
        </p>

        {/* Big Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Link to="/register">
            <ComicButton variant="yellow" size="lg" icon={<Zap className="w-5 h-5 text-punch-red fill-punch-red" />}>
              CLAIM YOUR SPOT NOW!
            </ComicButton>
          </Link>
          <Link to="/login">
            <ComicButton variant="olive" size="lg">
              ALREADY IN? ENTER ARENA
            </ComicButton>
          </Link>
        </div>

        {/* Reference-style Presale Progress Card */}
        <div className="mt-12 w-full max-w-xl comic-box p-6 bg-white relative">
          <div className="absolute -top-3.5 right-4 bg-punch-red text-cream font-comic text-xs uppercase px-3 py-0.5 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] -rotate-2">
            BATCH CAPACITY
          </div>

          <div className="flex justify-between items-center mb-2">
            <span className="font-comic text-sm uppercase text-ink">APPROVED STUDENT SEATS</span>
            <span className="font-heading text-sm text-punch-red">88% FILLED!</span>
          </div>

          {/* Halftone Progress bar */}
          <div className="w-full h-6 bg-cream border-[3px] border-ink rounded-full p-0.5 overflow-hidden shadow-[2px_2px_0px_#171510]">
            <div
              className="h-full bg-punch-red rounded-full comic-halftone-light flex items-center justify-center text-[10px] font-comic text-cream font-bold"
              style={{ width: '88%' }}
            >
              88% APPROVED
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 text-xs font-mono text-ink/70">
            <span>🎯 Target: 9.0+ SGPA</span>
            <span>⚡ Next MCQ Battle: Midnight</span>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="bg-vintage-olive text-cream py-16 px-4 sm:px-8 border-y-[4px] border-ink">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <ComicBadge variant="yellow" className="mb-3">
              ARSENAL LOADOUT
            </ComicBadge>
            <h2 className="font-heading text-4xl sm:text-5xl uppercase tracking-wide text-cream">
              EVERYTHING YOU NEED TO CRUSH THIS SEMESTER
            </h2>
            <p className="font-sans text-cream/80 max-w-xl mx-auto text-sm mt-2">
              Built by college toppers, for college students. No clutter, strictly high-yield academic weapons.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <ComicCard accent="yellow" className="bg-cream text-ink p-6">
              <div className="w-12 h-12 bg-comic-yellow border-[3px] border-ink rounded-md flex items-center justify-center mb-4 shadow-[3px_3px_0px_#171510]">
                <BookOpen className="w-6 h-6 text-ink" />
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wide mb-2 text-ink">
                Question Bank Vault
              </h3>
              <p className="font-sans text-xs text-ink/80 leading-relaxed font-medium">
                Organized semester-wise, subject-wise, and unit-wise. View previous year question papers in a secure, protected PDF viewer with page jump and notes.
              </p>
            </ComicCard>

            {/* Card 2 */}
            <ComicCard accent="red" className="bg-cream text-ink p-6">
              <div className="w-12 h-12 bg-punch-red border-[3px] border-ink rounded-md flex items-center justify-center mb-4 shadow-[3px_3px_0px_#171510] text-cream">
                <Bot className="w-6 h-6 text-cream" />
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wide mb-2 text-ink">
                AI Study Buddy
              </h3>
              <p className="font-sans text-xs text-ink/80 leading-relaxed font-medium">
                Ask questions like "Give me answer to Question 10 of DBMS Unit 2 QB". The AI cites exact PDF pages without hallucinating fake answers.
              </p>
            </ComicCard>

            {/* Card 3 */}
            <ComicCard accent="green" className="bg-cream text-ink p-6">
              <div className="w-12 h-12 bg-victory-green border-[3px] border-ink rounded-md flex items-center justify-center mb-4 shadow-[3px_3px_0px_#171510] text-cream">
                <Zap className="w-6 h-6 text-cream" />
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wide mb-2 text-ink">
                Daily MCQ Battle Arena
              </h3>
              <p className="font-sans text-xs text-ink/80 leading-relaxed font-medium">
                10 rapid questions every day from the syllabus. Server-side anti-cheat scoring, timer countdown, and instant streak points.
              </p>
            </ComicCard>

            {/* Card 4 */}
            <ComicCard accent="yellow" className="bg-cream text-ink p-6">
              <div className="w-12 h-12 bg-comic-yellow border-[3px] border-ink rounded-md flex items-center justify-center mb-4 shadow-[3px_3px_0px_#171510]">
                <Trophy className="w-6 h-6 text-ink" />
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wide mb-2 text-ink">
                Live Leaderboard
              </h3>
              <p className="font-sans text-xs text-ink/80 leading-relaxed font-medium">
                Daily, weekly, and all-time batch rankings. Top 3 podium, tiebreakers on time and accuracy, and achievement badges.
              </p>
            </ComicCard>

            {/* Card 5 */}
            <ComicCard accent="red" className="bg-cream text-ink p-6">
              <div className="w-12 h-12 bg-punch-red border-[3px] border-ink rounded-md flex items-center justify-center mb-4 shadow-[3px_3px_0px_#171510] text-cream">
                <MessageCircle className="w-6 h-6 text-cream" />
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wide mb-2 text-ink">
                Discord-Style Community
              </h3>
              <p className="font-sans text-xs text-ink/80 leading-relaxed font-medium">
                Real-time channels for Programming, DBMS, Exam Discussions, and Projects. Live typing indicators, emoji reactions, and thread replies.
              </p>
            </ComicCard>

            {/* Card 6 */}
            <ComicCard accent="green" className="bg-cream text-ink p-6">
              <div className="w-12 h-12 bg-victory-green border-[3px] border-ink rounded-md flex items-center justify-center mb-4 shadow-[3px_3px_0px_#171510] text-cream">
                <ShieldCheck className="w-6 h-6 text-cream" />
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wide mb-2 text-ink">
                100% Private Community
              </h3>
              <p className="font-sans text-xs text-ink/80 leading-relaxed font-medium">
                Strict admin verification for every registration, single active session enforcement, and deterrent watermarks on protected materials.
              </p>
            </ComicCard>
          </div>
        </div>
      </section>

      {/* How it Works / 4 Steps */}
      <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto text-center">
        <ComicBadge variant="red" className="mb-3">
          MISSION BLUEPRINT
        </ComicBadge>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase tracking-wide mb-10">
          HOW TO SECURE YOUR 9 POINTER
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="comic-box p-6 bg-white relative">
            <span className="font-comic text-4xl text-punch-red font-black absolute -top-4 -left-2 bg-comic-yellow px-2 py-0.5 border-2 border-ink rounded shadow-[2px_2px_0px_#171510]">
              #1
            </span>
            <h4 className="font-heading text-xl uppercase mt-2 mb-1">RECRUIT</h4>
            <p className="font-sans text-xs text-olive-dark font-medium">
              Register with your Gmail ID. Administrators verify your batch credentials.
            </p>
          </div>

          <div className="comic-box p-6 bg-white relative">
            <span className="font-comic text-4xl text-punch-red font-black absolute -top-4 -left-2 bg-comic-yellow px-2 py-0.5 border-2 border-ink rounded shadow-[2px_2px_0px_#171510]">
              #2
            </span>
            <h4 className="font-heading text-xl uppercase mt-2 mb-1">STUDY</h4>
            <p className="font-sans text-xs text-olive-dark font-medium">
              Read unit notes and question banks with our AI chatbot citing page numbers instantly.
            </p>
          </div>

          <div className="comic-box p-6 bg-white relative">
            <span className="font-comic text-4xl text-punch-red font-black absolute -top-4 -left-2 bg-comic-yellow px-2 py-0.5 border-2 border-ink rounded shadow-[2px_2px_0px_#171510]">
              #3
            </span>
            <h4 className="font-heading text-xl uppercase mt-2 mb-1">BATTLE</h4>
            <p className="font-sans text-xs text-olive-dark font-medium">
              Compete in the 10-question daily challenge against your batchmates before midnight.
            </p>
          </div>

          <div className="comic-box p-6 bg-white relative">
            <span className="font-comic text-4xl text-punch-red font-black absolute -top-4 -left-2 bg-comic-yellow px-2 py-0.5 border-2 border-ink rounded shadow-[2px_2px_0px_#171510]">
              #4
            </span>
            <h4 className="font-heading text-xl uppercase mt-2 mb-1">TOP</h4>
            <p className="font-sans text-xs text-olive-dark font-medium">
              Earn badges, maintain your daily study streak, and ace your semester exam papers!
            </p>
          </div>
        </div>

        {/* Big Bottom Call to Action */}
        <div className="comic-box-lg bg-comic-yellow p-8 sm:p-12 mt-16 text-center relative overflow-hidden">
          <div className="comic-starburst bg-punch-red text-cream absolute -top-6 -right-6 rotate-12 scale-90 sm:scale-100">
            9.0+ SGPA!
          </div>

          <h3 className="font-heading text-4xl sm:text-6xl uppercase tracking-tight text-ink mb-4">
            READY TO LEVEL UP YOUR BATCH?
          </h3>
          <p className="font-sans text-sm sm:text-base text-ink/80 max-w-lg mx-auto mb-8 font-semibold">
            Join TopperBatch today. Your batch. Your rules. Iss sem, 9 pointer fix!
          </p>

          <Link to="/register">
            <ComicButton variant="red" size="lg" icon={<ArrowRight className="w-5 h-5" />}>
              JOIN TOPPERBATCH NOW!
            </ComicButton>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t-[4px] border-ink bg-cream p-6 text-center text-xs font-mono text-ink/70">
        <p className="font-heading text-sm text-ink mb-1">
          TOPPERBATCH © 2026 // "ISS SEM, 9 POINTER FIX!"
        </p>
        <p>A private, high-performance community for college students.</p>
      </footer>
    </div>
  );
};

export default Landing;

