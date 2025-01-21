import React from 'react';
import mapboxgl from 'mapbox-gl';

interface MapMarkersProps {
  map: mapboxgl.Map;
  places: any[];
  midpoint: [number, number] | null;
}

export const createPlaceMarker = (
  map: mapboxgl.Map,
  place: any
): mapboxgl.Marker => {
  const coordinates = place.center;
  const name = place.text;
  
  // Parse place details
  const placeDetails = place.properties || {};
  const category = placeDetails.category || 
                  (place.place_type && place.place_type[0]) || 
                  'venue';
                  
  // Get address
  const fullAddress = place.place_name;
  const address = fullAddress.split(',')[0];

  // Create marker element
  const el = document.createElement('div');
  el.className = 'place-marker';
  el.style.width = '20px';
  el.style.height = '20px';
  
  const isCoffeeShop = 
    category.toLowerCase().includes('coffee') || 
    category.toLowerCase().includes('cafe') ||
    name.toLowerCase().includes('starbucks');
    
  el.style.backgroundImage = isCoffeeShop ?
    'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)' :
    'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
  el.style.backgroundSize = 'cover';
  el.style.cursor = 'pointer';

  // Create popup
  const popup = new mapboxgl.Popup({ offset: 25 })
    .setHTML(`
      <strong>${name}</strong><br>
      ${category ? `${category}<br>` : ''}
      ${address ? `${address}` : ''}
    `);

  // Create and return marker
  return new mapboxgl.Marker(el)
    .setLngLat(coordinates)
    .setPopup(popup)
    .addTo(map);
};

export const createMidpointMarker = (
  map: mapboxgl.Map,
  point: [number, number]
): mapboxgl.Marker => {
  const markerElement = document.createElement('div');
  markerElement.className = 'midpoint-marker';
  markerElement.style.width = '25px';
  markerElement.style.height = '25px';
  markerElement.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
  markerElement.style.backgroundSize = 'cover';
  
  return new mapboxgl.Marker(markerElement)
    .setLngLat(point)
    .addTo(map);
};

const MapMarkers: React.FC<MapMarkersProps> = ({ map, places, midpoint }) => {
  const markersRef = React.useRef<mapboxgl.Marker[]>([]);

  React.useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add place markers
    if (places.length > 0) {
      const newMarkers = places.map(place => createPlaceMarker(map, place));
      markersRef.current = [...markersRef.current, ...newMarkers];
    }

    // Add midpoint marker
    if (midpoint) {
      const midpointMarker = createMidpointMarker(map, midpoint);
      markersRef.current.push(midpointMarker);
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
    };
  }, [map, places, midpoint]);

  return null;
};

export default MapMarkers;