import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface MapProps {
  transportMode: string;
  onMidpointFound?: (midpoint: [number, number]) => void;
  onGeocoder?: (geocoder: any) => void;
}

export interface MapRef {
  findMidpoint: () => void;
}

const Map = forwardRef<MapRef, MapProps>(({ transportMode, onMidpointFound, onGeocoder }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [startLocation, setStartLocation] = useState<[number, number] | null>(null);
  const [endLocation, setEndLocation] = useState<[number, number] | null>(null);
  const [midpoint, setMidpoint] = useState<[number, number] | null>(null);
  const currentMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  const getDirections = async (start: [number, number], end: [number, number]) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${transportMode}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching directions:', error);
      return null;
    }
  };

  const clearMapElements = () => {
    if (!map.current) return;

    // Remove existing route layer and source
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Remove existing midpoint marker
    if (currentMarker.current) {
      currentMarker.current.remove();
      currentMarker.current = null;
    }
  };

  const findEquidistantPoint = async (routeCoordinates: number[][]) => {
    // Sample 100 points along the route
    const samples = 100;
    const sampledPoints = [];
    const totalPoints = routeCoordinates.length;
    
    for (let i = 0; i < samples; i++) {
      const index = Math.floor((i / samples) * totalPoints);
      sampledPoints.push(routeCoordinates[index]);
    }

    // For each sampled point, calculate travel times from both start and end
    const travelTimes = await Promise.all(
      sampledPoints.map(async (point) => {
        if (!startLocation || !endLocation) return null;
        
        const startTime = await getDirections(startLocation, [point[0], point[1]])
          .then(data => data?.routes[0]?.duration || 0);
        const endTime = await getDirections([point[0], point[1]], endLocation)
          .then(data => data?.routes[0]?.duration || 0);
          
        return {
          point,
          timeDifference: Math.abs(startTime - endTime),
          totalTime: startTime + endTime
        };
      })
    );

    // Find the point with the smallest time difference
    const bestPoint = travelTimes
      .filter(Boolean)
      .sort((a, b) => a!.timeDifference - b!.timeDifference)[0];

    return bestPoint?.point || null;
  };

  const drawRoute = (coordinates: number[][]) => {
    if (!map.current) return;

    clearMapElements();

    // Add the route to the map
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4
      }
    });
  };

  const findMidpoint = async () => {
    if (!startLocation || !endLocation) {
      toast({
        title: "Missing Locations",
        description: "Please select both start and end locations first.",
        variant: "destructive"
      });
      return;
    }

    try {
      clearMapElements();

      // Get route directions
      const directionsData = await getDirections(startLocation, endLocation);
      if (!directionsData?.routes[0]) {
        toast({
          title: "Route Error",
          description: "Could not find a route between the selected locations.",
          variant: "destructive"
        });
        return;
      }

      // Draw the route on the map
      const coordinates = directionsData.routes[0].geometry.coordinates;
      drawRoute(coordinates);

      // Find the equidistant point along the route
      const equidistantPoint = await findEquidistantPoint(coordinates);
      
      if (!equidistantPoint || !map.current) {
        toast({
          title: "Error",
          description: "Could not find an equidistant point.",
          variant: "destructive"
        });
        return;
      }

      setMidpoint(equidistantPoint as [number, number]);

      // Add marker at midpoint
      const markerElement = document.createElement('div');
      markerElement.className = 'midpoint-marker';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      markerElement.style.backgroundSize = 'cover';
      
      currentMarker.current = new mapboxgl.Marker(markerElement)
        .setLngLat(equidistantPoint as [number, number])
        .addTo(map.current);

      // Fly to midpoint
      map.current.flyTo({
        center: equidistantPoint as [number, number],
        zoom: 13,
        essential: true
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
        
        if (map.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [-74.006, 40.7128],
          zoom: 12
        });

        map.current.on('load', () => {
          setMapInitialized(true);
          if (onGeocoder) {
            onGeocoder({
              accessToken: mapboxgl.accessToken,
              mapInstance: mapboxgl
            });
          }
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();

    return () => {
      if (map.current) {
        try {
          map.current.remove();
        } catch (error) {
          console.error('Error removing map:', error);
        }
      }
    };
  }, [onGeocoder]);

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
