import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../components/ui/ComicButton';
import ComicCard from '../components/ui/ComicCard';
import { ComicBadge, Starburst } from '../components/ui/ComicElements';
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  AlertCircle,
  Building,
  GraduationCap
} from 'lucide-react';

/**
 * AIML Semester V Examination Timetable Calendar
 * University of Mumbai (NEP-2020, Winter 2026)
 * Strictly 5 Verified AIML Subjects.
 */
export const ExamPlanner = () => {
  // Exactly 5 verified official AIML Semester V examinations
  const AIML_EXAMS = [
    {
      id: 'exam-1',
      date: 16,
      dateString: '2026-11-16',
      dayOfWeek: 'Monday',
      fullDate: '16 November 2026',
      subject: 'Statistics for Machine Learning and Data Science',
      shortSubject: 'Statistics for ML & Data Science',
      paperCode: '2165111',
      time: '02:30 PM to 04:30 PM',
      duration: '2 Hours (120 Mins)',
      reportingTime: '02:00 PM',
      category: 'Core Course (PCC)',
      accent: 'yellow',
      bgClass: 'bg-comic-yellow/15 border-comic-yellow',
      badgeClass: 'bg-comic-yellow text-ink'
    },
    {
      id: 'exam-2',
      date: 18,
      dateString: '2026-11-18',
      dayOfWeek: 'Wednesday',
      fullDate: '18 November 2026',
      subject: 'Artificial Intelligence and Soft Computing',
      shortSubject: 'AI & Soft Computing',
      paperCode: '2165112',
      time: '02:30 PM to 04:30 PM',
      duration: '2 Hours (120 Mins)',
      reportingTime: '02:00 PM',
      category: 'Core Course (PCC)',
      accent: 'red',
      bgClass: 'bg-punch-red/15 border-punch-red',
      badgeClass: 'bg-punch-red text-cream'
    },
    {
      id: 'exam-3',
      date: 20,
      dateString: '2026-11-20',
      dayOfWeek: 'Friday',
      fullDate: '20 November 2026',
      subject: 'Agile Software Development and DevOps',
      shortSubject: 'Agile & DevOps',
      paperCode: '2165113',
      time: '02:30 PM to 04:30 PM',
      duration: '2 Hours (120 Mins)',
      reportingTime: '02:00 PM',
      category: 'Core Course (PCC)',
      accent: 'green',
      bgClass: 'bg-victory-green/15 border-victory-green',
      badgeClass: 'bg-victory-green text-cream'
    },
    {
      id: 'exam-4',
      date: 23,
      dateString: '2026-11-23',
      dayOfWeek: 'Monday',
      fullDate: '23 November 2026',
      subject: 'Web and Mobile Application Development',
      shortSubject: 'Web & Mobile App Dev',
      paperCode: '2165141',
      time: '02:30 PM to 04:30 PM',
      duration: '2 Hours (120 Mins)',
      reportingTime: '02:00 PM',
      category: 'Program Core / Elective',
      accent: 'cyan',
      bgClass: 'bg-sky-500/15 border-sky-600',
      badgeClass: 'bg-sky-600 text-cream'
    },
    {
      id: 'exam-5',
      date: 26,
      dateString: '2026-11-26',
      dayOfWeek: 'Thursday',
      fullDate: '26 November 2026',
      subject: 'MDM – Wireless and Mobile Communication',
      shortSubject: 'MDM: Wireless & Mobile Comm',
      paperCode: '23052111',
      time: '02:30 PM to 04:30 PM',
      duration: '2 Hours (120 Mins)',
      reportingTime: '02:00 PM',
      category: 'Multidisciplinary Minor (MDM)',
      accent: 'olive',
      bgClass: 'bg-vintage-olive/20 border-vintage-olive',
      badgeClass: 'bg-vintage-olive text-cream'
    }
  ];

  // Selected date for detailed view (default: first exam 16 Nov)
  const [selectedDate, setSelectedDate] = useState(16);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'

  // Live countdown state
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isTargetPassed: false
  });

  // Calculate live countdown to first exam (16 Nov 2026, 14:30:00 IST)
  useEffect(() => {
    const targetDate = new Date('2026-11-16T14:30:00+05:30').getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, isTargetPassed: true });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds, isTargetPassed: false });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // November 2026 days generation (Monday to Sunday layout)
  // Nov 1, 2026 is Sunday. In Mon-to-Sun layout, column 0 is Mon, column 6 is Sun.
  // Hence 6 leading blanks (Oct 26 - Oct 31)
  const leadingBlanks = [
    { day: 26, isPrevMonth: true },
    { day: 27, isPrevMonth: true },
    { day: 28, isPrevMonth: true },
    { day: 29, isPrevMonth: true },
    { day: 30, isPrevMonth: true },
    { day: 31, isPrevMonth: true },
  ];

  // 30 days in November
  const novemberDays = Array.from({ length: 30 }, (_, i) => i + 1);

  // Trailing blanks to complete the last row (30 Nov is Monday, so 6 trailing days Dec 1 - Dec 6)
  const trailingBlanks = [
    { day: 1, isNextMonth: true },
    { day: 2, isNextMonth: true },
    { day: 3, isNextMonth: true },
    { day: 4, isNextMonth: true },
    { day: 5, isNextMonth: true },
    { day: 6, isNextMonth: true },
  ];

  const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const getExamForDate = (dateNum) => {
    return AIML_EXAMS.find((e) => e.date === dateNum) || null;
  };

  const selectedExam = getExamForDate(selectedDate);

  return (
    <div className="space-y-6 text-left select-none pb-12">
      {/* Official Header Banner */}
      <div className="comic-box-lg bg-cream p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="font-comic text-xs uppercase bg-punch-red text-cream px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" /> UNIVERSITY OF MUMBAI
              </span>
              <span className="font-comic text-xs uppercase bg-comic-yellow text-ink px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] flex items-center gap-1.5 font-bold">
                <GraduationCap className="w-3.5 h-3.5" /> NEP-2020 • WINTER 2026
              </span>
              <span className="font-comic text-xs uppercase bg-victory-green text-cream px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510]">
                EXACTLY 5 EXAMS VERIFIED ✓
              </span>
            </div>

            <h1 className="font-heading text-3xl sm:text-5xl uppercase tracking-tight text-ink leading-none">
              B.E. AIML SEMESTER V EXAM CALENDAR
            </h1>

            <p className="font-sans text-xs sm:text-sm text-vintage-olive mt-2 font-medium">
              Programme: <strong className="text-ink">B.E. Computer Science and Engineering (Artificial Intelligence & Machine Learning)</strong>.
              All exams scheduled from <strong className="text-punch-red font-bold">02:30 PM to 04:30 PM</strong>. Reporting time: 02:00 PM.
            </p>
          </div>

          {/* Presale-Style Reference Countdown Box from Screenshot */}
          <div className="comic-box bg-white p-4 w-full sm:w-auto min-w-[280px] shadow-[6px_6px_0px_#171510] relative flex-shrink-0">
            <div className="absolute -top-3.5 right-3 bg-punch-red text-cream font-comic text-xs uppercase px-2.5 py-0.5 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] rotate-1">
              FIRST PAPER ALERT!
            </div>

            <div className="text-center mb-2">
              <span className="font-comic text-xs text-ink uppercase tracking-wider font-bold">
                STAGE 1 COUNTDOWN (16 NOV)
              </span>
            </div>

            {/* Reference Screenshot 4-Box Digital Timer */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
              <div className="bg-ink text-comic-yellow p-2 rounded border border-ink">
                <div className="font-heading text-xl sm:text-2xl leading-none font-bold">
                  {String(countdown.days).padStart(2, '0')}
                </div>
                <div className="font-mono text-[9px] text-cream/70 uppercase mt-0.5">DAYS</div>
              </div>

              <div className="bg-ink text-comic-yellow p-2 rounded border border-ink">
                <div className="font-heading text-xl sm:text-2xl leading-none font-bold">
                  {String(countdown.hours).padStart(2, '0')}
                </div>
                <div className="font-mono text-[9px] text-cream/70 uppercase mt-0.5">HRS</div>
              </div>

              <div className="bg-ink text-comic-yellow p-2 rounded border border-ink">
                <div className="font-heading text-xl sm:text-2xl leading-none font-bold">
                  {String(countdown.minutes).padStart(2, '0')}
                </div>
                <div className="font-mono text-[9px] text-cream/70 uppercase mt-0.5">MIN</div>
              </div>

              <div className="bg-ink text-punch-red p-2 rounded border border-ink">
                <div className="font-heading text-xl sm:text-2xl leading-none font-bold animate-pulse">
                  {String(countdown.seconds).padStart(2, '0')}
                </div>
                <div className="font-mono text-[9px] text-cream/70 uppercase mt-0.5">SEC</div>
              </div>
            </div>

            <div className="mt-2.5 text-center">
              <span className="font-mono text-[10px] text-olive-dark font-bold">
                🎯 Stat for ML & Data Science • 02:30 PM
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation & Controls Bar */}
      <div className="comic-box bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-comic-yellow text-ink border-2 border-ink flex items-center justify-center font-heading text-xl shadow-[2px_2px_0px_#171510]">
            11
          </div>
          <div>
            <h2 className="font-heading text-2xl uppercase tracking-wide text-ink">
              NOVEMBER 2026
            </h2>
            <span className="font-comic text-xs text-olive-dark">
              MONDAY TO SUNDAY LAYOUT • 5 PAPERS SCHEDULED
            </span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`comic-btn comic-btn-sm ${
              viewMode === 'calendar' ? 'comic-btn-yellow' : 'comic-btn-white'
            }`}
          >
            MONTH CALENDAR
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`comic-btn comic-btn-sm ${
              viewMode === 'list' ? 'comic-btn-yellow' : 'comic-btn-white'
            }`}
          >
            5 PAPERS ROSTER
          </button>
        </div>
      </div>

      {/* Main View: Month Calendar (Monday-to-Sunday) */}
      {viewMode === 'calendar' && (
        <div className="comic-box-lg bg-cream p-4 sm:p-6 overflow-hidden">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
            {daysOfWeek.map((day, idx) => (
              <div
                key={day}
                className={`py-2 px-1 rounded font-comic text-xs sm:text-sm uppercase font-bold border-2 border-ink shadow-[2px_2px_0px_#171510] ${
                  idx >= 5 ? 'bg-vintage-olive text-cream' : 'bg-white text-ink'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Leading blanks (Oct 26-31) */}
            {leadingBlanks.map((item, idx) => (
              <div
                key={`blank-prev-${idx}`}
                className="min-h-[70px] sm:min-h-[105px] p-1.5 sm:p-2 bg-cream/30 border-2 border-dashed border-ink/20 rounded opacity-40 select-none flex flex-col justify-between"
              >
                <span className="font-mono text-xs text-ink/40 font-bold">{item.day}</span>
                <span className="font-mono text-[9px] text-ink/30 hidden sm:block">OCT</span>
              </div>
            ))}

            {/* November Days 1 to 30 */}
            {novemberDays.map((day) => {
              const exam = getExamForDate(day);
              const isSelected = selectedDate === day;

              if (exam) {
                // Exam Day Card
                return (
                  <div
                    key={`nov-${day}`}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[90px] sm:min-h-[125px] p-1.5 sm:p-2.5 rounded border-[3px] border-ink cursor-pointer transition-all flex flex-col justify-between relative group ${
                      exam.bgClass
                    } ${
                      isSelected
                        ? 'shadow-[5px_5px_0px_#F0442E] scale-[1.02] ring-2 ring-punch-red z-10'
                        : 'shadow-[3px_3px_0px_#171510] hover:shadow-[5px_5px_0px_#171510] hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Top Sticker */}
                    <div className="flex items-start justify-between gap-1">
                      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-ink text-comic-yellow border border-ink flex items-center justify-center font-heading text-xs sm:text-sm font-bold shadow-[1px_1px_0px_#171510]">
                        {day}
                      </span>
                      <span className="font-comic text-[8px] sm:text-[10px] bg-punch-red text-cream px-1 sm:px-1.5 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510] uppercase tracking-wider font-bold">
                        EXAM DAY!
                      </span>
                    </div>

                    {/* Subject info */}
                    <div className="my-1">
                      <div className="font-heading text-[11px] sm:text-xs text-ink uppercase tracking-tight leading-tight line-clamp-2 sm:line-clamp-none font-bold">
                        {exam.shortSubject}
                      </div>
                      <div className="font-mono text-[9px] sm:text-[10px] text-punch-red font-bold mt-0.5">
                        CODE: {exam.paperCode}
                      </div>
                    </div>

                    {/* Time Pill */}
                    <div className="bg-white/90 border border-ink rounded px-1 py-0.5 text-center shadow-[1px_1px_0px_#171510]">
                      <span className="font-mono text-[9px] sm:text-[10px] text-ink font-bold block">
                        02:30 – 04:30 PM
                      </span>
                    </div>
                  </div>
                );
              }

              // Non-Exam Day Card
              return (
                <div
                  key={`nov-${day}`}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[70px] sm:min-h-[105px] p-1.5 sm:p-2 rounded border-2 border-ink cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white border-ink shadow-[4px_4px_0px_#171510] ring-2 ring-comic-yellow'
                      : 'bg-white/80 hover:bg-white shadow-[2px_2px_0px_#171510]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm text-ink font-bold">{day}</span>
                    <span className="font-comic text-[9px] text-vintage-olive uppercase hidden sm:block">
                      NOV
                    </span>
                  </div>

                  <div className="my-auto text-center">
                    <span className="font-comic text-[9px] text-ink/40 uppercase hidden sm:inline-block">
                      NO EXAM
                    </span>
                  </div>

                  <div className="text-[8px] font-mono text-ink/30 text-right">
                    —
                  </div>
                </div>
              );
            })}

            {/* Trailing blanks (Dec 1-6) */}
            {trailingBlanks.map((item, idx) => (
              <div
                key={`blank-next-${idx}`}
                className="min-h-[70px] sm:min-h-[105px] p-1.5 sm:p-2 bg-cream/30 border-2 border-dashed border-ink/20 rounded opacity-40 select-none flex flex-col justify-between"
              >
                <span className="font-mono text-xs text-ink/40 font-bold">{item.day}</span>
                <span className="font-mono text-[9px] text-ink/30 hidden sm:block">DEC</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Date Inspector Card */}
      <div className="comic-box-lg bg-white p-5 sm:p-7 relative border-[4px] border-ink shadow-[6px_6px_0px_#171510]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-ink/20 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-comic-yellow border-[3px] border-ink rounded-lg flex items-center justify-center font-heading text-2xl shadow-[3px_3px_0px_#171510]">
              {selectedDate}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-comic text-xs uppercase bg-ink text-comic-yellow px-2 py-0.5 rounded border border-ink font-bold">
                  DATE INSPECTOR
                </span>
                <span className="font-heading text-sm uppercase text-ink">
                  {selectedExam ? selectedExam.fullDate : `${selectedDate} November 2026`}
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl uppercase tracking-wide text-ink mt-0.5">
                {selectedExam ? selectedExam.subject : 'No Official Examination Scheduled'}
              </h3>
            </div>
          </div>

          {selectedExam ? (
            <div className="comic-badge comic-badge-red text-xs sm:text-sm px-3 py-1">
              OFFICIAL PAPER #{AIML_EXAMS.findIndex((e) => e.date === selectedDate) + 1} OF 5
            </div>
          ) : (
            <div className="comic-badge comic-badge-yellow text-xs px-3 py-1">
              REVISION / PREPARATION DAY
            </div>
          )}
        </div>

        {selectedExam ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                PAPER CODE
              </span>
              <span className="font-mono text-lg font-bold text-punch-red">
                {selectedExam.paperCode}
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">Official University Code</div>
            </div>

            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                EXAMINATION TIMING
              </span>
              <span className="font-heading text-lg font-bold text-ink">
                02:30 PM – 04:30 PM
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">Duration: 2 Hours</div>
            </div>

            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                MANDATORY REPORTING
              </span>
              <span className="font-heading text-lg font-bold text-victory-green">
                02:00 PM SHARP
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">30 Mins Prior to Exam</div>
            </div>

            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                COURSE CATEGORY
              </span>
              <span className="font-heading text-base font-bold text-ink">
                {selectedExam.category}
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">AIML Sem V NEP-2020</div>
            </div>
          </div>
        ) : (
          <div className="bg-cream/60 p-4 rounded border-2 border-dashed border-ink/40 text-center">
            <p className="font-sans text-xs sm:text-sm text-olive-dark font-medium">
              No examination scheduled on this date. Use this day for high-yield formula review, previous year question bank analysis, and mock test drills.
            </p>
          </div>
        )}
      </div>

      {/* The 5 Verified Examinations Chronological Roster */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-punch-red" />
            <h2 className="font-heading text-2xl uppercase tracking-wide text-ink">
              OFFICIAL 5-EXAMINATION TIMETABLE
            </h2>
          </div>
          <span className="font-mono text-xs text-olive-dark font-bold">
            EXCLUSIVELY B.E. AIML SEMESTER V
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {AIML_EXAMS.map((exam, idx) => (
            <div
              key={exam.id}
              onClick={() => setSelectedDate(exam.date)}
              className={`comic-box p-4 sm:p-5 cursor-pointer transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                selectedDate === exam.date
                  ? 'bg-comic-yellow/20 border-ink shadow-[5px_5px_0px_#171510] -translate-y-0.5'
                  : 'bg-white hover:bg-cream/40 border-ink shadow-[3px_3px_0px_#171510]'
              }`}
            >
              {/* Left: Sequence Number & Date */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-md bg-ink text-cream border-2 border-ink flex flex-col items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_#171510]">
                  <span className="font-comic text-[10px] text-comic-yellow">EXAM</span>
                  <span className="font-heading text-lg leading-none font-bold">#{idx + 1}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-comic text-xs uppercase px-2 py-0.5 rounded border border-ink font-bold bg-punch-red text-cream">
                      {exam.dayOfWeek}, {exam.date} NOV 2026
                    </span>
                    <span className="font-mono text-xs bg-cream px-2 py-0.5 rounded border border-ink text-ink font-bold">
                      CODE: {exam.paperCode}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg sm:text-xl uppercase tracking-wide text-ink mt-1">
                    {exam.subject}
                  </h3>

                  <div className="font-sans text-xs text-olive-dark font-medium">
                    Category: {exam.category} • University of Mumbai (Winter 2026)
                  </div>
                </div>
              </div>

              {/* Right: Timing Pill & Action */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-ink/20">
                <div className="text-right">
                  <div className="flex items-center gap-1 font-heading text-sm sm:text-base text-ink">
                    <Clock className="w-4 h-4 text-punch-red" />
                    <span>02:30 PM – 04:30 PM</span>
                  </div>
                  <span className="font-mono text-[10px] text-olive-dark block">
                    Report by 02:00 PM (2h Paper)
                  </span>
                </div>

                <ComicButton
                  variant={selectedDate === exam.date ? 'yellow' : 'white'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(exam.date);
                  }}
                >
                  {selectedDate === exam.date ? 'INSPECTING' : 'VIEW'}
                </ComicButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* University Regulations & Instructions Box */}
      <div className="comic-box bg-cream p-5 text-left border-[3px] border-ink">
        <div className="flex items-center gap-2 mb-2 text-punch-red font-bold font-comic text-sm uppercase">
          <AlertCircle className="w-4 h-4" /> OFFICIAL UNIVERSITY EXAMINATION DIRECTIVES (NEP-2020)
        </div>
        <ul className="font-sans text-xs text-ink/80 space-y-1.5 font-medium list-disc list-inside">
          <li><strong>Mandatory Reporting:</strong> All candidates must report to their respective examination hall by <strong>02:00 PM</strong> (30 minutes prior to paper commencement).</li>
          <li><strong>Restricted Items:</strong> Mobile phones, smart watches, programmable calculators, and unauthorized digital devices are strictly prohibited.</li>
          <li><strong>Exclusive AIML Roster:</strong> User Experience Design with VR, Computer Network, and Mechanical Engineering subjects are excluded from this calendar.</li>
          <li><strong>Hall Ticket:</strong> Physical hall ticket along with college student identity card is compulsory for admission to all 5 examinations.</li>
        </ul>
      </div>
    </div>
  );
};

export default ExamPlanner;
