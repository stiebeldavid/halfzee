import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Coffee, Utensils } from "lucide-react";

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
  const currentPopup = useRef<mapboxgl.Popup | null>(null);
  
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

    // Remove existing popup
    if (currentPopup.current) {
      currentPopup.current.remove();
      currentPopup.current = null;
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

  const searchNearbyPlaces = async (point: [number, number]) => {
    try {
      console.log('Searching for places near:', point);
      
      const radius = 2;
      const bbox = [
        point[0] - radius,
        point[1] - radius,
        point[0] + radius,
        point[1] + radius
      ].join(',');

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/restaurant%2Ccafe.json?` +
        `proximity=${point[0]},${point[1]}&` +
        `bbox=${bbox}&` +
        `limit=10&` +
        `types=poi&` +
        `categories=restaurant,cafe,coffee_shop&` +
        `access_token=${mapboxgl.accessToken}`
      );

      const data = await response.json();
      console.log('Places API response:', data);
      
      if (!data.features || data.features.length === 0) {
        console.log('No places found within radius');
        toast({
          title: "No Places Found",
          description: "No restaurants or cafes were found near the midpoint. Try a different location.",
          variant: "destructive"
        });
        return;
      }

      // Create popup content
      const popupContent = document.createElement('div');
      popupContent.className = 'custom-popup';
      
      // Create React-like structure using DOM
      const card = document.createElement('div');
      card.className = 'bg-white rounded-lg shadow-lg w-[300px] max-h-[400px] overflow-hidden';
      
      const header = document.createElement('div');
      header.className = 'p-4 border-b';
      header.innerHTML = `
        <h3 class="font-semibold">Midpoint Location</h3>
        <p class="text-sm text-gray-500">Here are some places to meet nearby:</p>
      `;
      
      const placesList = document.createElement('div');
      placesList.className = 'divide-y max-h-[300px] overflow-y-auto';
      
      data.features.forEach((place: any) => {
        const name = place.text;
        const category = place.properties?.category || 
                        (place.place_type && place.place_type[0]) || 
                        'venue';
        const address = place.place_name.split(',')[0];
        
        const placeItem = document.createElement('div');
        placeItem.className = 'p-3 hover:bg-gray-50';
        
        const isCoffeeShop = 
          category.toLowerCase().includes('coffee') || 
          category.toLowerCase().includes('cafe') ||
          name.toLowerCase().includes('starbucks');
        
        placeItem.innerHTML = `
          <div class="flex items-start gap-3">
            <div class="text-blue-500">
              ${isCoffeeShop ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coffee"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>' : 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>'
              }
            </div>
            <div>
              <div class="font-medium">${name}</div>
              <div class="text-sm text-gray-500">${address}</div>
            </div>
          </div>
        `;
        
        placesList.appendChild(placeItem);
      });
      
      card.appendChild(header);
      card.appendChild(placesList);
      popupContent.appendChild(card);

      // Remove any existing popup
      if (currentPopup.current) {
        currentPopup.current.remove();
      }

      // Create and add the new popup
      currentPopup.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px',
        offset: 25
      })
      .setLngLat(point)
      .setDOMContent(popupContent)
      .addTo(map.current!);

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

  const calculateDistance = (point1: [number, number], point2: number[]) => {
    const R = 6371; // Earth's radius in km
    const lat1 = point1[1] * Math.PI / 180;
    const lat2 = point2[1] * Math.PI / 180;
    const deltaLat = (point2[1] - point1[1]) * Math.PI / 180;
    const deltaLon = (point2[0] - point1[0]) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
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
      map.current?.stop();
      
      clearMapElements();

      const directionsData = await getDirections(startLocation, endLocation);
      if (!directionsData?.routes[0]) {
        toast({
          title: "Route Error",
          description: "Could not find a route between the selected locations.",
          variant: "destructive"
        });
        return;
      }

      const coordinates = directionsData.routes[0].geometry.coordinates;
      drawRoute(coordinates);

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

      const markerElement = document.createElement('div');
      markerElement.className = 'midpoint-marker';
      markerElement.style.width = '25px';
      markerElement.style.height = '25px';
      markerElement.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      markerElement.style.backgroundSize = 'cover';
      
      currentMarker.current = new mapboxgl.Marker(markerElement)
        .setLngLat(equidistantPoint as [number, number])
        .addTo(map.current);

      await searchNearbyPlaces(equidistantPoint as [number, number]);

      const bounds = new mapboxgl.LngLatBounds()
        .extend(startLocation)
        .extend(endLocation)
        .extend(equidistantPoint);

      map.current.stop();
      map.current.off('moveend');

      map.current.once('moveend', () => {
        map.current?.fitBounds([
          [bounds.getWest(), bounds.getSouth()],
          [bounds.getEast(), bounds.getNorth()]
        ], {
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
