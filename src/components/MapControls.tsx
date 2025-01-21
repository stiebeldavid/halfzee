import React from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

interface MapControlsProps {
  map: mapboxgl.Map;
  onStartLocationChange: (coordinates: [number, number]) => void;
  onEndLocationChange: (coordinates: [number, number]) => void;
}

const MapControls = ({ map, onStartLocationChange, onEndLocationChange }: MapControlsProps) => {
  React.useEffect(() => {
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

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

    // Add geocoders to designated divs
    const startContainer = document.getElementById('geocoder-start');
    const endContainer = document.getElementById('geocoder-end');
    
    if (startContainer && endContainer) {
      startContainer.appendChild(geocoderStart.onAdd(map));
      endContainer.appendChild(geocoderEnd.onAdd(map));
    }

    // Handle location selections
    geocoderStart.on('result', (e) => {
      console.log('Start location:', e.result);
      const coordinates = e.result.geometry.coordinates as [number, number];
      onStartLocationChange(coordinates);
    });

    geocoderEnd.on('result', (e) => {
      console.log('End location:', e.result);
      const coordinates = e.result.geometry.coordinates as [number, number];
      onEndLocationChange(coordinates);
    });

    return () => {
      map.removeControl(geocoderStart);
      map.removeControl(geocoderEnd);
    };
  }, [map, onStartLocationChange, onEndLocationChange]);

  return null;
};

export default MapControls;