import type { CartographicPosition } from './types';

export const KNOWN_LOCATIONS: Record<string, CartographicPosition> = {
  // Major US Cities
  'new york': { longitude: -74.006, latitude: 40.7128 },
  'new york city': { longitude: -74.006, latitude: 40.7128 },
  'nyc': { longitude: -74.006, latitude: 40.7128 },
  'los angeles': { longitude: -118.2437, latitude: 34.0522 },
  'la': { longitude: -118.2437, latitude: 34.0522 },
  'san francisco': { longitude: -122.4194, latitude: 37.7749 },
  'sf': { longitude: -122.4194, latitude: 37.7749 },
  'chicago': { longitude: -87.6298, latitude: 41.8781 },
  'houston': { longitude: -95.3698, latitude: 29.7604 },
  'miami': { longitude: -80.1918, latitude: 25.7617 },
  'seattle': { longitude: -122.3321, latitude: 47.6062 },
  'boston': { longitude: -71.0589, latitude: 42.3601 },
  'washington dc': { longitude: -77.0369, latitude: 38.9072 },
  'las vegas': { longitude: -115.1398, latitude: 36.1699 },

  // World Capitals
  'london': { longitude: -0.1276, latitude: 51.5074 },
  'paris': { longitude: 2.3522, latitude: 48.8566 },
  'tokyo': { longitude: 139.6917, latitude: 35.6895 },
  'beijing': { longitude: 116.4074, latitude: 39.9042 },
  'berlin': { longitude: 13.4050, latitude: 52.5200 },
  'rome': { longitude: 12.4964, latitude: 41.9028 },
  'madrid': { longitude: -3.7038, latitude: 40.4168 },
  'moscow': { longitude: 37.6173, latitude: 55.7558 },
  'seoul': { longitude: 126.9780, latitude: 37.5665 },
  'singapore': { longitude: 103.8198, latitude: 1.3521 },

  // Landmarks
  'eiffel tower': { longitude: 2.2945, latitude: 48.8584 },
  'statue of liberty': { longitude: -74.0445, latitude: 40.6892 },
  'great wall': { longitude: 116.5704, latitude: 40.4319 },
  'pyramids': { longitude: 31.1342, latitude: 29.9792 },
  'taj mahal': { longitude: 78.0421, latitude: 27.1751 },
  'burj khalifa': { longitude: 55.2744, latitude: 25.1972 },
  'golden gate bridge': { longitude: -122.4783, latitude: 37.8199 },
  'mount everest': { longitude: 86.9250, latitude: 27.9881 },
  'mount fuji': { longitude: 138.7274, latitude: 35.3606 },
};

export function resolveLocationName(locationName: string): CartographicPosition | null {
  const normalized = locationName.toLowerCase().trim();
  return KNOWN_LOCATIONS[normalized] || null;
}