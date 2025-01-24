import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MapControls } from "./map/MapControls";

interface MapProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  selectedLocations: { lat: number; lng: number }[];
}

export const Map: React.FC<MapProps> = ({ onLocationSelect, selectedLocations }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const { toast } = useToast();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [midpoint, setMidpoint] = useState<[number, number] | null>(null);
  const midpointMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const response = await fetch("/api/get-mapbox-token");
        const data = await response.json();
        setMapboxToken(data.token);
      } catch (error) {
        console.error("Error fetching Mapbox token:", error);
        toast({
          title: "Error",
          description: "Failed to load map. Please try again later.",
          variant: "destructive",
        });
      }
    };

    fetchMapboxToken();
  }, [toast]);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;

    if (map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-74.5, 40],
        zoom: 9,
        accessToken: mapboxToken,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        onLocationSelect({ lng, lat });
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      toast({
        title: "Error",
        description: "Failed to initialize map. Please try again later.",
        variant: "destructive",
      });
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, onLocationSelect, toast]);

  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers for selected locations
    selectedLocations.forEach((location) => {
      const marker = new mapboxgl.Marker()
        .setLngLat([location.lng, location.lat])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Calculate and show midpoint if we have exactly 2 locations
    if (selectedLocations.length === 2) {
      const [loc1, loc2] = selectedLocations;
      const midLng = (loc1.lng + loc2.lng) / 2;
      const midLat = (loc1.lat + loc2.lat) / 2;
      setMidpoint([midLng, midLat]);

      // Remove existing midpoint marker if it exists
      if (midpointMarkerRef.current) {
        midpointMarkerRef.current.remove();
      }

      // Create new midpoint marker
      const el = document.createElement("div");
      el.className = "midpoint-marker";
      el.style.backgroundColor = "#FF4444";
      el.style.width = "15px";
      el.style.height = "15px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";

      midpointMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([midLng, midLat])
        .addTo(map.current);

      // Fit bounds to include all points
      const bounds = new mapboxgl.LngLatBounds()
        .extend([loc1.lng, loc1.lat])
        .extend([loc2.lng, loc2.lat]);
      
      map.current.fitBounds(bounds, {
        padding: 100,
        duration: 1000,
      });
    } else {
      setMidpoint(null);
      if (midpointMarkerRef.current) {
        midpointMarkerRef.current.remove();
        midpointMarkerRef.current = null;
      }
    }
  }, [selectedLocations]);

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
      <MapControls map={map.current} mapboxToken={mapboxToken} onLocationSelect={onLocationSelect} />
    </div>
  );
};