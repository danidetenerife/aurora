import { ComponentProps, ReactNode } from 'react';

export type TopListEntry = {
  id: string;
  label: string;
  labelContent?: ReactNode;
  sublabelContent?: ReactNode;
  sublabel?: string;
  imageUrl?: string | null;
  value: number;
};

export type TopListProps = ComponentProps<'div'> & {
  title: string;
  entries: TopListEntry[];
  formatValue: (value: number) => string;
};
