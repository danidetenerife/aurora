import { useNavigate } from '@tanstack/react-router';
import { FC, Fragment, useState } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@nuclearplayer/i18n';

import { useQueueActions } from '../../../hooks/useQueueActions';
import { metadataHost } from '../../../services/metadataHost';

const SEARCH_LIMIT = 10;

type HistoryLinkProps = {
  kind: 'artist' | 'album' | 'track';
  name: string;
  artists?: string[];
};

export const HistoryLink: FC<HistoryLinkProps> = ({
  kind,
  name,
  artists = [],
}) => {
  const navigate = useNavigate();
  const { playNow } = useQueueActions();
  const { t } = useTranslation('history');
  const [pending, setPending] = useState(false);

  const open = async () => {
    setPending(true);
    try {
      const query = [name, ...artists].join(' ');
      const results = await metadataHost.search({
        query,
        types: [
          kind === 'artist'
            ? 'artists'
            : kind === 'album'
              ? 'albums'
              : 'tracks',
        ],
        limit: SEARCH_LIMIT,
      });
      if (kind === 'track') {
        const track =
          results.tracks?.find(
            (result) =>
              result.title.toLocaleLowerCase() === name.toLocaleLowerCase() &&
              artists.every((artist) =>
                result.artists.some(
                  (credit) =>
                    credit.name.toLocaleLowerCase() ===
                    artist.toLocaleLowerCase(),
                ),
              ),
          ) ?? results.tracks?.[0];
        if (!track) {
          throw new Error('Track unavailable');
        }
        playNow(track);
      } else {
        const matches = kind === 'artist' ? results.artists : results.albums;
        const result =
          matches?.find(
            (item) =>
              ('name' in item ? item.name : item.title).toLocaleLowerCase() ===
              name.toLocaleLowerCase(),
          ) ?? matches?.[0];
        if (!result) {
          throw new Error('Metadata unavailable');
        }
        await navigate({
          to: `/${kind}/${encodeURIComponent(result.source.provider)}/${encodeURIComponent(result.source.id)}`,
        });
      }
    } catch {
      toast.error(t('openError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className="max-w-full cursor-pointer truncate text-left hover:underline focus-visible:underline disabled:opacity-50"
      disabled={pending}
      aria-busy={pending}
      onClick={() => void open()}
    >
      {name}
    </button>
  );
};

export const HistoryArtistLinks: FC<{ artists: string[] }> = ({ artists }) => (
  <span className="inline-flex max-w-full gap-1">
    {artists.map((artist, index) => (
      <Fragment key={`${artist}-${index}`}>
        {index > 0 && ', '}
        <HistoryLink kind="artist" name={artist} />
      </Fragment>
    ))}
  </span>
);
