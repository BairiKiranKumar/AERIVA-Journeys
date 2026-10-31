export type DestinationId = 'maldives' | 'bali';

export type Destination = {
  id: DestinationId;
  name: string;
  country: string;
  code: string;
  coordinates: string;
  eyebrow: string;
  headline: string;
  summary: string;
  description: string;
  latitude: number;
  longitude: number;
  image: string;
  tileImage: string;
  moments: string[];
  palette: 'ocean' | 'forest';
};

// Concept editorial photography. Replace with approved, locally hosted assets
// for a live client. Photo source and license review live in content-studio.
export const destinations: Destination[] = [
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'Indian Ocean',
    code: 'MV',
    coordinates: '04°17′N · 73°30′E',
    eyebrow: 'An invitation to slow down',
    headline: 'Nothing between you and the blue.',
    summary: 'Private islands. Endless horizons. The art of doing absolutely nothing.',
    description: 'Wake to water in every shade of blue. Discover open-sky dining, unhurried afternoons, and villas that become part of the horizon.',
    latitude: 4.3,
    longitude: 73.5,
    image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=2200&q=85',
    tileImage: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=82',
    moments: ['Overwater villas', 'Sunset cruises', 'Barefoot dining'],
    palette: 'ocean',
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    code: 'ID',
    coordinates: '08°24′S · 115°11′E',
    eyebrow: 'Where wonder feels natural',
    headline: 'A different rhythm awaits.',
    summary: 'Quiet sanctuaries, volcanic horizons, and beauty in every detail.',
    description: 'Let the island set the pace. Linger in lush valleys, wake to distant temple bells, and discover places worth taking your time with.',
    latitude: -8.4,
    longitude: 115.2,
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=2200&q=85',
    tileImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=82',
    moments: ['Jungle retreats', 'Cultural discoveries', 'Slow mornings'],
    palette: 'forest',
  },
];

export const destinationById = (id: DestinationId) =>
  destinations.find((destination) => destination.id === id) ?? destinations[0];
