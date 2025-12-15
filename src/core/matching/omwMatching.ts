export interface Coordinate {
  lat: number;
  lon: number;
}

export interface RideOffer {
  id: string;
  departure: Coordinate;
  destination: Coordinate;
  departureTime: Date;
  maxDetourMinutes: number;
  freeSeats: number;
  route: Coordinate[];
}

export interface RideRequest {
  id: string;
  from: Coordinate;
  to: Coordinate;
  departureTime: Date;
  maxWalkMeters: number;
  rideNow: boolean;
}

export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const R = 6371e3; // metres
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const aa = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function minDistanceToRoute(point: Coordinate, route: Coordinate[]): number {
  let minDist = Infinity;
  for (const node of route) {
    const dist = haversineDistance(point, node);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

function isCorrectDirection(pickupIdx: number, dropoffIdx: number): boolean {
  return pickupIdx >= 0 && dropoffIdx >= 0 && pickupIdx < dropoffIdx;
}

function estimateDetourDistance(
  offer: RideOffer,
  pickupPoint: Coordinate,
  dropoffPoint: Coordinate
): number {
  const directDistance = haversineDistance(offer.departure, offer.destination);
  const toPickup = haversineDistance(offer.departure, pickupPoint);
  const betweenStops = haversineDistance(pickupPoint, dropoffPoint);
  const toDestination = haversineDistance(dropoffPoint, offer.destination);
  return toPickup + betweenStops + toDestination - directDistance;
}

function detourDistanceToMinutes(detourMeters: number, avgSpeedKph = 30): number {
  const speedMetersPerMin = (avgSpeedKph * 1000) / 60;
  return detourMeters / speedMetersPerMin;
}

export function findMatches(
  offers: RideOffer[],
  request: RideRequest,
  currentTime: Date = new Date()
): { offer: RideOffer; score: number }[] {
  const results: { offer: RideOffer; score: number }[] = [];
  const timeMarginMinutes = request.rideNow ? 5 : 15;
  const requestedTime = request.departureTime.getTime();
  const windowStart = requestedTime - timeMarginMinutes * 60 * 1000;
  const windowEnd = requestedTime + timeMarginMinutes * 60 * 1000;

  for (const offer of offers) {
    if (offer.freeSeats <= 0) continue;
    const offerTime = offer.departureTime.getTime();
    if (offerTime < windowStart || offerTime > windowEnd) continue;
    const pickupDistance = minDistanceToRoute(request.from, offer.route);
    const dropoffDistance = minDistanceToRoute(request.to, offer.route);
    if (pickupDistance > request.maxWalkMeters || dropoffDistance > request.maxWalkMeters) continue;

    const pickupIdx = offer.route.reduce((bestIdx, node, idx) => {
      const bestDist = bestIdx >= 0 ? haversineDistance(request.from, offer.route[bestIdx]) : Infinity;
      const dist = haversineDistance(request.from, node);
      return dist < bestDist ? idx : bestIdx;
    }, -1);
    const dropoffIdx = offer.route.reduce((bestIdx, node, idx) => {
      const bestDist = bestIdx >= 0 ? haversineDistance(request.to, offer.route[bestIdx]) : Infinity;
      const dist = haversineDistance(request.to, node);
      return dist < bestDist ? idx : bestIdx;
    }, -1);
    if (!isCorrectDirection(pickupIdx, dropoffIdx)) continue;

    const detourMeters = estimateDetourDistance(offer, request.from, request.to);
    const detourMinutes = detourDistanceToMinutes(detourMeters);
    if (detourMinutes > offer.maxDetourMinutes || detourMinutes > 5) continue;
    const score = detourMinutes * 2 + (pickupDistance + dropoffDistance) / 1000;
    results.push({ offer, score });
  }
  results.sort((a, b) => a.score - b.score);
  return results;
}

/*
 * Demo usage has been removed from this module to avoid Node-specific type definitions.
 * To test the algorithm, import `findMatches`, build your RideOffer and RideRequest objects,
 * call `findMatches(offers, request)` and inspect the returned array of matches.
 */
