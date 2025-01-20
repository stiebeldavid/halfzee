import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { toast } from 'sonner';

interface MapProps {
  transportMode: string;
}

const Map = ({ transportMode }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  
  useEffect(() => {
    if (!mapContainer.current) return;
    
    const initializeMap = () => {
      if (!mapboxToken) {
        toast.error('Please enter your Mapbox token to use the map');
        return;
      }

      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-74.006, 40.7128],
        zoom: 12
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add geocoder controls
      const geocoderStart = new MapboxGeocoder({
        accessToken: mapboxToken,
        mapboxgl: mapboxgl,
        placeholder: 'Enter start location'
      });

      const geocoderEnd = new MapboxGeocoder({
        accessToken: mapboxToken,
        mapboxgl: mapboxgl,
        placeholder: 'Enter end location'
      });

      document.getElementById('geocoder-start')?.appendChild(geocoderStart.onAdd(map.current));
      document.getElementById('geocoder-end')?.appendChild(geocoderEnd.onAdd(map.current));

      // Handle location selections
      geocoderStart.on('result', (e) => {
        // Handle start location selection
        console.log('Start location:', e.result);
      });

      geocoderEnd.on('result', (e) => {
        // Handle end location selection
        console.log('End location:', e.result);
      });
    };

    initializeMap();

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  if (!mapboxToken) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6">
          <h2 className="text-lg font-semibold mb-4">Enter Mapbox Token</h2>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter your Mapbox public token"
            onChange={(e) => setMapboxToken(e.target.value)}
          />
          <p className="mt-2 text-sm text-gray-600">
            Get your token from <a href="https://www.mapbox.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Mapbox.com</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default Map;