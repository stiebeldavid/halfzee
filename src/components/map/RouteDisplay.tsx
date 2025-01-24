import React from 'react';
import mapboxgl from 'mapbox-gl';

interface RouteDisplayProps {
  map: mapboxgl.Map;
  coordinates: number[][];
}

const RouteDisplay: React.FC<RouteDisplayProps> = ({ map, coordinates }) => {
  React.useEffect(() => {
    // Remove existing route layer and source
    if (map.getLayer('route')) {
      map.removeLayer('route');
    }
    if (map.getSource('route')) {
      map.removeSource('route');
    }

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

    return () => {
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
    };
  }, [map, coordinates]);

  return null;
};

export default RouteDisplay;