import React from 'react';

export const ComicBadge = ({
  children,
  variant = 'yellow', // 'yellow' | 'red' | 'green' | 'olive'
  rotate = 0,
  className = '',
}) => {
  const variantClasses = {
    yellow: 'comic-badge-yellow',
    red: 'comic-badge-red',
    green: 'comic-badge-green',
    olive: 'comic-badge-olive',
  };

  const style = rotate ? { transform: `rotate(${rotate}deg)` } : {};

  return (
    <span
      style={style}
      className={`comic-badge ${variantClasses[variant] || variantClasses.yellow} ${className}`}
    >
      {children}
    </span>
  );
};

export const Starburst = ({
  children,
  color = 'yellow', // 'yellow' | 'red' | 'green'
  size = 'md',
  className = '',
}) => {
  const bgColors = {
    yellow: 'bg-comic-yellow text-ink',
    red: 'bg-punch-red text-cream',
    green: 'bg-victory-green text-cream',
  };

  const sizeStyles = {
    sm: 'w-14 h-14 text-xs',
    md: 'w-20 h-20 text-sm',
    lg: 'w-28 h-28 text-base font-black',
  };

  return (
    <div
      className={`comic-starburst ${bgColors[color] || bgColors.yellow} ${
        sizeStyles[size] || sizeStyles.md
      } ${className}`}
    >
      <span className="text-center leading-tight drop-shadow">{children}</span>
    </div>
  );
};

export const SpeechBubble = ({ children, className = '' }) => {
  return (
    <div className={`comic-speech-bubble ${className}`}>
      {children}
    </div>
  );
};

export const Avatar = ({ src, name = 'Student', size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs border-2 shadow-[2px_2px_0px_#171510]',
    md: 'w-10 h-10 text-sm border-[2px] shadow-[3px_3px_0px_#171510]',
    lg: 'w-14 h-14 text-base border-[3px] shadow-[4px_4px_0px_#171510]',
    xl: 'w-20 h-20 text-xl border-[3px] shadow-[5px_5px_0px_#171510]',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover border-ink ${sizeClasses[size] || sizeClasses.md} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-comic-yellow text-ink font-heading font-black flex items-center justify-center border-ink ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
    >
      {initials}
    </div>
  );
};

export const LoadingSkeleton = ({ count = 3, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="comic-box p-4 animate-pulse bg-white flex flex-col gap-2.5 opacity-80"
        >
          <div className="h-5 bg-secondary-grey/40 rounded w-1/3"></div>
          <div className="h-4 bg-secondary-grey/30 rounded w-full"></div>
          <div className="h-4 bg-secondary-grey/20 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
};

export const EmptyState = ({
  icon = '📦',
  title = 'NOTHING HERE YET!',
  description = 'No records found. Check back later or create the first one!',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="comic-box p-8 text-center bg-white flex flex-col items-center justify-center max-w-md mx-auto my-6">
      <div className="text-5xl mb-3 animate-bounce">{icon}</div>
      <h3 className="font-heading text-xl uppercase tracking-wider text-ink mb-1">
        {title}
      </h3>
      <p className="font-sans text-xs text-olive-dark mb-4 font-medium">
        {description}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="comic-btn comic-btn-yellow text-sm">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const ConfirmDialog = ({
  isOpen,
  title = 'ARE YOU SURE?',
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  onConfirm,
  onCancel,
  variant = 'red',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
      <div className="comic-box-lg max-w-md w-full bg-cream p-6 animate-in fade-in zoom-in-95">
        <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-2">
          {title}
        </h3>
        <p className="font-sans text-sm text-olive-dark mb-6 font-medium">
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="comic-btn comic-btn-white text-sm">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`comic-btn ${variant === 'red' ? 'comic-btn-red' : 'comic-btn-yellow'} text-sm`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProgressBar = ({ current = 0, total = 100, label }) => {
  const percent = Math.min(100, Math.max(0, Math.round((current / total) * 100)));

  return (
    <div className="w-full flex flex-col gap-1">
      {label && (
        <div className="flex justify-between items-center text-xs font-comic uppercase text-ink">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="w-full h-4 bg-white border-2 border-ink rounded-full overflow-hidden shadow-[2px_2px_0px_#171510] p-0.5">
        <div
          className="h-full bg-punch-red rounded-full transition-all duration-300 comic-halftone-light"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
};

