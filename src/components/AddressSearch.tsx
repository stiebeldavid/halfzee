import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Car, PersonStanding, Bike, Bus, Locate } from 'lucide-react';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

interface AddressSearchProps {
  onTransportModeChange: (mode: string) => void;
  transportMode: string;
  onFindMidpoint?: () => void;
  mapboxgl?: {
    accessToken: string;
    mapInstance: any;
  };
}

const AddressSearch = ({ onTransportModeChange, transportMode, onFindMidpoint, mapboxgl }: AddressSearchProps) => {
  const [geocoderStart, setGeocoderStart] = useState<any>(null);
  const [geocoderEnd, setGeocoderEnd] = useState<any>(null);

  useEffect(() => {
    if (!mapboxgl?.accessToken || !mapboxgl?.mapInstance) return;

    const cleanup = () => {
      if (geocoderStart && geocoderStart.onRemove) {
        geocoderStart.onRemove();
      }
      if (geocoderEnd && geocoderEnd.onRemove) {
        geocoderEnd.onRemove();
      }
    };

    cleanup();

    const startGeocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl.mapInstance,
      placeholder: 'Enter start location'
    });

    const endGeocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl.mapInstance,
      placeholder: 'Enter end location'
    });

    setGeocoderStart(startGeocoder);
    setGeocoderEnd(endGeocoder);

    const startContainer = document.getElementById('geocoder-start');
    const endContainer = document.getElementById('geocoder-end');

    if (startContainer && endContainer) {
      startContainer.innerHTML = '';
      endContainer.innerHTML = '';
      startContainer.appendChild(startGeocoder.onAdd(mapboxgl.mapInstance));
      endContainer.appendChild(endGeocoder.onAdd(mapboxgl.mapInstance));
    }

    return cleanup;
  }, [mapboxgl]);

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Find Your Midpoint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div id="geocoder-start" className="geocoder-container" />
          <div id="geocoder-end" className="geocoder-container" />
          <Button 
            onClick={onFindMidpoint}
            className="w-full"
            size="lg"
          >
            <Locate className="mr-2 h-4 w-4" />
            Find Midpoint
          </Button>
        </div>
        
        <div className="space-y-2">
          <Label>Transportation Mode</Label>
          <RadioGroup
            defaultValue={transportMode}
            onValueChange={onTransportModeChange}
            className="flex space-x-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="driving" id="driving" />
              <Label htmlFor="driving" className="flex items-center space-x-1">
                <Car className="w-4 h-4" />
                <span>Drive</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="walking" id="walking" />
              <Label htmlFor="walking" className="flex items-center space-x-1">
                <PersonStanding className="w-4 h-4" />
                <span>Walk</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cycling" id="cycling" />
              <Label htmlFor="cycling" className="flex items-center space-x-1">
                <Bike className="w-4 h-4" />
                <span>Bike</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="transit" id="transit" />
              <Label htmlFor="transit" className="flex items-center space-x-1">
                <Bus className="w-4 h-4" />
                <span>Transit</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};

export default AddressSearch;