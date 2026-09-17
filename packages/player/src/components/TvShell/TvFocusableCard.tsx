import { Music } from 'lucide-react';
import { FC, ReactNode, useEffect, useState } from 'react';

import { TvButton } from './TvButton';

type TvFocusableCardProps = {
  title: string;
  subtitle?: string;
  src?: string;
  square?: boolean;
  onClick?: () => void;
  className?: string;
  focusKey?: string;
  children?: ReactNode;
  destinations?: Partial<Record<'left' | 'right' | 'up' | 'down', string>>;
};

export const TvFocusableCard: FC<TvFocusableCardProps> = ({
  title,
  subtitle,
  src,
  square = true,
  onClick,
  className,
  focusKey,
  children,
  destinations,
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  return (
    <TvButton
      focusKey={focusKey ?? title}
      className={`tv-card ${className ?? ''}`}
      data-testid="tv-focusable-card"
      onClick={onClick}
      destinations={destinations}
    >
      <span className={`tv-card-art ${!square ? 'wide' : ''}`.trim()}>
        {src && !imageError ? (
          <img
            decoding="async"
            referrerPolicy="no-referrer"
            src={src}
            alt=""
            onError={() => setImageError(true)}
          />
        ) : (
          children ?? <Music />
        )}
      </span>
      <div className="tv-card-info">
        <span className="tv-card-title">{title}</span>
        {subtitle && <span className="tv-card-subtitle">{subtitle}</span>}
      </div>
    </TvButton>
  );
};
