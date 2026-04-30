import { useRef, useEffect, useState } from "react";
import { MapPin, CheckCircle } from "lucide-react";

export default function AddressAutocomplete({ value, onChange, className }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!window.google?.maps?.places) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      if (place?.formatted_address) {
        onChange(place.formatted_address);
        setVerified(true);
      }
    });
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  // Reset verified if user manually edits
  const handleInput = (e) => {
    setVerified(false);
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        placeholder="Start typing your address..."
        className={`w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl h-12 pr-10 ${className || ""}`}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {verified ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <MapPin className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}