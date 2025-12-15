// src/Map.tsx
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";

type DriverRouteDef = {
  id: string;
  from: [number, number];
  to: [number, number];
  startName: string;
  endName: string;
  etaMin: number;
  price: number;
};

type MapProps = {
  onRouteSelect?: (props: {
    driverId: string;
    startName: string;
    endName: string;
    etaMin: number;
    price: number;
    pickupEtaMin?: number;
  }) => void;
  riderDestination?: string; // not used for now

  // 👇 new
  role?: "driver" | "rider";
};


// 🔑 read token from Vite env
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
console.log("🔑 VITE_MAPBOX_TOKEN =", MAPBOX_TOKEN);

if (!MAPBOX_TOKEN) {
  console.error("❌ No Mapbox token found in import.meta.env.VITE_MAPBOX_TOKEN");
}

mapboxgl.accessToken = MAPBOX_TOKEN ?? "";

// Approx home: 175 Rue Championnet
const HOME_LNG_LAT: [number, number] = [2.338, 48.897];

// PAR-103: 205 Rue Ordener → Bercy, meeting at ~191 Rue Ordener
const ORDENER_205: [number, number] = [2.333157, 48.893983];
const ORDENER_191_MEET: [number, number] = [2.3355, 48.8938];
const BERCY: [number, number] = [2.386, 48.835];

const EXTRA_CARS: [number, number][] = [
  [2.34, 48.895],
  [2.328, 48.885],
  [2.352, 48.887],
  [2.36, 48.88],
  [2.345, 48.876],
  [2.33, 48.872],
  [2.315, 48.883],
  [2.37, 48.89],
  [2.38, 48.84],
];

const DRIVER_ROUTES: DriverRouteDef[] = [
  {
    id: "PAR-101",
    from: [2.327, 48.883],
    to: [2.252, 48.892],
    startName: "Place de Clichy",
    endName: "La Défense",
    etaMin: 18,
    price: 4.2,
  },
  {
    id: "PAR-102",
    from: [2.345, 48.883],
    to: [2.373, 48.844],
    startName: "Anvers",
    endName: "Gare de Lyon",
    etaMin: 22,
    price: 3.9,
  },
  {
    id: "PAR-103",
    from: ORDENER_205,
    to: BERCY,
    startName: "205 Rue Ordener",
    endName: "Bercy",
    etaMin: 26,
    price: 3.6,
  },
];

// --- helpers using Mapbox Directions API ----------------------------

async function fetchRouteGeometry(
  from: [number, number],
  to: [number, number],
  profile: "driving" | "walking" = "driving"
) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Directions error", await res.text());
    return null;
  }

  const json = await res.json();
  const geometry = json?.routes?.[0]?.geometry;
  if (!geometry) {
    console.error("No route geometry returned", json);
    return null;
  }
  return geometry;
}

async function fetchRouteDurationMinutes(
  from: [number, number],
  to: [number, number],
  profile: "driving" | "walking" = "driving"
): Promise<number | null> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false&access_token=${mapboxgl.accessToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Directions duration error", await res.text());
    return null;
  }

  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route || typeof route.duration !== "number") {
    console.error("No route duration returned", json);
    return null;
  }
  return Math.max(1, Math.round(route.duration / 60));
}

// -------------------------------------------------------------------

