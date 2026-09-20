import { create } from 'zustand';

export type NotificationType = 'music' | 'update' | 'sync' | 'podcast';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
};

type NotificationState = {
  isOpen: boolean;
  notifications: AppNotification[];
  open: () => void;
  close: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
};

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-welcome-1',
    type: 'update',
    title: 'Nueva versión de Aurora disponible',
    description:
      'Interfaz renovada con panel moderno, experiencia 100% en español y mayor fluidez.',
    timestamp: 'Hace 5 m',
    isRead: false,
  },
  {
    id: 'notif-music-2',
    type: 'music',
    title: 'Música recomendada para ti',
    description:
      'Tus canciones favoritas y listas destacadas ya están sincronizadas.',
    timestamp: 'Hoy',
    isRead: false,
    link: '/dashboard',
  },
  {
    id: 'notif-sync-3',
    type: 'sync',
    title: 'Sincronización P2P activa',
    description:
      'Conecta tu móvil con tu ordenador local para compartir listas y favoritos sin cables.',
    timestamp: 'Ayer',
    isRead: true,
  },
];

export const useNotificationStore = create<NotificationState>((set) => ({
  isOpen: false,
  notifications: DEFAULT_NOTIFICATIONS,
  open: () =>
    set((state) => ({
      isOpen: true,
      notifications: state.notifications.map((item) => ({
        ...item,
        isRead: true,
      })),
    })),
  close: () => set({ isOpen: false }),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({
        ...item,
        isRead: true,
      })),
    })),
  clearAll: () => set({ notifications: [] }),
}));
