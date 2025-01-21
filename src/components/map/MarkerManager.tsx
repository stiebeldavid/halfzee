import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import { toast } from "@/components/ui/use-toast";
import { MarkerManagerProps, LocationState } from './types';
import { 
  getDirections, 
  findEquidistantPoint, 
  clearMapElements, 
  drawRoute,
  searchNearbyPOIs,
  createPOIMarker
} from '@/utils/mapUtils';

const MarkerManager = forwardRef<any, MarkerManagerProps>(({ map, transportMode, onMidpointFound }, ref) => {
  const [locations, setLocations] = useState<LocationState>({
    start: null,
    end: null,
    midpoint: null,
    currentMarker: null
  });
  const [poiMarkers, setPoiMarkers] = useState<mapboxgl.Marker[]>([]);

  const clearPOIMarkers = () => {
    poiMarkers.forEach(marker => marker.remove());
    setPoiMarkers([]);
  };

  const findNearbyPOIs = async (coordinates: [number, number]) => {
    try {
      clearPOIMarkers();
      
      const categories: Array<'cafe' | 'park' | 'shopping'> = ['cafe', 'park', 'shopping'];
      const newMarkers: mapboxgl.Marker[] = [];

      for (const category of categories) {
        const pois = await searchNearbyPOIs(coordinates, category);
        
        pois.forEach(poi => {
          const marker = createPOIMarker(map, poi, category);
          newMarkers.push(marker);
        });
      }

      setPoiMarkers(newMarkers);
    } catch (error) {
      console.error('Error finding POIs:', error);
      toast({
        title: "Error",
        description: "Could not find nearby points of interest.",
        variant: "destructive"
      });
    }
  };

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
      clearMapElements(map, locations.currentMarker);
      clearPOIMarkers();

      const directionsData = await getDirections(start, end, transportMode);
      if (!directionsData?.routes[0]) {
        toast({
          title: "Route Error",
          description: "Could not find a route between the selected locations.",
          variant: "destructive"
        });
        return;
      }

      const coordinates = directionsData.routes[0].geometry.coordinates;
      drawRoute(map, coordinates);

      const equidistantPoint = await findEquidistantPoint(coordinates, start, end, transportMode);
      
      if (!equidistantPoint) {
        toast({
          title: "Error",
          description: "Could not find an equidistant point.",
          variant: "destructive"
        });
        return;
      }

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

      // Find and display nearby POIs
      await findNearbyPOIs(equidistantPoint as [number, number]);

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
        description: "The map has been centered on the equidistant point and nearby points of interest have been marked.",
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
      clearPOIMarkers();
    };
  }, []);

  return null;
});

MarkerManager.displayName = 'MarkerManager';

export default MarkerManager;