import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, PersonStanding, Bike, Bus, Locate } from 'lucide-react';
import { cn } from "@/lib/utils";

interface AddressSearchProps {
  onTransportModeChange: (mode: string) => void;
  transportMode: string;
  onFindMidpoint?: () => void;
}

const AddressSearch = ({ onTransportModeChange, transportMode, onFindMidpoint }: AddressSearchProps) => {
  const transportOptions = [
    { value: 'driving', icon: Car, label: 'Drive' },
    { value: 'walking', icon: PersonStanding, label: 'Walk' },
    { value: 'cycling', icon: Bike, label: 'Bike' },
    { value: 'transit', icon: Bus, label: 'Transit' },
  ];

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
          <div className="grid grid-cols-4 gap-2">
            {transportOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.value}
                  onClick={() => onTransportModeChange(option.value)}
                  variant={transportMode === option.value ? "default" : "outline"}
                  className={cn(
                    "flex flex-col items-center gap-1 h-auto py-3",
                    transportMode === option.value ? "border-primary" : "border-input"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AddressSearch;