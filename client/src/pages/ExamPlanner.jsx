import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { calendar as calendarApi } from '../services/api';
import ComicButton from '../components/ui/ComicButton';
import ComicCard from '../components/ui/ComicCard';
import { ComicBadge } from '../components/ui/ComicElements';
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  AlertCircle,
  Building,
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEPARTMENTS = [
  'AI & ML',
  'Computer Science',
  'Information Tech',
  'Data Science',
  'Electronics',
  'Computer Engineering',
  'All Departments',
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const CATEGORIES = [
  'Core Course (PCC)',
  'Program Core / Elective',
  'Multidisciplinary Minor (MDM)',
  'Open Elective',
  'Audit Course',
  'Practical / Viva',
];

const ACCENTS = [
  { id: 'yellow', label: 'Yellow (Standard)', bg: 'bg-comic-yellow/15 border-comic-yellow', badge: 'bg-comic-yellow text-ink' },
  { id: 'red', label: 'Red (High Priority)', bg: 'bg-punch-red/15 border-punch-red', badge: 'bg-punch-red text-cream' },
  { id: 'green', label: 'Green (Milestone)', bg: 'bg-victory-green/15 border-victory-green', badge: 'bg-victory-green text-cream' },
  { id: 'cyan', label: 'Cyan (Elective)', bg: 'bg-sky-500/15 border-sky-600', badge: 'bg-sky-600 text-cream' },
  { id: 'olive', label: 'Olive (Minor/MDM)', bg: 'bg-vintage-olive/20 border-vintage-olive', badge: 'bg-vintage-olive text-cream' },
];

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const ExamPlanner = () => {
  const { user, isAdmin } = useAuth();

  // Role-based Department & Semester Selection
  const [selectedDept, setSelectedDept] = useState(user?.department || 'AI & ML');
  const [selectedSem, setSelectedSem] = useState(parseInt(user?.semester, 10) || 5);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar month/year navigation (Default: Nov 2026 for MU Winter Exam session)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 0-indexed: 10 = November
  const [selectedDateStr, setSelectedDateStr] = useState('2026-11-16');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'

  // Admin Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalForm, setModalForm] = useState({
    department: 'AI & ML',
    semester: 5,
    subject: '',
    short_subject: '',
    paper_code: '',
    exam_date: '2026-11-16',
    start_time: '02:30 PM',
    end_time: '04:30 PM',
    reporting_time: '02:00 PM',
    duration: '2 Hours (120 Mins)',
    category: 'Core Course (PCC)',
    accent: 'yellow',
  });

  // Fetch events from API
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (isAdmin) {
        if (selectedDept && selectedDept !== 'All Departments') {
          params.department = selectedDept;
        }
        if (selectedSem) {
          params.semester = selectedSem;
        }
      }
      const res = await calendarApi.getEvents(params);
      if (res.data?.success) {
        const list = res.data.events || [];
        setEvents(list);

        // If events exist, default view to the month of the first event
        if (list.length > 0) {
          const firstDate = new Date(list[0].exam_date);
          if (!isNaN(firstDate.getTime())) {
            setCurrentYear(firstDate.getFullYear());
            setCurrentMonth(firstDate.getMonth());
            setSelectedDateStr(list[0].exam_date);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load exam calendar:', err);
      toast.error('Failed to load exam calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedDept, selectedSem, isAdmin]);

  // Find next upcoming exam for countdown
  const nextUpcomingExam = useMemo(() => {
    if (!events.length) return null;
    const now = new Date().getTime();
    const sorted = [...events].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
    // Find first exam whose end time hasn't passed
    const upcoming = sorted.find((e) => {
      const examTime = new Date(`${e.exam_date}T16:30:00+05:30`).getTime();
      return examTime > now;
    });
    return upcoming || sorted[0];
  }, [events]);

  // Live countdown state
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isTargetPassed: false,
  });

  useEffect(() => {
    if (!nextUpcomingExam) return;

    const targetTime = new Date(`${nextUpcomingExam.exam_date}T14:30:00+05:30`).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

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
  }, [nextUpcomingExam]);

  // Calendar Math: Monday-to-Sunday layout
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const leading = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      leading.push({
        day: prevMonthDays - i,
        isPrevMonth: true,
      });
    }

    const current = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const exam = events.find((e) => e.exam_date === dateStr);
      current.push({
        day,
        dateStr,
        exam,
      });
    }

    const totalCells = leading.length + current.length;
    const trailingCount = (7 - (totalCells % 7)) % 7;
    const trailing = [];
    for (let i = 1; i <= trailingCount; i++) {
      trailing.push({
        day: i,
        isNextMonth: true,
      });
    }

    return { leading, current, trailing };
  }, [currentYear, currentMonth, events]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const selectedExam = events.find((e) => e.exam_date === selectedDateStr);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingEvent(null);
    setModalForm({
      department: selectedDept === 'All Departments' ? 'AI & ML' : selectedDept,
      semester: selectedSem || 5,
      subject: '',
      short_subject: '',
      paper_code: '',
      exam_date: selectedDateStr || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-16`,
      start_time: '02:30 PM',
      end_time: '04:30 PM',
      reporting_time: '02:00 PM',
      duration: '2 Hours (120 Mins)',
      category: 'Core Course (PCC)',
      accent: 'yellow',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exam) => {
    setEditingEvent(exam);
    setModalForm({
      department: exam.department || 'AI & ML',
      semester: exam.semester || 5,
      subject: exam.subject || '',
      short_subject: exam.short_subject || exam.subject || '',
      paper_code: exam.paper_code || '',
      exam_date: exam.exam_date || '',
      start_time: exam.start_time || '02:30 PM',
      end_time: exam.end_time || '04:30 PM',
      reporting_time: exam.reporting_time || '02:00 PM',
      duration: exam.duration || '2 Hours (120 Mins)',
      category: exam.category || 'Core Course (PCC)',
      accent: exam.accent || 'yellow',
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!modalForm.subject.trim() || !modalForm.exam_date) {
      toast.error('Subject and Exam Date are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingEvent) {
        const res = await calendarApi.updateEvent(editingEvent.id, modalForm);
        if (res.data?.success) {
          toast.success(res.data.message || 'Exam updated successfully!');
          setIsModalOpen(false);
          fetchEvents();
        }
      } else {
        const res = await calendarApi.createEvent(modalForm);
        if (res.data?.success) {
          toast.success(res.data.message || 'Exam scheduled successfully!');
          setIsModalOpen(false);
          fetchEvents();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save exam schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (examId, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the exam timetable?`)) {
      return;
    }
    try {
      const res = await calendarApi.deleteEvent(examId);
      if (res.data?.success) {
        toast.success(res.data.message || 'Exam removed.');
        fetchEvents();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete exam.');
    }
  };

  const getAccentConfig = (accentId) => {
    return ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  };

  return (
    <div className="space-y-6 text-left select-none pb-12 selection:bg-comic-yellow selection:text-ink">
      {/* Official Header Banner */}
      <div className="comic-box-lg bg-cream p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="font-comic text-xs uppercase bg-punch-red text-cream px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] flex items-center gap-1.5 font-bold">
                <Building className="w-3.5 h-3.5" /> UNIVERSITY OF MUMBAI
              </span>
              <span className="font-comic text-xs uppercase bg-comic-yellow text-ink px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] flex items-center gap-1.5 font-bold">
                <GraduationCap className="w-3.5 h-3.5" /> NEP-2020 • WINTER 2026
              </span>
              <span className="font-comic text-xs uppercase bg-victory-green text-cream px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] font-bold">
                {events.length} PAPERS SCHEDULED ✓
              </span>
            </div>

            <h1 className="font-heading text-3xl sm:text-5xl uppercase tracking-tight text-ink leading-none">
              B.E. {selectedDept === 'All Departments' ? 'ALL DEPTS' : selectedDept} SEMESTER {selectedSem} CALENDAR
            </h1>

            <p className="font-sans text-xs sm:text-sm text-vintage-olive mt-2 font-medium">
              Timetable for <strong className="text-ink">B.E. {selectedDept} (Semester {selectedSem})</strong>.
              All exams scheduled with mandatory reporting 30 minutes prior. Timings verified per official exam cell notifications.
            </p>
          </div>

          {/* Countdown Box */}
          <div className="comic-box bg-white p-4 w-full sm:w-auto min-w-[280px] shadow-[6px_6px_0px_#171510] relative flex-shrink-0">
            <div className="absolute -top-3.5 right-3 bg-punch-red text-cream font-comic text-xs uppercase px-2.5 py-0.5 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] rotate-1 font-bold">
              {countdown.isTargetPassed ? 'STAGE CONCLUDED' : 'NEXT PAPER COUNTDOWN!'}
            </div>

            <div className="text-center mb-2">
              <span className="font-comic text-xs text-ink uppercase tracking-wider font-bold">
                {nextUpcomingExam
                  ? `${nextUpcomingExam.short_subject || nextUpcomingExam.subject} (${nextUpcomingExam.exam_date})`
                  : 'EXAMINATION STAGE'}
              </span>
            </div>

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
                🎯 {nextUpcomingExam ? `${nextUpcomingExam.start_time || '02:30 PM'} Start` : 'Ready for battle'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Controls Panel (Manage Any Department & Semester) */}
      {isAdmin && (
        <div className="comic-box bg-white p-4 sm:p-5 border-[3px] border-ink shadow-[4px_4px_0px_#171510]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b-2 border-ink/15">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-punch-red" />
              <div>
                <h3 className="font-heading text-base sm:text-lg uppercase tracking-wide text-ink font-bold">
                  ADMIN TIMETABLE CONTROL // ASSIGN & EDIT BY DEPARTMENT
                </h3>
                <span className="font-sans text-xs text-vintage-olive">
                  Admins can add, edit, or adjust exam dates and times for any engineering department.
                </span>
              </div>
            </div>

            <ComicButton
              variant="yellow"
              size="sm"
              onClick={handleOpenAddModal}
              icon={<Plus className="w-4 h-4 text-punch-red" />}
            >
              + ADD EXAM PAPER
            </ComicButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                SWITCH DEPARTMENT CALENDAR:
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="comic-input text-xs sm:text-sm bg-white font-bold"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                SWITCH SEMESTER:
              </label>
              <select
                value={selectedSem}
                onChange={(e) => setSelectedSem(parseInt(e.target.value, 10))}
                className="comic-input text-xs sm:text-sm bg-white font-bold"
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Month Navigation & View Switcher */}
      <div className="comic-box bg-white p-4 flex flex-wrap items-center justify-between gap-3 shadow-[3px_3px_0px_#171510]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="comic-btn comic-btn-white p-2 text-ink hover:bg-comic-yellow"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="comic-btn comic-btn-white p-2 text-ink hover:bg-comic-yellow"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="font-heading text-2xl uppercase tracking-wide text-ink">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <span className="font-comic text-xs text-olive-dark">
              MONDAY TO SUNDAY LAYOUT • {events.length} EXAMS SCHEDULED
            </span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`comic-btn comic-btn-sm ${
              viewMode === 'calendar' ? 'comic-btn-yellow font-bold' : 'comic-btn-white'
            }`}
          >
            MONTH CALENDAR
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`comic-btn comic-btn-sm ${
              viewMode === 'list' ? 'comic-btn-yellow font-bold' : 'comic-btn-white'
            }`}
          >
            EXAMS ROSTER ({events.length})
          </button>
        </div>
      </div>

      {/* Empty State Warning if No Exams in Dept */}
      {!loading && events.length === 0 && (
        <div className="comic-box p-6 bg-white border-dashed text-center">
          <CalendarIcon className="w-10 h-10 text-vintage-olive mx-auto mb-2 opacity-50" />
          <h4 className="font-heading text-lg uppercase text-ink">
            NO EXAMS CURRENTLY SCHEDULED
          </h4>
          <p className="font-sans text-xs text-olive-dark max-w-md mx-auto mt-1">
            {isAdmin
              ? `No exam timetable has been uploaded for ${selectedDept} Semester ${selectedSem} yet. Click "+ Add Exam Paper" above to schedule papers!`
              : `No examination timetable has been announced yet for ${selectedDept} Semester ${selectedSem}. Rest easy and stay focused on daily MCQ battles.`}
          </p>
          {isAdmin && (
            <div className="mt-3">
              <ComicButton variant="yellow" size="sm" onClick={handleOpenAddModal}>
                + SCHEDULE FIRST PAPER
              </ComicButton>
            </div>
          )}
        </div>
      )}

      {/* Main View: Month Calendar (Monday-to-Sunday) */}
      {viewMode === 'calendar' && (
        <div className="comic-box-lg bg-cream p-4 sm:p-6 overflow-hidden shadow-[6px_6px_0px_#171510]">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
            {DAYS_OF_WEEK.map((day, idx) => (
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
            {/* Leading blanks */}
            {calendarDays.leading.map((item, idx) => (
              <div
                key={`blank-prev-${idx}`}
                className="min-h-[70px] sm:min-h-[105px] p-1.5 sm:p-2 bg-cream/30 border-2 border-dashed border-ink/20 rounded opacity-40 select-none flex flex-col justify-between"
              >
                <span className="font-mono text-xs text-ink/40 font-bold">{item.day}</span>
              </div>
            ))}

            {/* Current Month Days */}
            {calendarDays.current.map(({ day, dateStr, exam }) => {
              const isSelected = selectedDateStr === dateStr;
              const accentCfg = exam ? getAccentConfig(exam.accent) : null;

              if (exam) {
                // Exam Day Card
                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`min-h-[90px] sm:min-h-[125px] p-1.5 sm:p-2.5 rounded border-[3px] border-ink cursor-pointer transition-all flex flex-col justify-between relative group ${
                      accentCfg ? accentCfg.bg : 'bg-comic-yellow/15'
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
                        EXAM!
                      </span>
                    </div>

                    {/* Subject info */}
                    <div className="my-1">
                      <div className="font-heading text-[11px] sm:text-xs text-ink uppercase tracking-tight leading-tight line-clamp-2 font-bold">
                        {exam.short_subject || exam.subject}
                      </div>
                      {exam.paper_code && (
                        <div className="font-mono text-[9px] sm:text-[10px] text-punch-red font-bold mt-0.5">
                          CODE: {exam.paper_code}
                        </div>
                      )}
                    </div>

                    {/* Time Pill */}
                    <div className="bg-white/90 border border-ink rounded px-1 py-0.5 text-center shadow-[1px_1px_0px_#171510] flex items-center justify-between">
                      <span className="font-mono text-[9px] sm:text-[10px] text-ink font-bold block truncate">
                        {exam.start_time || '02:30 PM'}
                      </span>
                      {isAdmin && (
                        <span className="text-[9px] text-punch-red font-comic font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          EDIT
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Non-Exam Day Card
              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`min-h-[70px] sm:min-h-[105px] p-1.5 sm:p-2 rounded border-2 border-ink cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white border-ink shadow-[4px_4px_0px_#171510] ring-2 ring-comic-yellow'
                      : 'bg-white/80 hover:bg-white shadow-[2px_2px_0px_#171510]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm text-ink font-bold">{day}</span>
                    <span className="font-comic text-[9px] text-vintage-olive uppercase hidden sm:block">
                      {MONTH_NAMES[currentMonth].slice(0, 3)}
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

            {/* Trailing blanks */}
            {calendarDays.trailing.map((item, idx) => (
              <div
                key={`blank-next-${idx}`}
                className="min-h-[70px] sm:min-h-[105px] p-1.5 sm:p-2 bg-cream/30 border-2 border-dashed border-ink/20 rounded opacity-40 select-none flex flex-col justify-between"
              >
                <span className="font-mono text-xs text-ink/40 font-bold">{item.day}</span>
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
              {selectedDateStr ? parseInt(selectedDateStr.split('-')[2], 10) : 16}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-comic text-xs uppercase bg-ink text-comic-yellow px-2 py-0.5 rounded border border-ink font-bold">
                  DATE INSPECTOR
                </span>
                <span className="font-heading text-sm uppercase text-ink">
                  {selectedDateStr}
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl uppercase tracking-wide text-ink mt-0.5">
                {selectedExam ? selectedExam.subject : 'No Official Examination Scheduled'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedExam ? (
              <>
                <div className="comic-badge comic-badge-red text-xs sm:text-sm px-3 py-1 font-bold">
                  OFFICIAL PAPER ({selectedExam.department} SEM {selectedExam.semester})
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => handleOpenEditModal(selectedExam)}
                      className="comic-btn comic-btn-yellow text-xs px-2.5 py-1 flex items-center gap-1 font-comic"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> EDIT
                    </button>
                    <button
                      onClick={() => handleDeleteExam(selectedExam.id, selectedExam.short_subject || selectedExam.subject)}
                      className="comic-btn comic-btn-red text-xs px-2.5 py-1 flex items-center gap-1 font-comic"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> DELETE
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="comic-badge comic-badge-yellow text-xs px-3 py-1 font-bold">
                  REVISION / PREPARATION DAY
                </div>
                {isAdmin && (
                  <button
                    onClick={handleOpenAddModal}
                    className="comic-btn comic-btn-yellow text-xs px-2.5 py-1 flex items-center gap-1 font-comic"
                  >
                    <Plus className="w-3.5 h-3.5" /> SCHEDULE EXAM ON THIS DATE
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {selectedExam ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                PAPER CODE
              </span>
              <span className="font-mono text-lg font-bold text-punch-red">
                {selectedExam.paper_code || 'N/A'}
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">Official University Code</div>
            </div>

            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                EXAMINATION TIMING
              </span>
              <span className="font-heading text-lg font-bold text-ink">
                {selectedExam.start_time} – {selectedExam.end_time}
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">{selectedExam.duration}</div>
            </div>

            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                MANDATORY REPORTING
              </span>
              <span className="font-heading text-lg font-bold text-victory-green">
                {selectedExam.reporting_time || '02:00 PM'} SHARP
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">30 Mins Prior to Exam</div>
            </div>

            <div className="comic-box bg-cream p-3 text-left">
              <span className="font-comic text-[11px] text-olive-dark uppercase font-bold block mb-1">
                COURSE CATEGORY
              </span>
              <span className="font-heading text-base font-bold text-ink">
                {selectedExam.category || 'Core Course'}
              </span>
              <div className="text-[10px] font-mono text-ink/70 mt-1">{selectedExam.department} Sem {selectedExam.semester}</div>
            </div>
          </div>
        ) : (
          <div className="bg-cream/60 p-4 rounded border-2 border-dashed border-ink/40 text-center">
            <p className="font-sans text-xs sm:text-sm text-olive-dark font-medium">
              No examination scheduled on this date. Use this day for formula revision, high-yield question bank reading, and daily MCQ battles.
            </p>
          </div>
        )}
      </div>

      {/* Chronological Roster List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-punch-red" />
            <h2 className="font-heading text-2xl uppercase tracking-wide text-ink">
              EXAMINATION TIMETABLE ROSTER ({events.length} PAPERS)
            </h2>
          </div>
          <span className="font-mono text-xs text-olive-dark font-bold">
            {selectedDept} • SEMESTER {selectedSem}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {events.map((exam, idx) => {
            const isSelected = selectedDateStr === exam.exam_date;
            return (
              <div
                key={exam.id}
                onClick={() => setSelectedDateStr(exam.exam_date)}
                className={`comic-box p-4 sm:p-5 cursor-pointer transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-comic text-xs uppercase px-2 py-0.5 rounded border border-ink font-bold bg-punch-red text-cream">
                        {exam.exam_date}
                      </span>
                      {exam.paper_code && (
                        <span className="font-mono text-xs bg-cream px-2 py-0.5 rounded border border-ink text-ink font-bold">
                          CODE: {exam.paper_code}
                        </span>
                      )}
                      <span className="font-comic text-[11px] bg-comic-yellow/40 text-ink px-2 py-0.5 rounded border border-ink/40 font-bold">
                        {exam.category}
                      </span>
                    </div>

                    <h3 className="font-heading text-lg sm:text-xl uppercase tracking-wide text-ink mt-1">
                      {exam.subject}
                    </h3>

                    <div className="flex items-center gap-3 text-xs font-mono text-olive-dark mt-0.5">
                      <span className="flex items-center gap-1 font-bold text-ink">
                        <Clock className="w-3.5 h-3.5 text-punch-red" />
                        {exam.start_time} – {exam.end_time} ({exam.duration})
                      </span>
                      <span>•</span>
                      <span>Reporting: {exam.reporting_time}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Link
                    to="/question-bank"
                    className="comic-btn comic-btn-white text-xs px-3 py-1.5 font-comic flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5 text-punch-red" />
                    VAULT QBs
                  </Link>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(exam);
                        }}
                        className="comic-btn comic-btn-yellow text-xs px-2.5 py-1.5 font-comic"
                        title="Edit exam details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExam(exam.id, exam.short_subject || exam.subject);
                        }}
                        className="comic-btn comic-btn-red text-xs px-2.5 py-1.5 font-comic"
                        title="Delete exam"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin Add/Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="comic-box-lg bg-cream border-[4px] border-ink shadow-[10px_10px_0px_#171510] max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-ink/20">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-punch-red" />
                <h3 className="font-heading text-xl uppercase tracking-wide text-ink font-bold">
                  {editingEvent ? 'EDIT EXAM PAPER' : 'SCHEDULE NEW EXAM PAPER'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-comic text-punch-red font-bold hover:underline"
              >
                ✕ CLOSE
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    TARGET DEPARTMENT:
                  </label>
                  <select
                    value={modalForm.department}
                    onChange={(e) => setModalForm({ ...modalForm, department: e.target.value })}
                    className="comic-input text-xs sm:text-sm bg-white font-bold"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept === 'All Departments' ? 'All' : dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    TARGET SEMESTER:
                  </label>
                  <select
                    value={modalForm.semester}
                    onChange={(e) => setModalForm({ ...modalForm, semester: parseInt(e.target.value, 10) })}
                    className="comic-input text-xs sm:text-sm bg-white font-bold"
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  FULL SUBJECT NAME:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Computing & Cloud Infrastructure"
                  value={modalForm.subject}
                  onChange={(e) => setModalForm({ ...modalForm, subject: e.target.value })}
                  className="comic-input text-xs sm:text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    SHORT SUBJECT (FOR CALENDAR TILE):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cloud Computing"
                    value={modalForm.short_subject}
                    onChange={(e) => setModalForm({ ...modalForm, short_subject: e.target.value })}
                    className="comic-input text-xs sm:text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    UNIVERSITY PAPER CODE:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2165114"
                    value={modalForm.paper_code}
                    onChange={(e) => setModalForm({ ...modalForm, paper_code: e.target.value })}
                    className="comic-input text-xs sm:text-sm bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    EXAMINATION DATE:
                  </label>
                  <input
                    type="date"
                    required
                    value={modalForm.exam_date}
                    onChange={(e) => setModalForm({ ...modalForm, exam_date: e.target.value })}
                    className="comic-input text-xs sm:text-sm bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    COURSE CATEGORY:
                  </label>
                  <select
                    value={modalForm.category}
                    onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                    className="comic-input text-xs sm:text-sm bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    START TIME:
                  </label>
                  <input
                    type="text"
                    value={modalForm.start_time}
                    onChange={(e) => setModalForm({ ...modalForm, start_time: e.target.value })}
                    className="comic-input text-xs bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    END TIME:
                  </label>
                  <input
                    type="text"
                    value={modalForm.end_time}
                    onChange={(e) => setModalForm({ ...modalForm, end_time: e.target.value })}
                    className="comic-input text-xs bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    REPORTING TIME:
                  </label>
                  <input
                    type="text"
                    value={modalForm.reporting_time}
                    onChange={(e) => setModalForm({ ...modalForm, reporting_time: e.target.value })}
                    className="comic-input text-xs bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  TILE COLOR ACCENT:
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {ACCENTS.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setModalForm({ ...modalForm, accent: acc.id })}
                      className={`p-2 rounded border-2 text-center font-comic text-[11px] uppercase transition-all ${
                        modalForm.accent === acc.id
                          ? 'border-ink bg-white font-bold shadow-[2px_2px_0px_#171510] -translate-y-0.5'
                          : 'border-ink/30 bg-white/60 opacity-70'
                      }`}
                    >
                      <span className={`block w-4 h-4 rounded-full mx-auto mb-1 ${acc.badge}`}></span>
                      {acc.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t-2 border-ink/20 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="comic-btn comic-btn-white text-xs px-4 py-2 font-comic"
                >
                  CANCEL
                </button>

                <ComicButton
                  type="submit"
                  variant="yellow"
                  size="md"
                  loading={saving}
                  disabled={saving}
                  icon={<Check className="w-4 h-4 text-victory-green" />}
                >
                  {editingEvent ? 'SAVE CHANGES' : 'SCHEDULE PAPER'}
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamPlanner;
