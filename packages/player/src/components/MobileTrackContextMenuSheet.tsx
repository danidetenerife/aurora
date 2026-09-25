import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  ArrowLeft,
  Disc,
  Heart,
  ListEnd,
  ListMusic,
  ListPlus,
  ListStart,
  Play,
  Plus,
  ThumbsDown,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { FC, useState } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import { Button, Input } from '@aurora/ui';

import { useTrackActions } from '../hooks/useTrackActions';
import { personalizationEngine } from '../services/personalizationEngine';
import { isCapacitorEnvironment } from '../services/universalStore';
import { useMobilePlayerStore } from '../stores/mobilePlayerStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useProvidersStore } from '../stores/providersStore';

export const MobileTrackContextMenuSheet: FC = () => {
  const { t } = useTranslation('track');
  const { t: tCommon } = useTranslation('common');
  const { t: tPlaylists } = useTranslation('playlists');
  const navigate = useNavigate();
  const trackActions = useTrackActions();

  const [sheetView, setSheetView] = useState<
    'main' | 'playlist_select' | 'create_playlist'
  >('main');
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const { activeContextTrack, closeContextMenu, closeExpanded } =
    useMobilePlayerStore();

  const playlists = usePlaylistStore((state) => state.index);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTracksToPlaylist = usePlaylistStore((state) => state.addTracks);
  const removeTracks = usePlaylistStore((state) => state.removeTracks);

  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const currentPlaylistId = currentPath.startsWith('/playlists/')
    ? currentPath.split('/')[2]
    : undefined;

  const currentPlaylist = usePlaylistStore((state) =>
    currentPlaylistId ? state.playlists.get(currentPlaylistId) : undefined,
  );

  const isFavorite = activeContextTrack
    ? trackActions.isFavorite(activeContextTrack)
    : false;

  const matchingPlaylistItem =
    currentPlaylist && activeContextTrack
      ? currentPlaylist.items.find(
          (item) =>
            (item.track.source?.id &&
              item.track.source?.id === activeContextTrack.source?.id) ||
            (item.track.title.toLowerCase().trim() ===
              activeContextTrack.title.toLowerCase().trim() &&
              item.track.artists?.[0]?.name?.toLowerCase().trim() ===
                activeContextTrack.artists?.[0]?.name?.toLowerCase().trim()),
        )
      : undefined;

  if (!isCapacitorEnvironment() || !activeContextTrack) {
    return null;
  }

  const track = activeContextTrack;
  const thumbnail = pickArtwork(track.artwork, 'thumbnail', 96)?.url;
  const artistNames = track.artists?.map((a) => a.name).join(', ') ?? '';

  const handleDismiss = () => {
    setSheetView('main');
    setNewPlaylistName('');
    closeContextMenu();
  };

  const handleBlacklistTrack = () => {
    const trackId =
      track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
    void personalizationEngine.blacklistTrack(trackId);
    toast.success(t('actions.trackBlacklisted'), {
      action: {
        label: tCommon('actions.undo'),
        onClick: () => {
          void personalizationEngine.unblacklistTrack(trackId);
        },
      },
    });
    handleDismiss();
  };

  const handleToggleFavorite = () => {
    trackActions.toggleFavorite(track);
    if (isFavorite) {
      toast.success(
        t('actions.removedFromFavorites', {
          defaultValue: 'Eliminada de favoritos',
        }),
      );
    } else {
      toast.success(
        t('actions.addedToFavorites', { defaultValue: 'Añadida a favoritos' }),
      );
    }
    handleDismiss();
  };

  const handleRemoveFromPlaylist = async () => {
    if (currentPlaylistId && matchingPlaylistItem) {
      await removeTracks(currentPlaylistId, [matchingPlaylistItem.id]);
      toast.success(
        tPlaylists('trackRemoved', {
          defaultValue: 'Canción eliminada de la lista',
        }),
      );
      handleDismiss();
    }
  };

  const handlePlayNow = () => {
    trackActions.playNow(track);
    handleDismiss();
  };

  const handlePlayNext = () => {
    trackActions.addNext(track);
    handleDismiss();
  };

  const handleAddToQueue = () => {
    trackActions.addToQueue(track);
    handleDismiss();
  };

  const handleGoToArtist = () => {
    const artistSource = track.artists?.[0]?.source;
    const artistName = track.artists?.[0]?.name;
    if (!artistSource && !artistName) {
      return;
    }
    handleDismiss();
    closeExpanded();
    if (artistSource?.provider && artistSource?.id) {
      void navigate({
        to: '/artist/$providerId/$artistId',
        params: {
          providerId: artistSource.provider,
          artistId: artistSource.id,
        },
      });
    } else if (artistName) {
      const activeMetadata =
        useProvidersStore.getState().getActive('metadata') ?? 'spotify';
      void navigate({
        to: `/artist/${activeMetadata}/${encodeURIComponent(artistName)}`,
      });
    }
  };

  const handleGoToAlbum = () => {
    const albumSource = track.album?.source;
    const albumTitle = track.album?.title;
    if (!albumSource && !albumTitle) {
      return;
    }
    handleDismiss();
    closeExpanded();
    if (albumSource?.provider && albumSource?.id) {
      void navigate({
        to: '/album/$providerId/$albumId',
        params: {
          providerId: albumSource.provider,
          albumId: albumSource.id,
        },
      });
    } else if (albumTitle) {
      const activeMetadata =
        useProvidersStore.getState().getActive('metadata') ?? 'spotify';
      void navigate({
        to: `/album/${activeMetadata}/${encodeURIComponent(albumTitle)}`,
      });
    }
  };

  const handleSelectPlaylist = async (playlistId: string, name: string) => {
    await addTracksToPlaylist(playlistId, [track]);
    toast.success(`Añadida a "${name}"`);
    handleDismiss();
  };

  const handleCreateAndAddToPlaylist = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      return;
    }
    try {
      const newId = await createPlaylist(trimmed);
      await addTracksToPlaylist(newId, [track]);
      toast.success(`Lista "${trimmed}" creada y canción añadida`);
      handleDismiss();
    } catch {
      toast.error('Error al crear la lista');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="mobile-context-menu-backdrop"
        className="animate-in fade-in fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs duration-200"
        onClick={handleDismiss}
      />

      {/* Slide-up Bottom Sheet */}
      <div
        data-testid="mobile-context-menu-sheet"
        className="bg-background-secondary border-border animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-[60] flex max-h-[85vh] flex-col overflow-y-auto rounded-t-3xl border-t-2 p-5 pb-10 shadow-2xl duration-300 select-none"
      >
        {/* Grab handle */}
        <div className="bg-border mx-auto mb-4 h-1.5 w-12 rounded-full" />

        {/* View 1: Main Actions */}
        {sheetView === 'main' && (
          <>
            {/* Track Header */}
            <div className="border-border flex items-center gap-3 border-b pb-3">
              <div className="border-border bg-card size-14 shrink-0 overflow-hidden rounded-xl border">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={track.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="bg-card text-foreground-secondary flex h-full w-full items-center justify-center">
                    <Disc className="size-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-foreground text-base leading-tight font-bold break-words">
                  {track.title}
                </h3>
                <p className="text-foreground-secondary mt-0.5 text-xs leading-tight break-words">
                  {artistNames}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="border-border text-foreground hover:bg-card shrink-0 cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* YouTube Music Benchmark Domain 7: 3-Card Hero Action Grid */}
            <div className="my-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handlePlayNow}
                data-testid="sheet-hero-play-now"
                className="border-border bg-card hover:bg-background-secondary flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center shadow-xs transition-all active:scale-95"
              >
                <div className="bg-primary/20 text-primary flex size-10 items-center justify-center rounded-full">
                  <Play className="ml-0.5 size-5 fill-current" />
                </div>
                <span className="text-foreground text-[11px] leading-tight font-bold">
                  Reproducir
                </span>
              </button>

              <button
                type="button"
                onClick={handlePlayNext}
                data-testid="sheet-hero-play-next"
                className="border-border bg-card hover:bg-background-secondary flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center shadow-xs transition-all active:scale-95"
              >
                <div className="bg-primary/20 text-primary flex size-10 items-center justify-center rounded-full">
                  <ListStart className="size-5" />
                </div>
                <span className="text-foreground text-[11px] leading-tight font-bold">
                  A continuación
                </span>
              </button>

              <button
                type="button"
                onClick={handleAddToQueue}
                data-testid="sheet-hero-add-queue"
                className="border-border bg-card hover:bg-background-secondary flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center shadow-xs transition-all active:scale-95"
              >
                <div className="bg-primary/20 text-primary flex size-10 items-center justify-center rounded-full">
                  <ListEnd className="size-5" />
                </div>
                <span className="text-foreground text-[11px] leading-tight font-bold">
                  A la cola
                </span>
              </button>
            </div>

            {/* Secondary Actions List */}
            <div className="flex flex-col gap-1">
              {/* Favorite */}
              <button
                type="button"
                onClick={handleToggleFavorite}
                className="hover:bg-card flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.98]"
                data-testid="mobile-sheet-toggle-favorite"
              >
                {isFavorite ? (
                  <>
                    <Trash2 className="text-accent-red size-5" />
                    <span className="text-accent-red text-sm font-semibold">
                      {t('actions.removeFromFavorites', {
                        defaultValue: 'Eliminar de favoritos',
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <Heart className="text-foreground size-5" />
                    <span className="text-foreground text-sm font-semibold">
                      {t('actions.addToFavorites', {
                        defaultValue: 'Añadir a favoritos',
                      })}
                    </span>
                  </>
                )}
              </button>

              {/* Remove from this playlist if in a playlist */}
              {matchingPlaylistItem && (
                <button
                  type="button"
                  onClick={handleRemoveFromPlaylist}
                  className="hover:bg-card flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.98]"
                  data-testid="mobile-sheet-remove-from-playlist"
                >
                  <Trash2 className="text-accent-red size-5" />
                  <span className="text-accent-red text-sm font-semibold">
                    {tPlaylists('removeFromPlaylist', {
                      defaultValue: 'Eliminar de esta lista',
                    })}
                  </span>
                </button>
              )}

              {/* Dislike / Blacklist */}
              <button
                type="button"
                onClick={handleBlacklistTrack}
                className="hover:bg-card flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.98]"
              >
                <ThumbsDown className="text-foreground size-5" />
                <span className="text-foreground text-sm font-semibold">
                  {t('actions.dislike')}
                </span>
              </button>

              {/* Add to Playlist -> Opens Dedicated Playlist Subview */}
              <button
                type="button"
                onClick={() => setSheetView('playlist_select')}
                className="hover:bg-card flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.98]"
                data-testid="mobile-sheet-open-playlists"
              >
                <ListPlus className="text-foreground size-5" />
                <span className="text-foreground text-sm font-semibold">
                  {tPlaylists('addToPlaylist', {
                    defaultValue: 'Añadir a lista de reproducción',
                  })}
                </span>
              </button>

              {/* Go to Artist */}
              {track.artists?.[0]?.source?.id && (
                <button
                  type="button"
                  onClick={handleGoToArtist}
                  className="hover:bg-card flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.98]"
                  data-testid="mobile-sheet-go-to-artist"
                >
                  <User className="text-foreground size-5" />
                  <span className="text-foreground text-sm font-semibold">
                    Ver artista ({track.artists[0]?.name})
                  </span>
                </button>
              )}

              {/* Go to Album */}
              {track.album?.source?.id && (
                <button
                  type="button"
                  onClick={handleGoToAlbum}
                  className="hover:bg-card flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.98]"
                  data-testid="mobile-sheet-go-to-album"
                >
                  <Disc className="text-foreground size-5" />
                  <span className="text-foreground text-sm font-semibold">
                    Ver álbum ({track.album.title})
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        {/* View 2: Playlist Selection Subview */}
        {sheetView === 'playlist_select' && (
          <div className="flex flex-col gap-3">
            <div className="border-border flex items-center justify-between border-b pb-2">
              <button
                type="button"
                onClick={() => setSheetView('main')}
                className="border-border text-foreground hover:bg-card cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                aria-label="Volver"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h3 className="text-foreground text-base font-bold">
                {tPlaylists('addToPlaylist', {
                  defaultValue: 'Añadir a lista',
                })}
              </h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="border-border text-foreground hover:bg-card cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Create new playlist button */}
            <button
              type="button"
              onClick={() => setSheetView('create_playlist')}
              className="border-border bg-card/60 hover:bg-card flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-3.5 text-left transition-all active:scale-[0.98]"
              data-testid="mobile-sheet-create-playlist-btn"
            >
              <div className="bg-primary/20 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Plus className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-bold">
                  {tPlaylists('newPlaylist', {
                    defaultValue: 'Nueva lista de reproducción',
                  })}
                </span>
                <span className="text-foreground-secondary block text-xs">
                  Crear una nueva lista y añadir esta canción
                </span>
              </div>
            </button>

            {/* Existing Playlists list */}
            <div className="mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {playlists.length === 0 ? (
                <div className="text-foreground-secondary py-6 text-center text-xs">
                  No tienes listas creadas aún. ¡Crea una pulsando arriba!
                </div>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleSelectPlaylist(pl.id, pl.name)}
                    className="hover:bg-card flex cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left transition-all active:scale-[0.98]"
                    data-testid={`mobile-sheet-playlist-${pl.id}`}
                  >
                    <div className="bg-background border-border text-foreground-secondary flex size-10 shrink-0 items-center justify-center rounded-lg border">
                      <ListMusic className="text-primary size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground block text-sm leading-snug font-semibold break-normal [overflow-wrap:anywhere] whitespace-normal">
                        {pl.name}
                      </span>
                      <span className="text-foreground-secondary block text-xs">
                        Lista de reproducción
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* View 3: Create Playlist Subview */}
        {sheetView === 'create_playlist' && (
          <div className="flex flex-col gap-4">
            <div className="border-border flex items-center justify-between border-b pb-2">
              <button
                type="button"
                onClick={() => setSheetView('playlist_select')}
                className="border-border text-foreground hover:bg-card cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                aria-label="Volver"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h3 className="text-foreground text-base font-bold">
                Nueva lista de reproducción
              </h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="border-border text-foreground hover:bg-card cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 py-2">
              <label
                htmlFor="mobile-new-playlist-input"
                className="text-foreground-secondary text-xs font-bold"
              >
                Nombre de la lista
              </label>
              <Input
                id="mobile-new-playlist-input"
                placeholder="Mi lista personalizada..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleCreateAndAddToPlaylist();
                  }
                }}
                autoFocus
                className="w-full"
                data-testid="mobile-new-playlist-name-input"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setSheetView('playlist_select')}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                disabled={!newPlaylistName.trim()}
                onClick={() => void handleCreateAndAddToPlaylist()}
                data-testid="mobile-create-playlist-confirm-btn"
              >
                Crear y añadir
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
