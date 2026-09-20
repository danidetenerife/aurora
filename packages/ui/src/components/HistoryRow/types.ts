import { ComponentProps, ReactNode } from 'react';

export type HistoryRowLabels = {
  favorite: string;
  unfavorite: string;
  addToQueue: string;
  duration?: string;
  playedAt?: string;
};

export type HistoryRowClasses = {
  root?: string;
  thumbnail?: string;
  title?: string;
  artist?: string;
  time?: string;
  duration?: string;
};

export type HistoryRowProps = ComponentProps<'div'> & {
  title: string;
  artist: string;
  artistContent?: ReactNode;
  time: string;
  duration?: string;
  artworkUrl?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAddToQueue?: () => void;
  onPlayNow?: () => void;
  labels: HistoryRowLabels;
  classes?: HistoryRowClasses;
};
