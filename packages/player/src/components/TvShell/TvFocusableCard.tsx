import { FC, ReactNode, useState } from 'react';

import { TvButton } from './TvButton';

type TvFocusableCardProps = {
  title: string;
  subtitle?: string;
  src?: string;
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
  onClick,
  className,
  focusKey,
  children,
  destinations,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <TvButton
      focusKey={focusKey ?? title}
      className={`tv-card ${className ?? ''}`}
      data-testid="tv-focusable-card"
      onClick={onClick}
      destinations={destinations}
    >
      <span className="tv-card-art">
        {src && !imageError ? (
          <img
            loading="lazy"
            decoding="async"
            src={src}
            alt=""
            onError={() => setImageError(true)}
          />
        ) : (
          children
        )}
      </span>
      <div className="tv-card-info">
        <span className="tv-card-title">{title}</span>
        {subtitle && <span className="tv-card-subtitle">{subtitle}</span>}
      </div>
    </TvButton>
  );
};
