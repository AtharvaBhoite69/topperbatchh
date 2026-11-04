import React from 'react';

export const ComicCard = ({
  children,
  className = '',
  accent, // 'yellow' | 'red' | 'green' | 'olive'
  interactive = false,
  dashed = false,
  onClick,
  ...props
}) => {
  const accentBorders = {
    yellow: 'border-t-[6px] border-t-comic-yellow',
    red: 'border-t-[6px] border-t-punch-red',
    green: 'border-t-[6px] border-t-victory-green',
    olive: 'border-t-[6px] border-t-vintage-olive',
  };

  const baseClass = dashed
    ? 'comic-dashed-box'
    : interactive
    ? 'comic-card-interactive cursor-pointer'
    : 'comic-box';

  return (
    <div
      onClick={onClick}
      className={`${baseClass} ${accent ? accentBorders[accent] : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default ComicCard;

