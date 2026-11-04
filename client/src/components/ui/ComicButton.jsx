import React from 'react';

export const ComicButton = ({
  children,
  variant = 'yellow', // 'yellow' | 'red' | 'green' | 'olive' | 'white' | 'primary' | 'danger' | 'success' | 'secondary' | 'outline' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const variantClasses = {
    yellow: 'comic-btn-yellow',
    primary: 'comic-btn-yellow',
    red: 'comic-btn-red',
    danger: 'comic-btn-red',
    green: 'comic-btn-green',
    success: 'comic-btn-green',
    olive: 'comic-btn-olive',
    secondary: 'comic-btn-olive',
    white: 'comic-btn-white',
    outline: 'comic-btn-outline',
    ghost: 'comic-btn-ghost',
  };

  const sizeClasses = {
    sm: 'text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 shadow-[3px_3px_0px_#171510]',
    md: 'text-sm sm:text-base px-3.5 sm:px-4 py-2 shadow-[4px_4px_0px_#171510]',
    lg: 'text-base sm:text-xl px-4 sm:px-6 py-2.5 sm:py-3 shadow-[5px_5px_0px_#171510]',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`comic-btn flex-shrink-0 min-w-fit max-w-full select-none ${
        fullWidth ? 'w-full' : ''
      } ${variantClasses[variant] || variantClasses.yellow} ${
        sizeClasses[size] || sizeClasses.md
      } ${
        disabled ? 'opacity-60 cursor-not-allowed transform-none shadow-none' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-current flex-shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-heading tracking-wider">PLEASE WAIT...</span>
        </span>
      ) : (
        <span className="inline-flex items-center justify-center gap-2 w-full">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span className="truncate sm:overflow-visible">{children}</span>
        </span>
      )}
    </button>
  );
};

export default ComicButton;

