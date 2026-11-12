import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, ShieldAlert, Sparkles } from 'lucide-react';
import ComicButton from '../ui/ComicButton';
import { profile as profileApi } from '../../services/api';

/**
 * ScreenshotProtector & "Kya re bhik mangya!" Easter Egg Popup
 *
 * Listens for hardware / browser-exposed PrintScreen events and snipping shortcuts.
 * Does NOT falsely trigger on tab switching, window blur, or page visibility changes.
 */
export const ScreenshotProtector = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [countdown, setCountdown] = useState(7);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const userInteractedRef = useRef(false);
  const lastReportedRef = useRef(0);

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

  const triggerEasterEgg = useCallback((method = 'shortcut') => {
    // Log attempt to backend for authenticated users (debounced 2s to avoid keydown+keyup double count)
    const nowMs = Date.now();
    if (nowMs - lastReportedRef.current > 2000 && localStorage.getItem('topperbatch_token')) {
      lastReportedRef.current = nowMs;
      profileApi
        .reportScreenshotAttempt({
          path: window.location.pathname,
          method: typeof method === 'string' ? method : 'shortcut',
        })
        .catch(() => {});
    }

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
    window.addEventListener('touchstart', recordInteraction, { once: true });

    // 1. Mobile 3-Finger Screenshot Gesture (Universal on Xiaomi, OnePlus, Realme, Oppo, Samsung, Vivo, etc.)
    const activePointers = new Set();

    const handleTouch = (e) => {
      recordInteraction();
      const count =
        (e.touches && e.touches.length) ||
        (e.targetTouches && e.targetTouches.length) ||
        0;
      if (count >= 3) {
        triggerEasterEgg();
      }
    };

    const handlePointerDown = (e) => {
      recordInteraction();
      activePointers.add(e.pointerId);
      if (activePointers.size >= 3) {
        triggerEasterEgg();
      }
    };

    const handlePointerUp = (e) => {
      activePointers.delete(e.pointerId);
    };

    // 2. Window Focus & Blur Monitor (Instant Anti-Capture Protection)
    // When external tools (Windows Snipping Tool, Mac Screen Selection, Lightshot, ShareX) activate,
    // they steal OS focus. We instantly blur the study content so captured snips are unreadable.
    const handleWindowBlur = () => {
      setIsWindowFocused(false);
    };

    const handleWindowFocus = () => {
      setIsWindowFocused(true);
    };

    // 3. Desktop Keyboard Handlers (PrintScreen, Edge Web Capture, DevTools, Ctrl+P)
    const handleKeyDown = (e) => {
      recordInteraction();

      // PrintScreen key (Windows, Linux, Chromebooks)
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerEasterEgg();
        return false;
      }

      // Windows / Edge Snipping tool shortcut (Ctrl+Shift+S / Win+Shift+S / Shift+PrtScn)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 's' || e.key === 'S' || e.code === 'KeyS')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerEasterEgg();
        return false;
      }

      // macOS Screenshot Shortcuts: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (
        e.metaKey &&
        e.shiftKey &&
        ['3', '4', '5', '$', '%', '#'].includes(e.key)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerEasterEgg();
        return false;
      }

      // DevTools & Inspector Shortcuts (used to take headless screenshots in Edge/Brave/Chrome)
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerEasterEgg();
        return false;
      }

      // Ctrl+P / Cmd+P (Print to PDF / Browser print dialog)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'p' || e.key === 'P' || e.code === 'KeyP' || e.keyCode === 80)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerEasterEgg();
        return false;
      }
    };

    // Keyup for Windows Chrome / Edge which fires PrtScn only on keyup
    const handleKeyUp = (e) => {
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44
      ) {
        triggerEasterEgg();
      }
    };

    // Block Edge / Brave Right-Click Menu (Prevents selecting "Web capture" or "Take screenshot")
    const handleContextMenu = (e) => {
      const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        triggerEasterEgg();
      }
    };

    // Browser Print Event (catches browser-menu "Print" / "Save as PDF")
    const handleBeforePrint = () => {
      triggerEasterEgg();
    };

    // Attach high-priority capture-phase listeners for zero-delay response
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('beforeprint', handleBeforePrint);

    window.addEventListener('touchstart', handleTouch, { capture: true, passive: true });
    window.addEventListener('touchmove', handleTouch, { capture: true, passive: true });
    window.addEventListener('touchend', handleTouch, { capture: true, passive: true });

    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true, passive: true });

    return () => {
      window.removeEventListener('click', recordInteraction);
      window.removeEventListener('keydown', recordInteraction);
      window.removeEventListener('touchstart', recordInteraction);

      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('beforeprint', handleBeforePrint);

      window.removeEventListener('touchstart', handleTouch, true);
      window.removeEventListener('touchmove', handleTouch, true);
      window.removeEventListener('touchend', handleTouch, true);

      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('pointercancel', handlePointerUp, true);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [triggerEasterEgg]);

  return (
    <>
      {/* Normal Website Application Hierarchy with Auto-Protection on Focus Loss */}
      <div
        className={`transition-all duration-150 ${
          !isWindowFocused && !isOpen ? 'filter blur-md select-none pointer-events-none' : ''
        }`}
      >
        {children}
      </div>

      {/* Screen Snipping Obfuscation Shield (covers content during external snips) */}
      {!isWindowFocused && !isOpen && (
        <div className="fixed inset-0 z-[99990] bg-ink/30 backdrop-blur-md flex items-center justify-center p-4 select-none pointer-events-none">
          <div className="comic-box bg-cream border-[3px] border-ink p-4 shadow-[6px_6px_0px_#171510] text-center max-w-sm animate-pulse">
            <span className="font-comic text-xs uppercase text-punch-red font-bold block mb-1">
              🔒 TOPPERBATCH ANTI-CAPTURE SHIELD
            </span>
            <p className="font-heading text-lg uppercase text-ink">
              STUDY CONTENT PROTECTED
            </p>
            <p className="font-sans text-xs text-olive-dark mt-1 font-medium">
              Click anywhere inside this window to resume learning!
            </p>
          </div>
        </div>
      )}

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
