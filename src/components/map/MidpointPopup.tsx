import React from 'react';
import { Coffee, Utensils } from 'lucide-react';

interface Place {
  name: string;
  category: string;
  address: string;
}

interface MidpointPopupProps {
  places: Place[];
}

const MidpointPopup: React.FC<MidpointPopupProps> = ({ places }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm">
      <h3 className="text-lg font-semibold mb-2">Meeting Point</h3>
      <p className="text-sm text-gray-600 mb-4">
        This is the midpoint of your route. Here are some nearby places to meet:
      </p>
      <div className="space-y-3">
        {places.map((place, index) => (
          <div key={index} className="flex items-start space-x-3">
            {place.category.toLowerCase().includes('coffee') || 
             place.category.toLowerCase().includes('cafe') ? (
              <Coffee className="w-4 h-4 mt-1 text-blue-500" />
            ) : (
              <Utensils className="w-4 h-4 mt-1 text-blue-500" />
            )}
            <div>
              <h4 className="font-medium">{place.name}</h4>
              <p className="text-sm text-gray-500">{place.address}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MidpointPopup;