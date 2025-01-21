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

    // Remove all place markers
    placeMarkers.current.forEach(marker => marker.remove());
    placeMarkers.current = [];
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

  const searchNearbyPlaces = async (point: [number, number]) => {
    try {
      console.log('Searching for places near:', point);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/restaurant%2Ccafe.json?` +
        `proximity=${point[0]},${point[1]}&` +
        `radius=2000&` + // Increased radius to 2000 meters
        `limit=10&` +
        `types=poi&` +
        `access_token=${mapboxgl.accessToken}`
      );

      const data = await response.json();
      console.log('Places API response:', data);
      
      if (!data.features || data.features.length === 0) {
        console.log('No places found within radius. Try increasing search radius or checking coordinates.');
        toast({
          title: "No Places Found",
          description: "No restaurants or cafes were found near the midpoint. Try a different location.",
          variant: "destructive"
        });
        return;
      }

      // Clear existing place markers
      placeMarkers.current.forEach(marker => marker.remove());
      placeMarkers.current = [];

      // Add new markers for each place
      data.features.forEach((place: any) => {
        const coordinates = place.center;
        const name = place.text;
        const category = place.properties.category || '';
        const address = place.properties.address || '';
        
        console.log('Adding marker for place:', { 
          name, 
          category, 
          coordinates,
          address,
          fullPlace: place // Log the full place object for debugging
        });

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'place-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.backgroundImage = category.toLowerCase().includes('coffee') || 
                                 name.toLowerCase().includes('starbucks') ?
          'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)' :
          'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
        el.style.backgroundSize = 'cover';
        el.style.cursor = 'pointer';

        // Create popup with more detailed information
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <strong>${name}</strong><br>
            ${category ? `${category}<br>` : ''}
            ${address ? `${address}<br>` : ''}
          `);

        // Create and store marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat(coordinates)
          .setPopup(popup)
          .addTo(map.current!);

        placeMarkers.current.push(marker);
      });

      toast({
        title: "Places Found",
        description: `Found ${data.features.length} places near the midpoint.`,
      });
    } catch (error) {
      console.error('Error searching nearby places:', error);
      toast({
        title: "Error",
        description: "Failed to find nearby places.",
        variant: "destructive"
      });
    }
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
      // Stop any ongoing animations
      map.current?.stop();
      
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

      // Search for nearby places
      await searchNearbyPlaces(equidistantPoint as [number, number]);

      // Calculate bounds that include all points
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(startLocation[0], endLocation[0], equidistantPoint[0]), 
         Math.min(startLocation[1], endLocation[1], equidistantPoint[1])],
        [Math.max(startLocation[0], endLocation[0], equidistantPoint[0]),
         Math.max(startLocation[1], endLocation[1], equidistantPoint[1])]
      );

      // Stop any ongoing animations before fitting bounds
      map.current.stop();

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

      // Center the map on the midpoint first with an animation
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

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Create geocoder controls without adding them to the map
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

        // Add geocoders only to the designated divs
        const startContainer = document.getElementById('geocoder-start');
        const endContainer = document.getElementById('geocoder-end');
        
        if (startContainer && endContainer) {
          startContainer.appendChild(geocoderStart.onAdd(map.current));
          endContainer.appendChild(geocoderEnd.onAdd(map.current));
        }

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