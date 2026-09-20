import { useNavigate } from '@tanstack/react-router';
import {
  Bell,
  BellOff,
  Laptop,
  Mic2,
  Music,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { FC, useState } from 'react';

import {
  AppNotification,
  NotificationType,
  useNotificationStore,
} from '../stores/notificationStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';

export const MobileNotificationsSheet: FC = () => {
  const navigate = useNavigate();
  const { isOpen, close, notifications, clearAll } = useNotificationStore();
  const openSettings = useSettingsModalStore((state) => state.open);
  const [filter, setFilter] = useState<'all' | NotificationType>('all');

  if (!isOpen) {
    return null;
  }

  const filteredNotifications =
    filter === 'all'
      ? notifications
      : notifications.filter((notif) => notif.type === filter);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'music':
        return (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <Music className="size-5" />
          </div>
        );
      case 'update':
        return (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
            <Sparkles className="size-5" />
          </div>
        );
      case 'sync':
        return (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
            <Laptop className="size-5" />
          </div>
        );
      case 'podcast':
        return (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <Mic2 className="size-5" />
          </div>
        );
    }
  };

  const handleClickNotification = (notif: AppNotification) => {
    close();
    if (notif.type === 'update') {
      openSettings('whats-new');
    } else if (notif.type === 'sync') {
      openSettings('sync');
    } else if (notif.link) {
      void navigate({ to: notif.link as never });
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="notifications-backdrop"
        className="animate-in fade-in fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs duration-200"
        onClick={close}
      />

      {/* Sheet Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Centro de notificaciones"
        data-testid="notifications-sheet"
        className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-3xl border-t-2 border-white/10 bg-[#0c0f14] p-5 pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+2rem))] text-white shadow-2xl duration-300 select-none md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border md:border-white/10 md:pb-6"
      >
        {/* Grab Handle (mobile) */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Bell className="size-4" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Notificaciones
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white active:scale-95"
                title="Limpiar todas"
                aria-label="Limpiar todas las notificaciones"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white active:scale-95"
              aria-label="Cerrar notificaciones"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-3">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-all active:scale-95 ${
              filter === 'all'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'border border-white/10 bg-white/5 text-zinc-300'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilter('music')}
            className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-all active:scale-95 ${
              filter === 'music'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'border border-white/10 bg-white/5 text-zinc-300'
            }`}
          >
            Música
          </button>
          <button
            type="button"
            onClick={() => setFilter('update')}
            className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-all active:scale-95 ${
              filter === 'update'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'border border-white/10 bg-white/5 text-zinc-300'
            }`}
          >
            Actualizaciones
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
              <div className="mb-3 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <BellOff className="size-7 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-zinc-200">
                Sin notificaciones
              </p>
              <p className="mt-1 max-w-[240px] text-xs text-zinc-400">
                Te avisaremos cuando haya novedades, música recomendada o
                eventos del sistema.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                role="button"
                tabIndex={0}
                onClick={() => handleClickNotification(notif)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleClickNotification(notif);
                  }
                }}
                className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 transition-all hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.98]"
              >
                {getIcon(notif.type)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-xs font-bold text-white">
                      {notif.title}
                    </h3>
                    <span className="shrink-0 text-[10px] text-zinc-400">
                      {notif.timestamp}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-300">
                    {notif.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div
          className="pointer-events-none h-6 shrink-0 select-none md:hidden"
          aria-hidden="true"
        />
      </div>
    </>
  );
};
