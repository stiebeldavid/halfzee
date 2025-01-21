import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface MapProps {
  transportMode: string;
  onMidpointFound?: (midpoint: [number, number]) => void;
}

export interface MapRef {
  findMidpoint: () => void;
}

const Map = forwardRef<MapRef, MapProps>(({ transportMode, onMidpointFound }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [startLocation, setStartLocation] = useState<[number, number] | null>(null);
  const [endLocation, setEndLocation] = useState<[number, number] | null>(null);
  const [midpoint, setMidpoint] = useState<[number, number] | null>(null);
  
  const calculateMidpoint = () => {
    if (!startLocation || !endLocation) {
      toast({
        title: "Missing Locations",
        description: "Please select both start and end locations first.",
        variant: "destructive"
      });
      return null;
    }

    const mid: [number, number] = [
      (startLocation[0] + endLocation[0]) / 2,
      (startLocation[1] + endLocation[1]) / 2
    ];
    return mid;
  };

  const findMidpoint = () => {
    const mid = calculateMidpoint();
    if (mid && map.current) {
      setMidpoint(mid);
      
      // Remove existing midpoint marker if it exists
      const existingMarker = document.querySelector('.midpoint-marker');
      if (existingMarker) {
        existingMarker.remove();
      }

      // Add marker at midpoint
      const markerElement = document.createElement('div');
      markerElement.className = 'midpoint-marker';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      markerElement.style.backgroundSize = 'cover';
      
      new mapboxgl.Marker(markerElement)
        .setLngLat(mid)
        .addTo(map.current);

      // Fly to midpoint
      map.current.flyTo({
        center: mid,
        zoom: 13,
        essential: true
      });

      if (onMidpointFound) {
        onMidpointFound(mid);
      }

      toast({
        title: "Midpoint Found!",
        description: "The map has been centered on the midpoint between your locations.",
      });
    }
  };
  
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
          const coordinates = e.result.geometry.coordinates as [number, number];
          setStartLocation(coordinates);
        });

        geocoderEnd.on('result', (e) => {
          console.log('End location:', e.result);
          const coordinates = e.result.geometry.coordinates as [number, number];
          setEndLocation(coordinates);
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

  // Expose findMidpoint method to parent component
  useImperativeHandle(ref, () => ({
    findMidpoint
  }));

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
});

Map.displayName = 'Map';

export default Map;