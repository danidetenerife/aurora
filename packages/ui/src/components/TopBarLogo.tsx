import { FC } from 'react';

import AuroraWavesLogo from '../assets/logo-icon-waves.png';
import { cn } from '../utils';

const logoClass = 'h-6 w-6';

type TopBarLogoProps = {
  className?: string;
};

export const TopBarLogo: FC<TopBarLogoProps> = ({ className }) => (
  <img
    src={AuroraWavesLogo}
    alt="Aurora"
    className={cn('ml-0.5 object-contain', logoClass, className)}
  />
);
