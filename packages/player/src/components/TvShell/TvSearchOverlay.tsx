import {
  FocusContext,
  pause,
  resume,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import type {
  MetadataProvider,
  SearchResults,
} from '@nuclearplayer/plugin-sdk';
import { cn } from '@nuclearplayer/ui';

import { useActiveProvider } from '../../hooks/useActiveProvider';
import { metadataHost } from '../../services/metadataHost';
import { useTvStore } from '../../stores/tvStore';
import { TvContentRow } from './TvContentRow';
import { TvFocusableCard } from './TvFocusableCard';

const TvSearchCloseButton: FC = () => {
  const closeSearch = useTvStore((state) => state.closeSearch);
  const { t } = useTranslation('tv');
  const { ref, focused } = useFocusable({
    focusKey: 'tv-search-close',
    onEnterPress: closeSearch,
  });

  return (
    <button
      ref={ref}
      onClick={closeSearch}
      className={cn(
        'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-800 text-zinc-400 outline-none',
        focused && 'ring-primary text-white ring-2',
      )}
      aria-label={t('closeSearch')}
    >
      <X size={24} />
    </button>
  );
};

export const TvSearchOverlay: FC = () => {
  const { t } = useTranslation('search');
  const isSearchOpen = useTvStore((state) => state.isSearchOpen);
  const closeSearch = useTvStore((state) => state.closeSearch);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const provider = useActiveProvider('metadata') as
    | MetadataProvider
    | undefined;

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ['tv-metadata-search', provider?.id, query],
    queryFn: () =>
      metadataHost.search({
        query,
      }),
    enabled: Boolean(provider && query.length >= 2),
  });

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_SEARCH_OVERLAY',
    isFocusBoundary: true,
    preferredChildFocusKey: 'tv-search-input',
  });

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      pause();
      inputRef.current.focus();
    }
    return () => {
      resume();
      setFocus('tv-nav-search');
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      setQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Back') {
        closeSearch();
      }
    };

    if (isSearchOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, closeSearch]);

  if (!isSearchOpen) {
    return null;
  }

  const hasResults =
    results &&
    ((results.albums?.length ?? 0) > 0 ||
      (results.artists?.length ?? 0) > 0 ||
      (results.tracks?.length ?? 0) > 0);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        data-testid="tv-search-overlay"
        className="fixed inset-0 z-50 flex flex-col bg-zinc-950/98 backdrop-blur-xl"
      >
        <div className="flex items-center gap-4 px-[5%] pt-8 pb-4">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3">
            <Search size={24} className="shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              onFocus={pause}
              onBlur={resume}
              onKeyDown={(event) => {
                if (event.key !== 'Escape' && event.key !== 'Back') {
                  event.stopPropagation();
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  event.stopPropagation();
                  inputRef.current?.blur();
                  resume();
                  setFocus('tv-search-close');
                }
              }}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('title')}
              className="flex-1 bg-transparent text-xl font-medium text-white outline-none placeholder:text-zinc-500"
              data-testid="tv-search-input"
            />
          </div>
          <TvSearchCloseButton />
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading && query.length >= 2 && (
            <div className="flex items-center justify-center py-12">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}

          {!isLoading && query.length >= 2 && !hasResults && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Search size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">{t('failedToLoad')}</p>
            </div>
          )}

          {hasResults && (
            <div className="flex flex-col gap-6">
              {results.albums && results.albums.length > 0 && (
                <TvContentRow
                  title={t('results.albums')}
                  focusKey="tv-search-albums"
                >
                  {results.albums.map((album) => (
                    <TvFocusableCard
                      key={album.source.id}
                      title={album.title}
                      src={pickArtwork(album.artwork, 'cover', 300)?.url}
                      focusKey={`tv-search-album-${album.source.id}`}
                    />
                  ))}
                </TvContentRow>
              )}

              {results.artists && results.artists.length > 0 && (
                <TvContentRow
                  title={t('results.artists')}
                  focusKey="tv-search-artists"
                >
                  {results.artists.map((artist) => (
                    <TvFocusableCard
                      key={artist.source.id}
                      title={artist.name}
                      src={pickArtwork(artist.artwork, 'cover', 300)?.url}
                      focusKey={`tv-search-artist-${artist.source.id}`}
                    />
                  ))}
                </TvContentRow>
              )}

              {results.tracks && results.tracks.length > 0 && (
                <TvContentRow
                  title={t('results.tracks')}
                  focusKey="tv-search-tracks"
                >
                  {results.tracks.map((track) => (
                    <TvFocusableCard
                      key={`${track.source?.provider}-${track.source?.id}`}
                      title={track.title ?? ''}
                      subtitle={track.artists?.[0]?.name}
                      src={pickArtwork(track.artwork, 'thumbnail', 300)?.url}
                      focusKey={`tv-search-track-${track.source?.id}`}
                    />
                  ))}
                </TvContentRow>
              )}
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
};
