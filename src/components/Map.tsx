import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";

interface MapProps {
  transportMode: string;
}

const Map = ({ transportMode }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      try {
        const { data: { token }, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error('Error fetching Mapbox token:', error);
          return;
        }

        mapboxgl.accessToken = token || 'pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbHNldzNvYXQwMXVqMmtvMGw2ZjJ6YjQzIn0.qY4WrHzr0RaZhbVz6sLXDA';
        
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
          accessToken: mapboxgl.accessToken,
          mapboxgl: mapboxgl as any,
          placeholder: 'Enter start location'
        });

        const geocoderEnd = new MapboxGeocoder({
          accessToken: mapboxgl.accessToken,
          mapboxgl: mapboxgl as any,
          placeholder: 'Enter end location'
        });

        document.getElementById('geocoder-start')?.appendChild(geocoderStart.onAdd(map.current));
        document.getElementById('geocoder-end')?.appendChild(geocoderEnd.onAdd(map.current));

        // Handle location selections
        geocoderStart.on('result', (e) => {
          console.log('Start location:', e.result);
        });

        geocoderEnd.on('result', (e) => {
          console.log('End location:', e.result);
        });
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default Map;