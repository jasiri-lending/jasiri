import { useState, useEffect, useCallback } from 'react';
import { MapPinIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const LocationPicker = ({ 
  value = null, 
  onChange, 
  county = null,
  label = "Business Location",
  required = false,
  error = null 
}) => {
  const [coordinates, setCoordinates] = useState(value || { lat: null, lng: null });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [mapUrl, setMapUrl] = useState('');

  // Kenya 47 counties center coordinates
  const countyCoordinates = {
    'Nairobi': { lat: -1.2864, lng: 36.8172 }, 'Mombasa': { lat: -4.0435, lng: 39.6682 },
    'Kisumu': { lat: -0.0917, lng: 34.7680 }, 'Nakuru': { lat: -0.3031, lng: 36.0800 },
    'Uasin Gishu': { lat: 0.5143, lng: 35.2698 }, 'Kakamega': { lat: 0.2827, lng: 34.7519 },
    'Machakos': { lat: -1.5177, lng: 37.2634 }, 'Kiambu': { lat: -1.1714, lng: 36.8356 },
    'Meru': { lat: 0.0469, lng: 37.6500 }, 'Kilifi': { lat: -3.5107, lng: 39.9093 },
    'Nyeri': { lat: -0.4197, lng: 36.9470 }, 'Trans Nzoia': { lat: 1.0522, lng: 34.9502 },
    'Kajiado': { lat: -2.0982, lng: 36.7820 }, 'Kericho': { lat: -0.3676, lng: 35.2839 },
    'Bomet': { lat: -0.7809, lng: 35.3088 }, 'Bungoma': { lat: 0.5635, lng: 34.5606 },
    'Busia': { lat: 0.4345, lng: 34.1115 }, 'Siaya': { lat: -0.0617, lng: 34.2883 },
    'Migori': { lat: -1.0634, lng: 34.4731 }, 'Kisii': { lat: -0.6770, lng: 34.7795 },
    'Nyamira': { lat: -0.5633, lng: 34.9336 }, 'Narok': { lat: -1.0833, lng: 35.8714 },
    'Homa Bay': { lat: -0.5273, lng: 34.4571 }, "Murang'a": { lat: -0.7833, lng: 37.0000 },
    'Embu': { lat: -0.5396, lng: 37.4575 }, 'Kitui': { lat: -1.3669, lng: 38.0106 },
    'Makueni': { lat: -2.2639, lng: 37.8333 }, 'Nyandarua': { lat: -0.1833, lng: 36.4667 },
    'Kirinyaga': { lat: -0.6589, lng: 37.3831 }, 'Tharaka Nithi': { lat: -0.2950, lng: 37.7333 },
    'Laikipia': { lat: 0.3667, lng: 36.7833 }, 'Garissa': { lat: -0.4536, lng: 39.6401 },
    'Wajir': { lat: 1.7500, lng: 40.0667 }, 'Mandera': { lat: 3.9167, lng: 41.8500 },
    'Marsabit': { lat: 2.3333, lng: 37.9833 }, 'Isiolo': { lat: 0.3556, lng: 37.5817 },
    'Samburu': { lat: 1.2167, lng: 36.8000 }, 'Turkana': { lat: 3.1167, lng: 35.5989 },
    'West Pokot': { lat: 1.6208, lng: 35.1111 }, 'Baringo': { lat: 0.4667, lng: 36.0833 },
    'Elgeyo Marakwet': { lat: 0.8333, lng: 35.4667 }, 'Nandi': { lat: 0.1833, lng: 35.1333 },
    'Kwale': { lat: -4.1833, lng: 39.4500 }, 'Taita Taveta': { lat: -3.3167, lng: 38.3500 },
    'Lamu': { lat: -2.2717, lng: 40.9020 }, 'Tana River': { lat: -1.5167, lng: 39.8333 },
    'Vihiga': { lat: 0.0667, lng: 34.7167 }
  };

  // Sync map when parent provides new geocoded coordinates
  useEffect(() => {
    if (value && value.lat && value.lng) {
      setCoordinates(value);
    }
  }, [value]);

  // Update map preview when coordinates change
  useEffect(() => {
    if (coordinates.lat && coordinates.lng) {
      setMapUrl(
        `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.01},${coordinates.lat - 0.01},${coordinates.lng + 0.01},${coordinates.lat + 0.01}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`
      );
    }
  }, [coordinates]);

  // Default to county center ONLY if no geocode value exists
  useEffect(() => {
    if (county && countyCoordinates[county] && (!value || !value.lat)) {
      const countyCoords = countyCoordinates[county];
      setCoordinates(countyCoords);
      if (onChange) onChange(countyCoords);
    }
  }, [county, value]);

  // GPS button
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }

    setIsLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setCoordinates(newCoords);
        if (onChange) onChange(newCoords);
        setIsLoadingLocation(false);
      },
      () => {
        alert('Unable to get your location');
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onChange]);

  // Manual coordinates input
  const handleManualInput = (field, val) => {
    const newCoords = { ...coordinates, [field]: parseFloat(val) || null };
    setCoordinates(newCoords);
    if (onChange && newCoords.lat && newCoords.lng) onChange(newCoords);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* GPS Button */}
      <button
        type="button"
        onClick={getCurrentLocation}
        disabled={isLoadingLocation}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoadingLocation ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            Getting Location...
          </>
        ) : (
          <>
            <MapPinIcon className="h-5 w-5" /> Get Current Location
          </>
        )}
      </button>

      {/* Manual Lat/Lng */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Latitude</label>
          <input
            type="number"
            step="any"
            value={coordinates.lat || ''}
            onChange={(e) => handleManualInput('lat', e.target.value)}
            className={`w-full p-2 border rounded-lg ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Longitude</label>
          <input
            type="number"
            step="any"
            value={coordinates.lng || ''}
            onChange={(e) => handleManualInput('lng', e.target.value)}
            className={`w-full p-2 border rounded-lg ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
      </div>

      {/* Map Preview */}
      {coordinates.lat && coordinates.lng && (
        <div className="border rounded-lg overflow-hidden">
          <iframe
            width="100%"
            height="300"
            src={mapUrl}
            title="Location Map"
          ></iframe>
          <div className="bg-gray-50 p-2 text-xs text-gray-600 flex items-center gap-2">
            <GlobeAltIcon className="h-4 w-4" />
            <span>{coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
};

export default LocationPicker;
