import { XIcon } from 'lucide-react';
import { FC } from 'react';

import { cn } from '../../utils';
import { Button } from '../Button';
import { useDialogContext } from './context';

type DialogXCloseProps = {
  className?: string;
};

export const DialogXClose: FC<DialogXCloseProps> = ({ className }) => {
  const { onClose } = useDialogContext();

  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={onClose}
      className={cn(
        'border-border/40 absolute top-2.5 right-2.5 z-30 border shadow-sm',
        className,
      )}
      aria-label="Close"
      data-testid="dialog-x-close"
    >
      <XIcon size={16} />
    </Button>
  );
};
