import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import MapControls from './MapControls';
import RouteDisplay from './RouteDisplay';
import { getDirections, findEquidistantPoint } from '@/utils/mapUtils';

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
  const [routeCoordinates, setRouteCoordinates] = useState<number[][]>([]);

  const findMidpoint = async () => {
    if (!startLocation || !endLocation || !map.current) {
      toast({
        title: "Missing Locations",
        description: "Please select both start and end locations first.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Stop any ongoing animations
      map.current.stop();

      // Get route directions
      const directionsData = await getDirections(startLocation, endLocation, transportMode);
      if (!directionsData?.routes[0]) {
        toast({
          title: "Route Error",
          description: "Could not find a route between the selected locations.",
          variant: "destructive"
        });
        return;
      }

      const coordinates = directionsData.routes[0].geometry.coordinates;
      setRouteCoordinates(coordinates);

      // Find the equidistant point
      const equidistantPoint = await findEquidistantPoint(
        coordinates,
        startLocation,
        endLocation,
        transportMode
      );
      
      if (!equidistantPoint) {
        toast({
          title: "Error",
          description: "Could not find an equidistant point.",
          variant: "destructive"
        });
        return;
      }

      setMidpoint(equidistantPoint as [number, number]);

      // Calculate bounds
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(startLocation);
      bounds.extend(endLocation);
      bounds.extend(equidistantPoint as [number, number]);

      // Remove any existing moveend listeners
      map.current.off('moveend');

      // Add one-time moveend listener for the first animation
      map.current.once('moveend', () => {
        // After centering, fit bounds to show all points
        map.current?.fitBounds(bounds, {
          padding: {
            top: 50,
            bottom: 50,
            left: 450,
            right: 50
          },
          maxZoom: 15,
          duration: 1000
        });
      });

      // Center the map on the midpoint first
      map.current.easeTo({
        center: equidistantPoint as [number, number],
        zoom: 12,
        duration: 1000,
        easing: (t) => t * (2 - t) // Ease out quad
      });

      if (onMidpointFound) {
        onMidpointFound(equidistantPoint as [number, number]);
      }

      toast({
        title: "Midpoint Found!",
        description: "The map has been centered on the equidistant point between your locations.",
      });
    } catch (error) {
      console.error('Error finding midpoint:', error);
      toast({
        title: "Error",
        description: "An error occurred while finding the midpoint.",
        variant: "destructive"
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
    findMidpoint
  }));

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      {map.current && (
        <>
          <MapControls
            map={map.current}
            onStartLocationChange={setStartLocation}
            onEndLocationChange={setEndLocation}
          />
          <RouteDisplay
            map={map.current}
            coordinates={routeCoordinates}
            midpoint={midpoint}
          />
        </>
      )}
    </div>
  );
});

Map.displayName = 'Map';

export default Map;