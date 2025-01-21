import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import MarkerManager from './map/MarkerManager';
import { MapProps } from './map/types';

export interface MapRef {
  findMidpoint: () => void;
}

const Map = forwardRef<MapRef, MapProps>(({ transportMode, onMidpointFound }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerManagerRef = useRef<any>(null);
  const startGeocoderRef = useRef<MapboxGeocoder | null>(null);
  const endGeocoderRef = useRef<MapboxGeocoder | null>(null);

  useImperativeHandle(ref, () => ({
    findMidpoint: () => {
      markerManagerRef.current?.findMidpoint();
    }
  }));

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initializeMap = async () => {
      const response = await fetch('/api/get-mapbox-token');
      const { token } = await response.json();
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-74.5, 40],
        zoom: 9
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Initialize geocoders with the correct type
      startGeocoderRef.current = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: (mapboxgl as any),
        marker: false,
        placeholder: 'Enter start location'
      });

      endGeocoderRef.current = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: (mapboxgl as any),
        marker: false,
        placeholder: 'Enter end location'
      });

      // Add geocoder result listeners
      startGeocoderRef.current.on('result', (e) => {
        const coordinates = e.result.center;
        markerManagerRef.current?.setStartLocation(coordinates);
      });

      endGeocoderRef.current.on('result', (e) => {
        const coordinates = e.result.center;
        markerManagerRef.current?.setEndLocation(coordinates);
      });
    };

    initializeMap().catch(console.error);

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
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