import { Music, Play } from 'lucide-react';
import { FC, ReactNode, useEffect, useState } from 'react';

import { TvButton } from './TvButton';

type TvFocusableCardProps = {
  title: string;
  subtitle?: string;
  src?: string;
  square?: boolean;
  variant?: 'square' | 'circle' | 'wide';
  badge?: string;
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
  variant,
  badge,
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

  const effectiveVariant = variant ?? (square ? 'square' : 'wide');

  return (
    <TvButton
      focusKey={focusKey ?? title}
      className={`tv-card tv-card-${effectiveVariant} ${className ?? ''}`.trim()}
      data-testid="tv-focusable-card"
      onClick={onClick}
      destinations={destinations}
    >
      <span className={`tv-card-art ${effectiveVariant}`.trim()}>
        {src && !imageError ? (
          <img
            decoding="async"
            referrerPolicy="no-referrer"
            src={src}
            alt=""
            onError={() => setImageError(true)}
          />
        ) : (
          (children ?? <Music />)
        )}
        <span className="tv-card-play-overlay">
          <span className="tv-card-play-icon">
            <Play fill="currentColor" />
          </span>
        </span>
        {badge && <span className="tv-card-badge">{badge}</span>}
      </span>
      <div className="tv-card-info">
        <span className="tv-card-title">{title}</span>
        {subtitle && <span className="tv-card-subtitle">{subtitle}</span>}
      </div>
    </TvButton>
  );
};
