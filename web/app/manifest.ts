import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FörderFinder',
    short_name: 'FörderFinder',
    description:
      'Allgemeine Informationen und Orientierung zu Förderprogrammen in Deutschland. Keine Rechtsberatung.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f766e',
    lang: 'de',
    categories: ['finance', 'government', 'lifestyle'],
  };
}
