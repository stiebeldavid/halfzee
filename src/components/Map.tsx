import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { getDirections } from '@/utils/mapUtils';
import MidpointPopup from './map/MidpointPopup';
import RouteDisplay from './map/RouteDisplay';

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
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const findEquidistantPoint = async (routeCoordinates: number[][]) => {
    const samples = 100;
    const sampledPoints = [];
    const totalPoints = routeCoordinates.length;
    
    for (let i = 0; i < samples; i++) {
      const index = Math.floor((i / samples) * totalPoints);
      sampledPoints.push(routeCoordinates[index]);
    }

    const travelTimes = await Promise.all(
      sampledPoints.map(async (point) => {
        if (!startLocation || !endLocation) return null;
        
        const startTime = await getDirections(startLocation, [point[0], point[1]], transportMode)
          .then(data => data?.routes[0]?.duration || 0);
        const endTime = await getDirections([point[0], point[1]], endLocation, transportMode)
          .then(data => data?.routes[0]?.duration || 0);
          
        return {
          point,
          timeDifference: Math.abs(startTime - endTime),
          totalTime: startTime + endTime
        };
      })
    );

    const bestPoint = travelTimes
      .filter(Boolean)
      .sort((a, b) => a!.timeDifference - b!.timeDifference)[0];

    return bestPoint?.point || null;
  };

  const searchNearbyPlaces = async (point: [number, number]) => {
    try {
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
      
      if (!data.features || data.features.length === 0) {
        toast({
          title: "No Places Found",
          description: "No restaurants or cafes were found near the midpoint. Try a different location.",
          variant: "destructive"
        });
        return [];
      }

      return data.features.map((place: any) => ({
        name: place.text,
        category: place.properties?.category || place.place_type?.[0] || 'venue',
        address: place.place_name?.split(',')[0] || ''
      }));
    } catch (error) {
      console.error('Error searching nearby places:', error);
      toast({
        title: "Error",
        description: "Failed to find nearby places.",
        variant: "destructive"
      });
      return [];
    }
  };

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
      
      // Remove existing popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

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

      const equidistantPoint = await findEquidistantPoint(coordinates);
      
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
      const places = await searchNearbyPlaces(equidistantPoint as [number, number]);
      setNearbyPlaces(places);

      // Create and show popup
      const popupNode = document.createElement('div');
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setLngLat(equidistantPoint as [number, number]);
      
      // Render MidpointPopup component into the popup
      ReactDOM.render(
        <MidpointPopup places={places} />,
        popupNode
      );
      
      popup.setDOMContent(popupNode);
      popup.addTo(map.current);
      popupRef.current = popup;

      // Update map view
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(startLocation);
      bounds.extend(endLocation);
      bounds.extend(equidistantPoint);

      map.current.fitBounds([
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()]
      ], {
        padding: { top: 50, bottom: 50, left: 450, right: 50 },
        maxZoom: 15,
        duration: 1000
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
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error || !data?.token) {
          console.error('Error fetching Mapbox token:', error);
          return;
        }

        mapboxgl.accessToken = data.token;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [-74.006, 40.7128],
          zoom: 12
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

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

        const startContainer = document.getElementById('geocoder-start');
        const endContainer = document.getElementById('geocoder-end');
        
        if (startContainer && endContainer) {
          startContainer.appendChild(geocoderStart.onAdd(map.current));
          endContainer.appendChild(geocoderEnd.onAdd(map.current));
        }

        geocoderStart.on('result', (e) => {
          const coordinates = e.result.geometry.coordinates as [number, number];
          setStartLocation(coordinates);
        });

        geocoderEnd.on('result', (e) => {
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
      {routeCoordinates.length > 0 && map.current && (
        <RouteDisplay map={map.current} coordinates={routeCoordinates} />
      )}
    </div>
  );
});

Map.displayName = 'Map';

export default Map;