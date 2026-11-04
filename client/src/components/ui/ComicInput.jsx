import React from 'react';

export const ComicInput = ({
  label,
  error,
  icon,
  type = 'text',
  className = '',
  textarea = false,
  rows = 4,
  ...props
}) => {
  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label className="font-comic text-sm uppercase tracking-wide text-ink flex items-center justify-between">
          <span>{label}</span>
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-ink pointer-events-none z-10">
            {icon}
          </div>
        )}
        {textarea ? (
          <textarea
            rows={rows}
            className={`comic-input ${icon ? 'pl-10' : ''} ${
              error ? 'border-punch-red ring-2 ring-punch-red' : ''
            } ${className}`}
            {...props}
          />
        ) : (
          <input
            type={type}
            className={`comic-input ${icon ? 'pl-10' : ''} ${
              error ? 'border-punch-red ring-2 ring-punch-red' : ''
            } ${className}`}
            {...props}
          />
        )}
      </div>
      {error && (
        <span className="font-sans text-xs font-bold text-punch-red flex items-center gap-1 mt-0.5">
          <span>⚠️</span> {error}
        </span>
      )}
    </div>
  );
};

export default ComicInput;

