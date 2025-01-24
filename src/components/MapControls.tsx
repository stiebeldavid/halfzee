import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

interface MapControlsProps {
  map: mapboxgl.Map | null;
  mapboxToken: string;
  onLocationSelect: (location: { lat: number; lng: number }) => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  map,
  mapboxToken,
  onLocationSelect,
}) => {
  useEffect(() => {
    if (!map || !mapboxToken) return;

    const geocoderStart = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Enter start location',
    });

    const geocoderEnd = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Enter end location',
    });

    const startContainer = document.getElementById('geocoder-start');
    const endContainer = document.getElementById('geocoder-end');

    if (startContainer && endContainer) {
      startContainer.replaceChildren();
      endContainer.replaceChildren();
      startContainer.appendChild(geocoderStart.onAdd(map));
      endContainer.appendChild(geocoderEnd.onAdd(map));
    }

    geocoderStart.on('result', (e) => {
      const [lng, lat] = e.result.center;
      onLocationSelect({ lng, lat });
    });

    geocoderEnd.on('result', (e) => {
      const [lng, lat] = e.result.center;
      onLocationSelect({ lng, lat });
    });

    return () => {
      geocoderStart.onRemove();
      geocoderEnd.onRemove();
    };
  }, [map, mapboxToken, onLocationSelect]);

  return null;
};