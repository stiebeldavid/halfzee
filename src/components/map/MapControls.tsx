import React from 'react';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

interface MapControlsProps {
  map: mapboxgl.Map;
  onStartLocationSelect: (coordinates: [number, number]) => void;
  onEndLocationSelect: (coordinates: [number, number]) => void;
}

const MapControls = ({ map, onStartLocationSelect, onEndLocationSelect }: MapControlsProps) => {
  React.useEffect(() => {
    // Create geocoder controls
    const geocoderStart = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl as any,
      placeholder: 'Enter start location'
    });

    const geocoderEnd = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl as any,
      placeholder: 'Enter end location'
    });

    // Add geocoders to the designated divs
    const startContainer = document.getElementById('geocoder-start');
    const endContainer = document.getElementById('geocoder-end');
    
    if (startContainer && endContainer) {
      startContainer.appendChild(geocoderStart.onAdd(map));
      endContainer.appendChild(geocoderEnd.onAdd(map));
    }

    // Handle location selections
    geocoderStart.on('result', (e) => {
      const coordinates = e.result.geometry.coordinates as [number, number];
      onStartLocationSelect(coordinates);
    });

    geocoderEnd.on('result', (e) => {
      const coordinates = e.result.geometry.coordinates as [number, number];
      onEndLocationSelect(coordinates);
    });

    return () => {
      geocoderStart.onRemove();
      geocoderEnd.onRemove();
    };
  }, [map, onStartLocationSelect, onEndLocationSelect]);

  return null;
};

export default MapControls;