export default function Map({ 
  onRouteSelect,
  riderDestination,
  role = "driver",
}: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const walkGeometryRef = useRef<any | null>(null);
  const pickupEtaMinRef = useRef<number | null>(null);

  const routeSelectRef = useRef<MapProps["onRouteSelect"]>();
  routeSelectRef.current = onRouteSelect;

  const par103CoordsRef = useRef<[number, number][]>([]);
  const movingMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const moveIntervalRef = useRef<number | null>(null);

  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  void riderDestination;

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: HOME_LNG_LAT,
      zoom: 13,
    });

    mapInstanceRef.current = map;

    map.on("load", async () => {
      const features: any[] = [];

      // build geometry for all driver routes
      for (const def of DRIVER_ROUTES) {
        try {
          const geometry = await fetchRouteGeometry(def.from, def.to, "driving");
          if (!geometry) continue;

          if (def.id === "PAR-103" && geometry.type === "LineString") {
            par103CoordsRef.current = (geometry as any)
              .coordinates as [number, number][];
          }

          features.push({
            type: "Feature",
            properties: {
              driverId: def.id,
              startName: def.startName,
              endName: def.endName,
              etaMin: def.etaMin,
              price: def.price,
            },
            geometry,
          });
        } catch (err) {
          console.error("Failed to build route for", def.id, err);
        }
      }

      // walking geometry: home → meeting point (191 Rue Ordener)
      try {
        const walkGeom = await fetchRouteGeometry(
          HOME_LNG_LAT,
          ORDENER_191_MEET,
          "walking"
        );
        if (walkGeom) {
          walkGeometryRef.current = walkGeom;
        }
      } catch (err) {
        console.error("Failed to build walking route to meeting point", err);
      }

      // pickup ETA: 205 Rue Ordener → 191 Rue Ordener
      try {
        const pickupMin = await fetchRouteDurationMinutes(
          ORDENER_205,
          ORDENER_191_MEET,
          "driving"
        );
        if (pickupMin != null) {
          pickupEtaMinRef.current = pickupMin;
        }
      } catch (err) {
        console.error("Failed to compute pickup ETA", err);
      }

      const collection: FeatureCollection<Geometry, GeoJsonProperties> = {
        type: "FeatureCollection",
        features,
      };

      map.addSource("omw-routes", {
        type: "geojson",
        data: collection as any,
      });

      map.addLayer({
        id: "omw-routes-lines",
        type: "line",
        source: "omw-routes",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "visible",
        },
        paint: {
          "line-color": "#00ff88",
          "line-width": 4,
          "line-opacity": 0.9,
        },
        filter: ["==", ["get", "driverId"], "PAR-103"],
      } as any);

      map.addSource("omw-selected-route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "omw-selected-route-line",
        type: "line",
        source: "omw-selected-route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#ffffff",
          "line-width": 6,
          "line-opacity": 0.9,
        },
      });

      map.addSource("omw-walk-line", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [HOME_LNG_LAT, ORDENER_191_MEET],
          },
          properties: {},
        },
      });

      map.addLayer({
        id: "omw-walk-line-layer",
        type: "line",
        source: "omw-walk-line",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#00ff88",
          "line-width": 3,
          "line-opacity": 0.9,
          "line-dasharray": [1.2, 1.2],
        },
      });

      const startPar103Animation = () => {
        const coords = par103CoordsRef.current;
        if (!coords || coords.length === 0) {
          console.warn("No PAR-103 coordinates available for animation.");
          return;
        }

        if (moveIntervalRef.current != null) {
          window.clearInterval(moveIntervalRef.current);
          moveIntervalRef.current = null;
        }

        if (!movingMarkerRef.current) {
          const car = document.createElement("div");
          car.style.width = "32px";
          car.style.height = "32px";
          car.style.display = "flex";
          car.style.alignItems = "center";
          car.style.justifyContent = "center";
          car.style.filter = "drop-shadow(0 0 8px rgba(0,255,136,0.95))";

          const icon = document.createElement("img");
          icon.src = "/car-top.png";
          icon.alt = "PAR-103 driver";
          icon.style.width = "100%";
          icon.style.height = "100%";
          icon.style.objectFit = "contain";

          car.appendChild(icon);

          movingMarkerRef.current = new mapboxgl.Marker({ element: car })
            .setLngLat(coords[0])
            .addTo(map);
        } else {
          movingMarkerRef.current.setLngLat(coords[0]);
        }

        let step = 0;
        moveIntervalRef.current = window.setInterval(() => {
          if (!movingMarkerRef.current) return;

          step += 1;
          if (step >= coords.length) {
            window.clearInterval(moveIntervalRef.current!);
            moveIntervalRef.current = null;
            return;
          }

          movingMarkerRef.current.setLngLat(coords[step]);
        }, 750);
      };

      map.on("mouseenter", "omw-routes-lines", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "omw-routes-lines", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "omw-routes-lines", (e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const selectedSource = map.getSource(
          "omw-selected-route"
        ) as mapboxgl.GeoJSONSource | undefined;

        if (selectedSource) {
          selectedSource.setData(feature as any);
          map.setLayoutProperty(
            "omw-selected-route-line",
            "visibility",
            "visible"
          );
        }

        const props = feature.properties as {
          driverId: string;
          startName: string;
          endName: string;
          etaMin: number;
          price: number;
        };

        const pickupEtaMin = pickupEtaMinRef.current ?? 3;

        const walkSource = map.getSource(
          "omw-walk-line"
        ) as mapboxgl.GeoJSONSource | undefined;

        if (walkSource) {
          const geometry =
            walkGeometryRef.current ??
            ({
              type: "LineString",
              coordinates: [HOME_LNG_LAT, ORDENER_191_MEET],
            } as any);

          walkSource.setData({
            type: "Feature",
            geometry,
            properties: {},
          } as any);

          map.setLayoutProperty(
            "omw-walk-line-layer",
            "visibility",
            "visible"
          );
        }

        startPar103Animation();

        routeSelectRef.current?.({
          ...props,
          pickupEtaMin,
        });
      });

      // 🔹 user marker with OMW logo
      const userEl = document.createElement("div");
      userEl.style.width = "40px";
      userEl.style.height = "40px";
      userEl.style.borderRadius = "50%";
      userEl.style.overflow = "hidden";
      userEl.style.boxShadow = "0 0 10px rgba(0,0,0,0.4)";
      userEl.style.backgroundColor = "white";
      userEl.style.display = "flex";
      userEl.style.alignItems = "center";
      userEl.style.justifyContent = "center";

      const img = document.createElement("img");
      img.src = "/omw-logo.png";
      img.alt = "You (OMW)";
      img.style.width = "80%";
      img.style.height = "80%";
      img.style.objectFit = "contain";
      userEl.appendChild(img);

      userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
        .setLngLat(HOME_LNG_LAT)
        .addTo(map);

      // 🔹 geolocation: center map + move user marker to real GPS
      console.log("🔍 geolocation in navigator?", "geolocation" in navigator);

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log(
              "📍 Map got position",
              pos.coords.latitude,
              pos.coords.longitude
            );

            const lngLat: [number, number] = [
              pos.coords.longitude,
              pos.coords.latitude,
            ];

            map.setCenter(lngLat);

            if (userMarkerRef.current) {
              userMarkerRef.current.setLngLat(lngLat);
            }
          },
          (err) => {
            console.error(
              "❌ Geolocation error in map",
              err.code,
              err.message
            );
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
          }
        );
      } else {
        console.error("❌ Geolocation not supported in this browser");
      }

      // driver cars (static)
      DRIVER_ROUTES.forEach((def) => {
        if (def.id === "PAR-103") return;

        const car = document.createElement("div");
        car.style.width = "32px";
        car.style.height = "32px";
        car.style.display = "flex";
        car.style.alignItems = "center";
        car.style.justifyContent = "center";
        car.style.filter = "drop-shadow(0 0 6px rgba(0,255,136,0.9))";

        const icon = document.createElement("img");
        icon.src = "/car-top.png";
        icon.alt = def.id;
        icon.style.width = "100%";
        icon.style.height = "100%";
        icon.style.objectFit = "contain";

        car.appendChild(icon);

        new mapboxgl.Marker({ element: car })
          .setLngLat(def.from)
          .addTo(map);
      });

      EXTRA_CARS.forEach((lngLat) => {
        const car = document.createElement("div");
        car.style.width = "26px";
        car.style.height = "26px";
        car.style.display = "flex";
        car.style.alignItems = "center";
        car.style.justifyContent = "center";
        car.style.filter = "drop-shadow(0 0 5px rgba(0,255,136,0.8))";

        const icon = document.createElement("img");
        icon.src = "/car-top.png";
        icon.alt = "OMW driver";
        icon.style.width = "100%";
        icon.style.height = "100%";
        icon.style.objectFit = "contain";

        car.appendChild(icon);

        new mapboxgl.Marker({ element: car }).setLngLat(lngLat).addTo(map);
      });
    });

    return () => {
      if (moveIntervalRef.current != null) {
        window.clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
      if (movingMarkerRef.current) {
        movingMarkerRef.current.remove();
        movingMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      mapInstanceRef.current = null;
      map.remove();
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        height: "100%",
        width: "100%",
        zIndex: 1,
      }}
    />
  );
}
