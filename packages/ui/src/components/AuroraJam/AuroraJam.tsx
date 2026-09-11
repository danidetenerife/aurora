import { FC } from 'react';

import {
  AuroraJamConnecting,
  AuroraJamConnectingLabels,
} from './AuroraJamConnecting';
import { AuroraJamContent, AuroraJamContentProps } from './AuroraJamContent';
import { AuroraJamControls, AuroraJamControlsProps } from './AuroraJamControls';
import { AuroraJamEmptyQueueLabels } from './AuroraJamEmptyQueue';
import { AuroraJamError, AuroraJamErrorLabels } from './AuroraJamError';
import {
  AuroraJamHeader,
  AuroraJamHeaderProps,
  ConnectionStatus,
  ConnectionStatusLabels,
} from './AuroraJamHeader';
import {
  AuroraJamNowPlaying,
  AuroraJamNowPlayingProps,
} from './AuroraJamNowPlaying';
import {
  AuroraJamQueue,
  AuroraJamQueueLabels,
  AuroraJamQueueProps,
} from './AuroraJamQueue';
import { AuroraJamProps, AuroraJamRoot } from './AuroraJamRoot';
import {
  AuroraJamSearchBar,
  AuroraJamSearchBarLabels,
  AuroraJamSearchBarProps,
} from './AuroraJamSearchBar';
import {
  AuroraJamSearchDrawer,
  AuroraJamSearchDrawerProps,
} from './AuroraJamSearchDrawer';
import {
  AuroraJamSearchDrawerEmpty,
  AuroraJamSearchDrawerEmptyLabels,
} from './AuroraJamSearchDrawerEmpty';
import {
  AuroraJamSearchDrawerError,
  AuroraJamSearchDrawerErrorLabels,
} from './AuroraJamSearchDrawerError';
import { AuroraJamSearchDrawerResults } from './AuroraJamSearchDrawerResults';
import {
  AuroraJamSearchResultTrack,
  AuroraJamSearchResultTrackProps,
} from './AuroraJamSearchResultTrack';

type AuroraJamSearchDrawerComponent = typeof AuroraJamSearchDrawer & {
  Empty: typeof AuroraJamSearchDrawerEmpty;
  Error: typeof AuroraJamSearchDrawerError;
  Results: typeof AuroraJamSearchDrawerResults;
};

const SearchDrawer = AuroraJamSearchDrawer as AuroraJamSearchDrawerComponent;
SearchDrawer.Empty = AuroraJamSearchDrawerEmpty;
SearchDrawer.Error = AuroraJamSearchDrawerError;
SearchDrawer.Results = AuroraJamSearchDrawerResults;

type AuroraJamComponent = FC<AuroraJamProps> & {
  Connecting: typeof AuroraJamConnecting;
  Error: typeof AuroraJamError;
  Header: typeof AuroraJamHeader;
  Content: typeof AuroraJamContent;
  NowPlaying: typeof AuroraJamNowPlaying;
  Controls: typeof AuroraJamControls;
  Queue: typeof AuroraJamQueue;
  SearchBar: typeof AuroraJamSearchBar;
  SearchDrawer: AuroraJamSearchDrawerComponent;
  SearchResultTrack: typeof AuroraJamSearchResultTrack;
};

export const AuroraJam = AuroraJamRoot as AuroraJamComponent;
AuroraJam.Connecting = AuroraJamConnecting;
AuroraJam.Error = AuroraJamError;
AuroraJam.Header = AuroraJamHeader;
AuroraJam.Content = AuroraJamContent;
AuroraJam.NowPlaying = AuroraJamNowPlaying;
AuroraJam.Controls = AuroraJamControls;
AuroraJam.Queue = AuroraJamQueue;
AuroraJam.SearchBar = AuroraJamSearchBar;
AuroraJam.SearchDrawer = SearchDrawer;
AuroraJam.SearchResultTrack = AuroraJamSearchResultTrack;

export type {
  AuroraJamProps,
  AuroraJamHeaderProps,
  AuroraJamContentProps,
  AuroraJamNowPlayingProps,
  AuroraJamControlsProps,
  AuroraJamConnectingLabels,
  AuroraJamErrorLabels,
  AuroraJamEmptyQueueLabels,
  AuroraJamQueueLabels,
  AuroraJamQueueProps,
  AuroraJamSearchBarLabels,
  AuroraJamSearchBarProps,
  AuroraJamSearchDrawerProps,
  AuroraJamSearchDrawerEmptyLabels,
  AuroraJamSearchDrawerErrorLabels,
  AuroraJamSearchResultTrackProps,
  ConnectionStatus,
  ConnectionStatusLabels,
};
