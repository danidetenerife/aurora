import { cva, VariantProps } from 'class-variance-authority';
import { Heart, ThumbsDown } from 'lucide-react';
import { FC, MouseEvent } from 'react';

import { cn } from '../../utils';

const pillVariants = cva(
  'border-border bg-card inline-flex items-center rounded-full border-(length:--border-width) transition-colors',
  {
    variants: {
      size: {
        sm: 'h-7',
        default: 'h-8',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

const iconSizes = {
  sm: 14,
  default: 16,
} as const;

type PillRatingGroupLabels = {
  favoriteAdd: string;
  favoriteRemove: string;
  dislike: string;
};

type PillRatingGroupProps = VariantProps<typeof pillVariants> & {
  isFavorite: boolean;
  isDisliked?: boolean;
  onToggleFavorite: () => void;
  onDislike: () => void;
  labels: PillRatingGroupLabels;
  className?: string;
  'data-testid'?: string;
  favoriteTestId?: string;
  dislikeTestId?: string;
};

export const PillRatingGroup: FC<PillRatingGroupProps> = ({
  isFavorite,
  isDisliked = false,
  onToggleFavorite,
  onDislike,
  labels,
  size = 'default',
  className,
  'data-testid': testId,
  favoriteTestId = 'pill-favorite-button',
  dislikeTestId = 'pill-dislike-button',
}) => {
  const resolvedSize = size ?? 'default';
  const iconSize = iconSizes[resolvedSize];

  const handleFavoriteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFavorite();
  };

  const handleDislikeClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDislike();
  };

  return (
    <div
      data-testid={testId ?? 'pill-rating-group'}
      className={cn(pillVariants({ size, className }))}
    >
      <button
        type="button"
        onClick={handleFavoriteClick}
        aria-label={isFavorite ? labels.favoriteRemove : labels.favoriteAdd}
        title={isFavorite ? labels.favoriteRemove : labels.favoriteAdd}
        data-testid={favoriteTestId}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-l-full transition-colors',
          resolvedSize === 'sm' ? 'h-full px-2.5' : 'h-full px-3',
          'hover:bg-foreground/5 active:bg-foreground/10',
        )}
      >
        <Heart
          size={iconSize}
          className={cn(
            'transition-colors',
            isFavorite
              ? 'fill-accent-red text-accent-red'
              : 'text-foreground-secondary hover:text-foreground',
          )}
        />
      </button>
      <div className="bg-border h-3.5 w-px shrink-0" />
      <button
        type="button"
        onClick={handleDislikeClick}
        aria-label={labels.dislike}
        title={labels.dislike}
        data-testid={dislikeTestId}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-r-full transition-colors',
          resolvedSize === 'sm' ? 'h-full px-2.5' : 'h-full px-3',
          'hover:bg-foreground/5 active:bg-foreground/10',
        )}
      >
        <ThumbsDown
          size={iconSize}
          className={cn(
            'transition-colors',
            isDisliked
              ? 'fill-foreground text-foreground'
              : 'text-foreground-secondary hover:text-accent-red',
          )}
        />
      </button>
    </div>
  );
};
