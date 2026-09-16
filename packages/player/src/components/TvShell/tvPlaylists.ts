export type PopularTvPlaylist = {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  src: string;
};

export const POPULAR_YOUTUBE_PLAYLISTS: PopularTvPlaylist[] = [
  {
    id: 'pop_hits',
    title: "Today's Top Hits",
    subtitle: 'Los mayores éxitos mundiales',
    query: 'Today Top Hits Pop',
    src: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop',
  },
  {
    id: 'viva_latino',
    title: 'Viva Latino',
    subtitle: 'Reggaeton, Trap y Ritmos Latinos',
    query: 'Viva Latino Reggaeton Éxitos',
    src: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop',
  },
  {
    id: 'yt_trends',
    title: 'Tendencias Globales',
    subtitle: 'Canciones más escuchadas en YouTube',
    query: 'Trending Music Global Hits',
    src: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop',
  },
  {
    id: 'rock_classics',
    title: 'Rock Classics',
    subtitle: 'Grandes leyendas e himnos del rock',
    query: 'Classic Rock Greatest Hits',
    src: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop',
  },
  {
    id: 'chill_lofi',
    title: 'Chill & Lo-Fi Beats',
    subtitle: 'Para estudiar, relajarse y concentrarse',
    query: 'Lo-Fi Chill Hop Beats',
    src: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop',
  },
  {
    id: 'electro_dance',
    title: 'Electro & Dance Hits',
    subtitle: 'EDM, House, Club y Electrónica',
    query: 'EDM Dance Electronic Hits',
    src: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop',
  },
  {
    id: 'hiphop_urban',
    title: 'Hip-Hop & Urban',
    subtitle: 'Rap, Beats pesados y Flow urbano',
    query: 'Top Hip-Hop Rap Hits',
    src: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop',
  },
  {
    id: 'pop_internacional',
    title: 'Pop Internacional',
    subtitle: 'Grandes estrellas y nuevos lanzamientos',
    query: 'Pop Music Top Global',
    src: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=600&auto=format&fit=crop',
  },
  {
    id: 'top_spain',
    title: 'Top Éxitos España',
    subtitle: 'Lo más viral y sonado en español',
    query: 'Top Exitos España Hits',
    src: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop',
  },
  {
    id: 'acoustic_morning',
    title: 'Acoustic & Soft',
    subtitle: 'Guitarras acústicas y voces suaves',
    query: 'Acoustic Pop Chill Relax',
    src: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=600&auto=format&fit=crop',
  },
  {
    id: 'workout_energy',
    title: 'Workout Motivation',
    subtitle: 'Ritmo alto y motivación máxima',
    query: 'Workout Motivation Gym Music',
    src: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop',
  },
  {
    id: 'jazz_soul',
    title: 'Jazz & Soul Classics',
    subtitle: 'Groove atemporal y atmósfera relajada',
    query: 'Jazz Soul Classics Greatest',
    src: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop',
  },
  {
    id: 'indie_vibes',
    title: 'Indie & Alternative',
    subtitle: 'Gemas independientes y guitarras indie',
    query: 'Indie Rock Alternative Hits',
    src: 'https://images.unsplash.com/photo-1445985543470-41fdd6ce388d?w=600&auto=format&fit=crop',
  },
  {
    id: 'retrowave_80s',
    title: '80s & 90s Golden Hits',
    subtitle: 'Los clásicos inolvidables de dos décadas',
    query: '80s 90s Greatest Hits',
    src: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&auto=format&fit=crop',
  },
];
