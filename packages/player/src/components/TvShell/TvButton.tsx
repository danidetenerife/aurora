import {
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { ComponentProps, FC } from 'react';

type TvButtonProps = ComponentProps<'button'> & {
  focusKey: string;
  destinations?: Partial<Record<'left' | 'right' | 'up' | 'down', string>>;
};
export const TvButton: FC<TvButtonProps> = ({
  focusKey,
  destinations,
  onClick,
  children,
  ...props
}) => {
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    onArrowPress: (direction) => {
      const destination =
        destinations?.[direction as 'left' | 'right' | 'up' | 'down'];
      if (destination) {
        setFocus(destination);
        return false;
      }
      return true;
    },
  });
  return (
    <button
      {...props}
      ref={ref}
      data-focused={focused}
      data-tv-focus={focusKey}
      onFocus={() => focusSelf()}
      onClick={onClick}
      onKeyDown={(event) => {
        if (
          event.key.startsWith('Arrow') ||
          (event.repeat && (event.key === 'Enter' || event.key === ' '))
        ) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
};
