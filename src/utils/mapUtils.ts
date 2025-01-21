import mapboxgl from 'mapbox-gl';
import { toast } from "@/components/ui/use-toast";
import { Coffee, Trees, ShoppingBag } from 'lucide-react';

export const getDirections = async (
  start: [number, number], 
  end: [number, number],
  transportMode: string
) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${transportMode}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching directions:', error);
    return null;
  }
};

export const findEquidistantPoint = async (
  routeCoordinates: number[][],
  startLocation: [number, number],
  endLocation: [number, number],
  transportMode: string
) => {
  const samples = 100;
  const sampledPoints = [];
  const totalPoints = routeCoordinates.length;
  
  for (let i = 0; i < samples; i++) {
    const index = Math.floor((i / samples) * totalPoints);
    sampledPoints.push(routeCoordinates[index]);
  }

  const travelTimes = await Promise.all(
    sampledPoints.map(async (point) => {
      const startTime = await getDirections(startLocation, [point[0], point[1]], transportMode)
        .then(data => data?.routes[0]?.duration || 0);
      const endTime = await getDirections([point[0], point[1]], endLocation, transportMode)
        .then(data => data?.routes[0]?.duration || 0);
        
      return {
        point,
        timeDifference: Math.abs(startTime - endTime),
        totalTime: startTime + endTime
      };
    })
  );

  const bestPoint = travelTimes
    .filter(Boolean)
    .sort((a, b) => a!.timeDifference - b!.timeDifference)[0];

  return bestPoint?.point || null;
};

export const clearMapElements = (map: mapboxgl.Map, currentMarker: mapboxgl.Marker | null) => {
  if (map.getLayer('route')) {
    map.removeLayer('route');
  }
  if (map.getSource('route')) {
    map.removeSource('route');
  }

  if (currentMarker) {
    currentMarker.remove();
  }
};

export const drawRoute = (map: mapboxgl.Map, coordinates: number[][]) => {
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    }
  });

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 4
    }
  });
};

export const searchNearbyPOIs = async (
  coordinates: [number, number],
  category: 'cafe' | 'park' | 'shopping',
  limit: number = 5
) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${category}.json?` +
      `proximity=${coordinates[0]},${coordinates[1]}&` +
      `limit=${limit}&` +
      `types=poi&` +
      `access_token=${mapboxgl.accessToken}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch POIs');
    }

    const data = await response.json();
    return data.features;
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return [];
  }
};

export const createPOIMarker = (map: mapboxgl.Map, poi: any, type: 'cafe' | 'park' | 'shopping') => {
  const el = document.createElement('div');
  el.className = 'poi-marker';
  el.style.width = '30px';
  el.style.height = '30px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.backgroundColor = 'white';
  el.style.borderRadius = '50%';
  el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

  const iconContainer = document.createElement('div');
  iconContainer.style.color = getIconColor(type);
  el.appendChild(iconContainer);

  const icon = getIconForType(type);
  iconContainer.innerHTML = icon;

  const marker = new mapboxgl.Marker(el)
    .setLngLat(poi.center)
    .setPopup(
      new mapboxgl.Popup({ offset: 25 })
        .setHTML(`<h3>${poi.text}</h3><p>${poi.properties.category || type}</p>`)
    )
    .addTo(map);

  return marker;
};

const getIconForType = (type: 'cafe' | 'park' | 'shopping') => {
  switch (type) {
    case 'cafe':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>';
    case 'park':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14h.01"/><path d="M7 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14"/></svg>';
    case 'shopping':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
    default:
      return '';
  }
};

const getIconColor = (type: 'cafe' | 'park' | 'shopping') => {
  switch (type) {
    case 'cafe':
      return '#8B4513';
    case 'park':
      return '#228B22';
    case 'shopping':
      return '#4A90E2';
    default:
      return '#000000';
  }
};
