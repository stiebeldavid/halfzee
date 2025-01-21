import React from 'react';
import mapboxgl from 'mapbox-gl';

interface RouteDisplayProps {
  map: mapboxgl.Map;
  coordinates: number[][];
  midpoint: [number, number] | null;
}

const RouteDisplay = ({ map, coordinates, midpoint }: RouteDisplayProps) => {
  React.useEffect(() => {
    if (!coordinates.length) return;

    // Add the route to the map
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
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

    // Add marker at midpoint if available
    if (midpoint) {
      const markerElement = document.createElement('div');
      markerElement.className = 'midpoint-marker';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      markerElement.style.backgroundSize = 'cover';
      
      new mapboxgl.Marker(markerElement)
        .setLngLat(midpoint)
        .addTo(map);
    }

    return () => {
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
    };
  }, [map, coordinates, midpoint]);

  return null;
};

export default RouteDisplay;