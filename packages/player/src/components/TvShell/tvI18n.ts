import { i18n } from '@aurora/i18n';

export const tvI18n: typeof i18n = i18n.cloneInstance({
  lng: 'es_ES',
  fallbackLng: 'es_ES',
  forkResourceStore: true,
});
tvI18n.addResourceBundle(
  'es_ES',
  'tv',
  {
    home: 'Inicio',
    search: 'Buscar',
    favorites: 'Favoritos',
    playlists: 'Listas',
    queue: 'Cola',
    player: 'Reproductor',
    play: 'Reproducir',
    pause: 'Pausar',
    previous: 'Anterior',
    next: 'Siguiente',
    shuffle: 'Aleatorio',
    repeat: 'Repetir',
    enableVideo: 'Activar videoclip',
    disableVideo: 'Ocultar videoclip',
    nothingPlaying: 'Elige una canción',
    empty: 'Busca música para empezar a escuchar',
    emptyList: 'Todavía no hay canciones aquí',
    closeSearch: 'Cerrar búsqueda',
    loading: 'Cargando…',
    noResults: 'No se encontraron canciones',
    noProvider: 'No hay un proveedor de música disponible',
    playbackError: 'No se pudo reproducir. Prueba otra canción.',
    hint: '↓ Controles de reproducción · ↑ Menú · OK Seleccionar',
    more: 'Mostrar más',
  },
  true,
  true,
);
