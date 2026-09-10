import { FC, ReactNode } from 'react';

import { TvButton } from './TvButton';

type TvFocusableCardProps = {
  title: string;
  subtitle?: string;
  src?: string;
  onClick?: () => void;
  className?: string;
  focusKey?: string;
  children?: ReactNode;
};
export const TvFocusableCard: FC<TvFocusableCardProps> = ({
  title,
  subtitle,
  src,
  onClick,
  className,
  focusKey,
  children,
}) => (
  <TvButton
    focusKey={focusKey ?? title}
    className={`tv-card ${className ?? ''}`}
    data-testid="tv-focusable-card"
    onClick={onClick}
    destinations={
      focusKey?.startsWith('tv-search-')
        ? undefined
        : { down: 'tv-control-play', up: 'tv-nav-dashboard' }
    }
  >
    <span className="tv-card-art">
      {src ? (
        <img loading="lazy" decoding="async" src={src} alt="" />
      ) : (
        children
      )}
    </span>
    <span className="tv-card-title">{title}</span>
    {subtitle && <span className="tv-card-subtitle">{subtitle}</span>}
  </TvButton>
);
