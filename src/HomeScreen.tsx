import { useEffect, useState } from "react";
import Map from "./Map";
import { DestinationSlider } from "./components/DestinationSlider";
import type { RideOffer, RideRequest } from "./core/matching/omwMatching";
import { findMatches } from "./core/matching/omwMatching";

type SelectedRoute = {
  driverId: string;
  startName: string;
  endName: string;
  etaMin: number;
  price: number;
  pickupEtaMin?: number;
};

export default function HomeScreen() {
  const [riderDestination, setRiderDestination] = useState("");
  const [driverDestination, setDriverDestination] = useState("");
  const [keyboardMode, setKeyboardMode] = useState<"driver" | "rider" | null>(
    null
  );
  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute | null>(null);
  const [progress, setProgress] = useState(0);

  // Quick demo of the matching algorithm on mount
  useEffect(() => {
    const demoOffers: RideOffer[] = [
      {
        id: "DRIVER-1",
        departure: { lat: 48.8566, lon: 2.3522 },
        destination: { lat: 48.8566, lon: 2.4 },
        departureTime: new Date(Date.now() + 5 * 60 * 1000),
        maxDetourMinutes: 5,
        freeSeats: 2,
        route: [
          { lat: 48.8566, lon: 2.3522 },
          { lat: 48.8567, lon: 2.36 },
          { lat: 48.8568, lon: 2.38 },
          { lat: 48.8566, lon: 2.4 },
        ],
      },
      {
        id: "DRIVER-2",
        departure: { lat: 48.86, lon: 2.33 },
        destination: { lat: 48.86, lon: 2.42 },
        departureTime: new Date(Date.now() + 10 * 60 * 1000),
        maxDetourMinutes: 5,
        freeSeats: 1,
        route: [
          { lat: 48.86, lon: 2.33 },
          { lat: 48.861, lon: 2.36 },
          { lat: 48.862, lon: 2.39 },
          { lat: 48.86, lon: 2.42 },
        ],
      },
    ];

    const riderRequest: RideRequest = {
      from: { lat: 48.8567, lon: 2.355 },
      to: { lat: 48.8566, lon: 2.398 },
      departureTime: new Date(Date.now() + 3 * 60 * 1000),
      maxWalkMeters: 500,
      rideNow: true,
    };

    const matches = findMatches(demoOffers, riderRequest);
    console.log("OMW test matches:", matches);

    if (matches.length > 0) {
      const best = matches[0];
      setSelectedRoute({
        driverId: best.offer.id,
        startName: "Paris Centre",
        endName: "Paris East",
        etaMin: 12,
        price: 4.5,
        pickupEtaMin: 4,
      });
    }
  }, []);

  // Animate the little progress bar while a route is selected
  useEffect(() => {
    if (!selectedRoute) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const id = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          window.clearInterval(id);
          return 100;
        }
        return value + 1;
      });
    }, 800);

    return () => window.clearInterval(id);
  }, [selectedRoute]);

  const handleDestinationChange = (
    mode: "driver" | "rider",
    value: string
  ) => {
    if (mode === "rider") {
      setRiderDestination(value);
    } else {
      setDriverDestination(value);
    }
  };

  return (
    <div
      className="app-root"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#000",
        color: "#fff",
      }}
    >
      <Map riderDestination={riderDestination} onRouteSelect={setSelectedRoute} />

      {selectedRoute && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            maxWidth: 420,
            marginInline: "auto",
            padding: 12,
            borderRadius: 16,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(0,255,136,0.18)",
                color: "#00ff88",
                fontSize: 12,
              }}
            >
              {selectedRoute.driverId}
            </span>
            <span>{selectedRoute.startName}</span>
            <span>→</span>
            <span>{selectedRoute.endName}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            <span>
              Pickup in {selectedRoute.pickupEtaMin ?? selectedRoute.etaMin} min
            </span>
            <span>Ride {selectedRoute.etaMin} min</span>
            <span>€{selectedRoute.price.toFixed(1)}</span>
          </div>

          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg,#00ff88,#00e0ff,#ffef00)",
                transition: "width 0.4s ease-out",
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 12,
          fontSize: 10,
          opacity: 0.5,
        }}
      >
        <div>Mode: {keyboardMode ?? "-"}</div>
        <div>Driver dest (debug): {driverDestination}</div>
      </div>

      <DestinationSlider
        onKeyboardOpen={(mode) => setKeyboardMode(mode)}
        onKeyboardClose={() => setKeyboardMode(null)}
        onDestinationChange={handleDestinationChange}
      />
    </div>
  );
}
