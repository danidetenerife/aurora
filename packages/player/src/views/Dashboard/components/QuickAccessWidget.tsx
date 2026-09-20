import { useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { FC, useMemo } from 'react';

import { pickArtwork } from '@aurora/model';

import { useQueueActions } from '../../../hooks/useQueueActions';
import { useFavoritesStore } from '../../../stores/favoritesStore';
import { usePlaylistStore } from '../../../stores/playlistStore';

type QuickCard = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  isPlaylist?: boolean;
  onClick: () => void;
};

const DEFAULT_QUICK_CARDS: Omit<QuickCard, 'onClick'>[] = [
  {
    id: 'quick-1',
    title: 'Retorciendo palabras',
    subtitle: 'Fangoria',
    imageUrl:
      'https://i.scdn.co/image/ab67616d0000b27387dc4e0b04a9910d54032d84',
  },
  {
    id: 'quick-2',
    title: 'Sólo TEMAZOS',
    subtitle: 'Mix • 50 canciones',
    imageUrl:
      'https://i.scdn.co/image/ab67616d0000b27376c66cf1b046e7f722ffec7f',
    isPlaylist: true,
  },
  {
    id: 'quick-3',
    title: 'Bésame en la Boca',
    subtitle: 'Canción',
    imageUrl:
      'https://i.scdn.co/image/ab67616d0000b273820fa49c362be44d320294d7',
  },
  {
    id: 'quick-4',
    title: 'DON OMAR',
    subtitle: 'Artista',
    imageUrl:
      'https://i.scdn.co/image/ab67616d0000b2730623e1e9c8e87498c8959d2a',
  },
  {
    id: 'quick-5',
    title: 'Ya pedo quién sabe',
    subtitle: 'Grupo Frontera',
    imageUrl:
      'https://i.scdn.co/image/ab67616d0000b27341e8d47910901e19488d9e26',
  },
  {
    id: 'quick-6',
    title: 'CHRISTIAN NODAL',
    subtitle: 'Artista',
    imageUrl:
      'https://i.scdn.co/image/ab67616d0000b273cc09673898a101b7a8a07c03',
  },
];

export const QuickAccessWidget: FC = () => {
  const navigate = useNavigate();
  const queue = useQueueActions();
  const playlistIndex = usePlaylistStore((state) => state.index);
  const favoriteTracks = useFavoritesStore((state) => state.tracks);

  const cards: QuickCard[] = useMemo(() => {
    const dynamicCards: QuickCard[] = [];

    // Add user playlists
    for (const playlist of playlistIndex) {
      if (dynamicCards.length >= 6) {
        break;
      }
      dynamicCards.push({
        id: `pl-${playlist.id}`,
        title: playlist.name,
        subtitle: `${playlist.itemCount} canciones`,
        imageUrl:
          playlist.thumbnails?.[0] ??
          pickArtwork(playlist.artwork, 'cover', 300)?.url,
        isPlaylist: true,
        onClick: () => {
          void navigate({
            to: '/playlists/$playlistId',
            params: { playlistId: playlist.id },
          });
        },
      });
    }

    // Add user favorite tracks
    for (const fav of favoriteTracks) {
      if (dynamicCards.length >= 8) {
        break;
      }
      const track = fav.ref;
      dynamicCards.push({
        id: `fav-${track.source.id}`,
        title: track.title,
        subtitle: track.artists?.[0]?.name,
        imageUrl: pickArtwork(track.artwork, 'cover', 300)?.url,
        onClick: () => {
          queue.playTracks([track], 0);
        },
      });
    }

    // Fill with default quick cards if needed
    for (const def of DEFAULT_QUICK_CARDS) {
      if (dynamicCards.length >= 6) {
        break;
      }
      dynamicCards.push({
        ...def,
        onClick: () => {
          void navigate({
            to: '/search',
            search: { q: def.title },
          });
        },
      });
    }

    return dynamicCards;
  }, [playlistIndex, favoriteTracks, queue, navigate]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header with data-testid="mobile-dashboard-greeting" */}
      <button
        type="button"
        data-testid="mobile-dashboard-greeting"
        onClick={() => void navigate({ to: '/playlists' })}
        className="flex w-full cursor-pointer items-center justify-between px-1 text-left transition-opacity focus:outline-none active:opacity-80"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-[9px] font-black text-white select-none">
              D
            </div>
            <span className="text-[11px] font-black tracking-wider text-zinc-400 uppercase select-none">
              DANIEL DELGADO
            </span>
          </div>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-white select-none">
            Acceso rápido
          </h2>
        </div>
        <ChevronRight className="h-5 w-5 text-zinc-400 select-none" />
      </button>

      {/* 2-Row Horizontal Scrolling Grid */}
      <div className="no-scrollbar grid snap-x snap-mandatory auto-cols-[145px] grid-flow-col grid-rows-2 gap-2.5 overflow-x-auto px-1 pb-1 select-none">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className="group relative flex h-28 w-full cursor-pointer snap-start flex-col justify-end overflow-hidden rounded-lg bg-zinc-900 text-left shadow-md ring-1 shadow-black/60 ring-white/10 transition-transform focus:outline-none active:scale-95"
          >
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.title}
                className="absolute inset-0 h-full w-full object-cover brightness-75 transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
            )}

            {/* Gradient overlay for title legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {card.isPlaylist && (
              <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[9px] font-bold tracking-wider text-white uppercase">
                  Mix
                </span>
              </div>
            )}

            <div className="relative z-10 p-2.5">
              <div className="text-xs leading-tight font-bold break-words text-white drop-shadow-sm">
                {card.title}
              </div>
              {card.subtitle && (
                <div className="mt-0.5 text-[10px] leading-tight break-words text-zinc-300 drop-shadow-sm">
                  {card.subtitle}
                </div>
              )}
            </div>

            {/* Subtle red bottom indicator for playlists */}
            {card.isPlaylist && (
              <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-red-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
