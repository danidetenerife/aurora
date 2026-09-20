import { useNavigate } from '@tanstack/react-router';
import {
  ChevronRight,
  History,
  Laptop,
  ListMusic,
  Mic2,
  Music,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { FC } from 'react';

import { useAccountModalStore } from '../stores/accountModalStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';

export const MobileAccountSheet: FC = () => {
  const navigate = useNavigate();
  const { isOpen, close, userName } = useAccountModalStore();
  const openSettings = useSettingsModalStore((state) => state.open);

  if (!isOpen) {
    return null;
  }

  const handleNavigate = (path: string) => {
    close();
    void navigate({ to: path as never });
  };

  const handleOpenSettingsTab = (
    tab: 'general' | 'sync' | 'plugins' | 'whats-new',
  ) => {
    close();
    openSettings(tab);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="account-sheet-backdrop"
        className="animate-in fade-in fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs duration-200"
        onClick={close}
      />

      {/* Sheet Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cuenta y Perfil de Usuario"
        data-testid="account-sheet"
        className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-[70] flex max-h-[90vh] flex-col rounded-t-3xl border-t-2 border-white/10 bg-[#0c0f14] p-5 pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+2rem))] text-white shadow-2xl duration-300 select-none md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border md:border-white/10 md:pb-6"
      >
        {/* Grab handle (mobile) */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 md:hidden" />

        {/* Top bar with Close */}
        <div className="flex items-center justify-between pb-3">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Cuenta
          </span>
          <button
            type="button"
            onClick={close}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white active:scale-95"
            aria-label="Cerrar perfil"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-white/[0.02] p-4">
          <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-orange-600 to-rose-600 text-xl font-black text-white shadow-lg ring-2 shadow-orange-500/20 ring-white/30">
            {userName.charAt(0).toUpperCase()}
            <span className="absolute right-0 bottom-0 size-3.5 rounded-full bg-emerald-500 ring-2 ring-[#0c0f14]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-black tracking-tight text-white">
              {userName}
            </h2>
            <p className="truncate text-xs font-medium text-emerald-400">
              Modo Local & P2P Activo
            </p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              Aurora Music • Sin anuncios ni rastreo
            </p>
          </div>
        </div>

        {/* Scrollable Action List */}
        <div className="flex-1 space-y-4 overflow-y-auto pt-4 pr-1">
          {/* Section 1: Tu Música y Actividad */}
          <div className="space-y-1">
            <p className="px-1 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
              Tu música y actividad
            </p>

            <button
              type="button"
              onClick={() => handleNavigate('/history')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <History className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Historial y estadísticas
                  </p>
                  <p className="text-xs text-zinc-400">
                    Canciones escuchadas y minutos
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/favorites/tracks')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Music className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Canciones favoritas
                  </p>
                  <p className="text-xs text-zinc-400">
                    Tu biblioteca destacada
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/playlists')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <ListMusic className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Listas de reproducción
                  </p>
                  <p className="text-xs text-zinc-400">
                    Tus listas creadas e importadas
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/podcasts')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Mic2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Podcasts</p>
                  <p className="text-xs text-zinc-400">
                    Programas y episodios de YouTube Music
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>
          </div>

          {/* Section 2: Dispositivo y Configuración */}
          <div className="space-y-1 border-t border-white/10 pt-2">
            <p className="px-1 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
              Dispositivo y preferencias
            </p>

            <button
              type="button"
              onClick={() => handleOpenSettingsTab('sync')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Laptop className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Sincronización P2P
                  </p>
                  <p className="text-xs text-zinc-400">
                    Vincular con ordenador u otros dispositivos
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => handleOpenSettingsTab('general')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Settings className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Configuración</p>
                  <p className="text-xs text-zinc-400">
                    Idioma, reproducción y audio
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => handleOpenSettingsTab('whats-new')}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Novedades y notas de versión
                  </p>
                  <p className="text-xs text-zinc-400">
                    Ver últimos cambios aplicados
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Version Badge Footer */}
        <div className="border-t border-white/10 pt-3 text-center">
          <p className="text-[11px] text-zinc-400">
            Aurora Player • v0.0.10 • 100% Libre y Privado
          </p>
        </div>
        <div
          className="pointer-events-none h-6 shrink-0 select-none md:hidden"
          aria-hidden="true"
        />
      </div>
    </>
  );
};
