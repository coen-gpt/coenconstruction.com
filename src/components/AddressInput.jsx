import { useRef, useEffect, useState } from "react";
import { MapPin, CheckCircle } from "lucide-react";
import useGoogleMaps from "@/hooks/useGoogleMaps";

export default function AddressInput({ value, onChange, onGeocode, className = "", placeholder = "e.g. 4 Jersey Street, Boston, MA 02215", autoComplete = "off", ...inputProps }) {
  const inputRef = useRef(null);
  const acRef = useRef(null);
  const geocoderRef = useRef(null);
  const [verified, setVerified] = useState(false);
  const { loaded: mapsLoaded, failed: mapsFailed } = useGoogleMaps();

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || acRef.current) return;
    geocoderRef.current = new window.google.maps.Geocoder();
    acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
    });
    acRef.current.addListener("place_changed", async () => {
      const place = acRef.current.getPlace();
      if (place?.formatted_address) {
        onChange(place.formatted_address);
        setVerified(true);
        const geocoded = await geocodeAddress(place.formatted_address);
        if (geocoded && onGeocode) onGeocode(geocoded);
      }
    });
    return () => {
      if (acRef.current) window.google.maps.event.clearInstanceListeners(acRef.current);
    };
  }, [mapsLoaded]);

  const geocodeAddress = async (address) => {
    if (!geocoderRef.current) return null;
    try {
      const result = await geocoderRef.current.geocode({ address });
      if (result.results && result.results.length > 0) {
        const place = result.results[0];
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const city = place.address_components.find(c => c.types.includes("locality"))?.long_name || "";
        const state = place.address_components.find(c => c.types.includes("administrative_area_level_1"))?.short_name || "";
        return { lat, lng, city, state, formatted: place.formatted_address };
      }
    } catch (e) {
      console.error("Geocoding error:", e);
    }
    return null;
  };

  const handleInput = async (e) => {
    const text = e.target.value;
    onChange(text);
    setVerified(false);
    
    // Geocode manual input after 5+ chars
    if (text.length > 5 && onGeocode) {
      const geocoded = await geocodeAddress(text);
      if (geocoded) onGeocode(geocoded);
    }
  };

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl h-12 pl-10 pr-10 ${className}`}
        {...inputProps}
      />
      {verified && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      )}
      {mapsFailed && (
        <p className="text-xs text-amber-600 mt-1">Address verification unavailable — works as plain text input.</p>
      )}
    </div>
  );
}