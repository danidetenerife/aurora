import { CassetteTape } from 'lucide-react';
import { FC, ReactNode } from 'react';

import { cn } from '../../utils';
import { Box } from '../Box';
import { Button } from '../Button';
import { ImageReveal } from '../ImageReveal';

type CardProps = {
  src?: string;
  image?: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
  imageReveal?: boolean;
  action?: ReactNode;
};

export const Card: FC<CardProps> = ({
  src,
  image,
  title,
  subtitle,
  className,
  onClick,
  imageReveal = true,
  action,
}) => (
  <Button
    as={action ? 'div' : 'button'}
    data-testid="card"
    size="flexible"
    className={cn(
      'flex w-full max-w-[11.5rem] flex-col items-stretch gap-2 p-2 text-left',
      className,
    )}
    onClick={onClick}
  >
    <Box
      variant="primary"
      shadow="none"
      className="relative aspect-square w-full items-center justify-center overflow-hidden p-0"
    >
      {action && (
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {action}
        </div>
      )}
      {image ?? (
        <ImageReveal
          enabled={imageReveal}
          src={src}
          alt={title}
          className="absolute inset-0"
          imgClassName="h-full w-full object-cover"
          placeholder={
            <CassetteTape
              size={96}
              absoluteStrokeWidth
              className="opacity-20"
            />
          }
        />
      )}
    </Box>

    {(title || subtitle) && (
      <div className="min-w-0">
        {title && (
          <div
            data-testid="card-title"
            className="text-foreground text-sm font-bold break-normal whitespace-normal [overflow-wrap:anywhere] leading-snug"
          >
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-foreground text-xs opacity-60 break-normal whitespace-normal [overflow-wrap:anywhere] leading-tight mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
    )}
  </Button>
);
