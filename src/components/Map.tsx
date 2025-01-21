import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import MapControls from './map/MapControls';
import MapMarkers from './map/MapMarkers';
import { getDirections, findEquidistantPoint, drawRoute } from './map/MapRouting';
import { searchNearbyPlaces } from './map/PlacesSearch';

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
  const [places, setPlaces] = useState<any[]>([]);

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

      // Draw route and find midpoint
      const coordinates = directionsData.routes[0].geometry.coordinates;
      drawRoute(map.current, coordinates);

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

      // Search for nearby places
      const foundPlaces = await searchNearbyPlaces(equidistantPoint as [number, number], mapboxgl.accessToken);
      setPlaces(foundPlaces);

      // Calculate bounds
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(startLocation[0], endLocation[0], equidistantPoint[0]), 
         Math.min(startLocation[1], endLocation[1], equidistantPoint[1])],
        [Math.max(startLocation[0], endLocation[0], equidistantPoint[0]),
         Math.max(startLocation[1], endLocation[1], equidistantPoint[1])]
      );

      // Animate to midpoint then fit bounds
      map.current.once('moveend', () => {
        map.current?.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 450, right: 50 },
          maxZoom: 15,
          duration: 1000
        });
      });

      map.current.easeTo({
        center: equidistantPoint as [number, number],
        zoom: 12,
        duration: 1000,
        easing: (t) => t * (2 - t)
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

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
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
            onStartLocationSelect={setStartLocation}
            onEndLocationSelect={setEndLocation}
          />
          <MapMarkers
            map={map.current}
            places={places}
            midpoint={midpoint}
          />
        </>
      )}
    </div>
  );
});

Map.displayName = 'Map';

export default Map;