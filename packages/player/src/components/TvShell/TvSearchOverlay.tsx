import {
  FocusContext,
  pause,
  resume,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { useQuery } from '@tanstack/react-query';
import { FC, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';

import { useActiveProvider } from '../../hooks/useActiveProvider';
import { metadataHost } from '../../services/metadataHost';
import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';
import { TvFocusableCard } from './TvFocusableCard';
import { playTvTracks } from './tvPlayback';

const SEARCH_DELAY_MS = 350;
const SEARCH_LIMIT = 24;
export const TvSearchOverlay: FC = () => {
  const { t } = useTranslation('tv');
  const closeSearch = useTvStore((state) => state.closeSearch);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const provider = useActiveProvider('metadata');
  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_SEARCH_OVERLAY',
    isFocusBoundary: true,
  });
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data, isFetching, isError } = useQuery({
    queryKey: ['tv-search', provider?.id, debouncedQuery],
    queryFn: () =>
      metadataHost.search({
        query: debouncedQuery,
        types: ['tracks'],
        limit: SEARCH_LIMIT,
      }),
    enabled: Boolean(provider && debouncedQuery.length >= 2),
    retry: false,
  });
  useEffect(() => {
    pause();
    input.current?.focus();
    const back = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Back') {
        event.preventDefault();
        closeSearch();
      }
    };
    document.addEventListener('keydown', back);
    return () => {
      document.removeEventListener('keydown', back);
      resume();
      setFocus('tv-nav-search');
    };
  }, [closeSearch]);
  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} className="tv-search" data-testid="tv-search-overlay">
        <div className="tv-search-header">
          <input
            ref={input}
            data-testid="tv-search-input"
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={pause}
            onBlur={resume}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' && event.key !== 'Back') {
                event.stopPropagation();
              }
              if (event.key === 'ArrowDown' || event.key === 'Enter') {
                event.preventDefault();
                input.current?.blur();
                resume();
                setFocus('tv-search-close');
              }
            }}
          />
          <TvButton
            focusKey="tv-search-close"
            onClick={closeSearch}
            destinations={{
              down: data?.tracks?.length
                ? 'tv-search-track-0'
                : 'tv-search-close',
            }}
          >
            {t('closeSearch')}
          </TvButton>
        </div>
        <div className="tv-search-results">
          {!provider && <p role="status">{t('noProvider')}</p>}
          {isFetching && <p role="status">{t('loading')}</p>}
          {isError && <p role="alert">{t('playbackError')}</p>}
          {provider &&
            !isFetching &&
            debouncedQuery.length >= 2 &&
            !data?.tracks?.length && <p>{t('noResults')}</p>}
          <div className="tv-grid">
            {data?.tracks?.slice(0, SEARCH_LIMIT).map((track, index) => (
              <TvFocusableCard
                key={`${track.source?.provider}-${track.source?.id}-${index}`}
                focusKey={`tv-search-track-${index}`}
                title={track.title ?? ''}
                subtitle={track.artists
                  ?.map((artist) => artist.name)
                  .join(', ')}
                src={pickArtwork(track.artwork, 'thumbnail', 200)?.url}
                onClick={() => {
                  playTvTracks([track]);
                  closeSearch();
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  );
};
