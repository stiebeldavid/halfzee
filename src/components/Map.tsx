import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { MapProps, MapRef } from './map/types';
import MarkerManager from './map/MarkerManager';

const Map = forwardRef<MapRef, MapProps>(({ transportMode, onMidpointFound }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerManagerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      try {
        console.log('Fetching Mapbox token...');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error('Error fetching Mapbox token:', error);
          return;
        }

        if (!data?.token) {
          console.error('No token received from edge function');
          return;
        }

        console.log('Token received successfully');
        mapboxgl.accessToken = data.token;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [-74.006, 40.7128],
          zoom: 12
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

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

        geocoderStart.on('result', (e) => {
          console.log('Start location:', e.result);
          const coordinates = e.result.geometry.coordinates as [number, number];
          markerManagerRef.current?.setStartLocation(coordinates);
        });

        geocoderEnd.on('result', (e) => {
          console.log('End location:', e.result);
          const coordinates = e.result.geometry.coordinates as [number, number];
          markerManagerRef.current?.setEndLocation(coordinates);
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

  useImperativeHandle(ref, () => ({
    findMidpoint: () => {
      if (map.current) {
        markerManagerRef.current?.findMidpoint();
      }
    }
  }));

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      {map.current && (
        <MarkerManager
          ref={markerManagerRef}
          map={map.current}
          transportMode={transportMode}
          onMidpointFound={onMidpointFound}
        />
      )}
    </div>
  );
});

Map.displayName = 'Map';

export default Map;