import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import { toast } from "@/components/ui/use-toast";
import { MarkerManagerProps, LocationState } from './types';
import { getDirections, findEquidistantPoint, clearMapElements, drawRoute } from '@/utils/mapUtils';

const MarkerManager = forwardRef<any, MarkerManagerProps>(({ map, transportMode, onMidpointFound }, ref) => {
  const [locations, setLocations] = useState<LocationState>({
    start: null,
    end: null,
    midpoint: null,
    currentMarker: null
  });

  const findMidpoint = async () => {
    const { start, end } = locations;
    
    if (!start || !end) {
      toast({
        title: "Missing Locations",
        description: "Please select both start and end locations first.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Clear existing markers and routes
      if (locations.currentMarker) {
        locations.currentMarker.remove();
      }
      clearMapElements(map, locations.currentMarker);

      // Get route between points
      const directionsData = await getDirections(start, end, transportMode);
      if (!directionsData?.routes[0]) {
        toast({
          title: "Route Error",
          description: "Could not find a route between the selected locations.",
          variant: "destructive"
        });
        return;
      }

      // Draw the route
      const coordinates = directionsData.routes[0].geometry.coordinates;
      drawRoute(map, coordinates);

      // Find the midpoint
      const equidistantPoint = await findEquidistantPoint(coordinates, start, end, transportMode);
      
      if (!equidistantPoint) {
        toast({
          title: "Error",
          description: "Could not find an equidistant point.",
          variant: "destructive"
        });
        return;
      }

      // Create and add the midpoint marker
      const markerElement = document.createElement('div');
      markerElement.className = 'midpoint-marker';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      markerElement.style.backgroundSize = 'cover';
      
      const newMarker = new mapboxgl.Marker(markerElement)
        .setLngLat(equidistantPoint as [number, number])
        .addTo(map);

      setLocations(prev => ({
        ...prev,
        midpoint: equidistantPoint as [number, number],
        currentMarker: newMarker
      }));

      // Fit the map to show all points
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(start);
      bounds.extend(end);
      bounds.extend(equidistantPoint as [number, number]);

      map.fitBounds(bounds, {
        padding: {
          top: 50,
          bottom: 50,
          left: 450,
          right: 50
        },
        maxZoom: 15
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

  useImperativeHandle(ref, () => ({
    findMidpoint,
    setStartLocation: (coordinates: [number, number]) => {
      setLocations(prev => ({ ...prev, start: coordinates }));
    },
    setEndLocation: (coordinates: [number, number]) => {
      setLocations(prev => ({ ...prev, end: coordinates }));
    }
  }));

  useEffect(() => {
    return () => {
      if (locations.currentMarker) {
        locations.currentMarker.remove();
      }
    };
  }, []);

  return null;
});

MarkerManager.displayName = 'MarkerManager';

export default MarkerManager;