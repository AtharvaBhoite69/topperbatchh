import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, ShieldAlert, Sparkles } from 'lucide-react';
import ComicButton from '../ui/ComicButton';

/**
 * ScreenshotProtector & "Kya re bhik mangya!" Easter Egg Popup
 *
 * Listens for hardware / browser-exposed PrintScreen events and snipping shortcuts.
 * Does NOT falsely trigger on tab switching, window blur, or page visibility changes.
 */
export const ScreenshotProtector = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [countdown, setCountdown] = useState(7);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const userInteractedRef = useRef(false);

  // Play synthesized cartoon comedic sound using Web Audio API
  const playComedicSound = useCallback(() => {
    if (!soundEnabled || !userInteractedRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // 1. Funny comedic slide oscillator (cartoon boing / slide whistle)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.5);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.85);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.95);

      // 2. Comedic clown horn / beep accent
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(520, now + 0.15);
      osc2.frequency.setValueAtTime(440, now + 0.35);

      gain2.gain.setValueAtTime(0.2, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.15);
      osc2.stop(now + 0.65);
    } catch (_) {
      // Gracefully silent if audio autoplay is restricted
    }
  }, [soundEnabled]);

  const triggerEasterEgg = useCallback(() => {
    // Prevent stacking
    setIsOpen((alreadyOpen) => {
      if (alreadyOpen) return true;

      // Clear clipboard where permitted
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('');
        }
      } catch (_) {}

      // Play funny sound
      playComedicSound();

      // Reset auto-dismiss timer (7 seconds)
      setCountdown(7);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      timerRef.current = setTimeout(() => {
        setIsOpen(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }, 7000);

      return true;
    });
  }, [playComedicSound]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    // Record user interaction for AudioContext policy
    const recordInteraction = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener('click', recordInteraction, { once: true });
    window.addEventListener('keydown', recordInteraction, { once: true });

    // Keyboard handlers (Strictly checking screenshot keyboard events, NOT blur or tab switches)
    const handleKeyDown = (e) => {
      // 1. PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        triggerEasterEgg();
        return false;
      }

      // 2. Ctrl+P / Cmd+P (Print to PDF)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.keyCode === 80)) {
        e.preventDefault();
        triggerEasterEgg();
        return false;
      }

      // 3. Snipping tool shortcut (Ctrl+Shift+S / Cmd+Shift+3/4)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        triggerEasterEgg();
        return false;
      }
    };

    // Also listen on keyup (Windows Chrome frequently delivers PrintScreen on keyup)
    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        triggerEasterEgg();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('click', recordInteraction);
      window.removeEventListener('keydown', recordInteraction);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [triggerEasterEgg]);

  return (
    <>
      {/* Normal Website Application Hierarchy */}
      {children}

      {/* Funny Screenshot-Attempt Popup Easter Egg */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[99999] bg-vintage-olive/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in select-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="comic-box-lg bg-cream border-[4px] border-ink shadow-[10px_10px_0px_#171510] max-w-md w-full text-center p-5 sm:p-7 relative animate-bounce-in">
            {/* Top Close Button & Audio Toggle */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="p-1.5 rounded border-2 border-ink bg-white shadow-[2px_2px_0px_#171510] hover:bg-comic-yellow text-ink transition-colors flex items-center gap-1 font-comic text-[11px]"
                title={soundEnabled ? 'Mute funny sound effect' : 'Enable funny sound effect'}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-punch-red" />
                    <span>AUDIO ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-olive-dark" />
                    <span>MUTED</span>
                  </>
                )}
              </button>

              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-punch-red text-cream border-2 border-ink flex items-center justify-center font-bold shadow-[2px_2px_0px_#171510] hover:scale-110 active:scale-95 transition-transform"
                title="Dismiss"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            {/* Sticker Ribbon */}
            <div className="inline-block bg-punch-red text-cream font-comic text-xs uppercase px-3 py-1 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] -rotate-2 mb-2 font-bold tracking-wider">
              🚨 SCREENSHOT CAUGHT RED-HANDED!
            </div>

            {/* EXACT MESSAGE REQUIRED */}
            <h2 className="font-heading text-3xl sm:text-4xl text-ink uppercase tracking-tight leading-none drop-shadow-[2px_2px_0px_#F5B900]">
              KYA RE BHIK MANGYA! 😂
            </h2>

            {/* SUBTITLE */}
            <p className="font-comic text-punch-red text-base sm:text-lg uppercase tracking-wide font-black mt-1">
              SCREENSHOT KYU LE RAHA HAI?
            </p>

            {/* UPLOADED MEME GIF (Preserving Animation & Aspect Ratio) */}
            <div className="my-3 relative">
              <img
                src="/easter-egg-meme.gif"
                alt="Kya re bhik mangya!"
                className="w-full max-h-[260px] sm:max-h-[310px] object-contain mx-auto rounded border-[3px] border-ink shadow-[4px_4px_0px_#171510] bg-ink/5"
                onError={(e) => {
                  // Fallback to jpg copy if gif extension is blocked
                  if (e.target.src.endsWith('.gif')) {
                    e.target.src = '/easter-egg-meme.jpg';
                  }
                }}
              />
            </div>

            {/* ADDITIONAL TEXT */}
            <p className="font-sans font-bold text-xs sm:text-sm text-vintage-olive mb-4 leading-relaxed">
              Nice try, topper! Back to studying.
            </p>

            {/* Auto-Dismiss Progress & Close Button */}
            <div className="space-y-2">
              <ComicButton
                variant="yellow"
                size="md"
                fullWidth
                onClick={handleClose}
                className="font-heading tracking-wider uppercase text-sm sm:text-base py-2.5"
              >
                CHUP-CHAP PADHAI KAR! (RESUME)
              </ComicButton>

              <div className="flex items-center justify-between text-[11px] font-mono text-ink/70 px-1 pt-1">
                <span>⏱️ Auto-dismissing in {countdown}s</span>
                <button onClick={handleClose} className="hover:underline font-bold text-punch-red">
                  Dismiss now ✕
                </button>
              </div>

              {/* Countdown bar */}
              <div className="w-full h-1.5 bg-cream border border-ink rounded-full overflow-hidden">
                <div
                  className="h-full bg-punch-red transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 7) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScreenshotProtector;
