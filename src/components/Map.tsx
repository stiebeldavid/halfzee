import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Coffee, ShoppingBag, Tree } from 'lucide-react';

interface MapProps {
  transportMode: string;
  onMidpointFound?: (midpoint: [number, number]) => void;
}

export interface MapRef {
  findMidpoint: () => void;
}

interface Place {
  type: 'coffee' | 'park' | 'mall';
  name: string;
  coordinates: [number, number];
}

const Map = forwardRef<MapRef, MapProps>(({ transportMode, onMidpointFound }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [startLocation, setStartLocation] = useState<[number, number] | null>(null);
  const [endLocation, setEndLocation] = useState<[number, number] | null>(null);
  const [midpoint, setMidpoint] = useState<[number, number] | null>(null);
  const currentMarker = useRef<mapboxgl.Marker | null>(null);
  const placeMarkers = useRef<mapboxgl.Marker[]>([]);

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

  const searchNearbyPlaces = async (coordinates: [number, number]) => {
    const types = [
      { query: 'cafe', type: 'coffee' as const },
      { query: 'park', type: 'park' as const },
      { query: 'shopping mall', type: 'mall' as const }
    ];
    
    const allPlaces: Place[] = [];
    
    for (const { query, type } of types) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?` +
          `proximity=${coordinates[0]},${coordinates[1]}&` +
          `types=poi&limit=5&` +
          `access_token=${mapboxgl.accessToken}`
        );
        
        const data = await response.json();
        
        const places = data.features
          .map((feature: any) => ({
            type,
            name: feature.text,
            coordinates: feature.center as [number, number]
          }))
          .slice(0, 2); // Take only the 2 closest of each type
        
        allPlaces.push(...places);
      } catch (error) {
        console.error(`Error fetching nearby ${type}:`, error);
      }
    }
    
    return allPlaces;
  };

  const createPlaceMarker = (place: Place) => {
    if (!map.current) return null;

    // Create marker element
    const markerEl = document.createElement('div');
    markerEl.className = 'place-marker';
    markerEl.style.width = '30px';
    markerEl.style.height = '30px';
    markerEl.style.display = 'flex';
    markerEl.style.alignItems = 'center';
    markerEl.style.justifyContent = 'center';
    markerEl.style.background = 'white';
    markerEl.style.borderRadius = '50%';
    markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

    // Create icon container
    const iconContainer = document.createElement('div');
    iconContainer.style.width = '20px';
    iconContainer.style.height = '20px';
    iconContainer.innerHTML = getIconSvg(place.type);
    markerEl.appendChild(iconContainer);

    // Create popup
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(`<strong>${place.name}</strong><br>${place.type}`);

    // Create and return marker
    return new mapboxgl.Marker(markerEl)
      .setLngLat(place.coordinates)
      .setPopup(popup)
      .addTo(map.current);
  };

  const getIconSvg = (type: Place['type']) => {
    switch (type) {
      case 'coffee':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>';
      case 'park':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 19h8a4 4 0 0 0 3.8-2.8 4 4 0 0 0-1.6-4.5c1-1.1 1-2.7 0-3.8-.7-.7-1.8-1-2.8-.8a4 4 0 0 0-7.4 1.9A4 4 0 0 0 5 14.2a4 4 0 0 0 3 4.8"/></svg>';
      case 'mall':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
    }
  };

  const clearPlaceMarkers = () => {
    placeMarkers.current.forEach(marker => marker.remove());
    placeMarkers.current = [];
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
      clearPlaceMarkers();

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

      // Search and add nearby places
      const nearbyPlaces = await searchNearbyPlaces(equidistantPoint as [number, number]);
      nearbyPlaces.forEach(place => {
        const marker = createPlaceMarker(place);
        if (marker) {
          placeMarkers.current.push(marker);
        }
      });

      // Calculate bounds that include all points
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(startLocation);
      bounds.extend(endLocation);
      bounds.extend(equidistantPoint as [number, number]);
      
      // Extend bounds to include nearby places
      nearbyPlaces.forEach(place => {
        bounds.extend(place.coordinates);
      });

      // Add padding to account for the input box (more padding on the left)
      map.current.fitBounds(bounds, {
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
