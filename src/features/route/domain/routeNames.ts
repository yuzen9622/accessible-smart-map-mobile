import type { AccessibleRoute, LegSourceNames, RouteLanguage, RouteLeg, SlimOsmA11y, WalkLeg } from '../types/route';

// Request provenance is client-only, not part of the DTO/query or persisted identity.
// A copied/replayed/legacy route without provenance deliberately uses source names.
const requestLanguages = new WeakMap<object, RouteLanguage>();

export function nonEmptyName(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

/** Call only with the language of the response's ORIGINAL request, not today's UI language. */
export function recordRouteNameLanguage(route: AccessibleRoute, language: RouteLanguage): AccessibleRoute {
  requestLanguages.set(route, language);
  for (const leg of route.legs) requestLanguages.set(leg, language);
  return route;
}

function sourceName(canonical: string, english: string | undefined, display: string | undefined,
  language: RouteLanguage, requestLanguage: RouteLanguage | undefined): string {
  if (requestLanguage === language) return nonEmptyName(display, canonical);
  return language === 'en' ? nonEmptyName(english, canonical) : canonical;
}

function facilityNames(items: SlimOsmA11y[] | undefined, language: RouteLanguage, requestLanguage?: RouteLanguage): SlimOsmA11y[] {
  return (items ?? []).map((item) => ({ ...item, displayName: sourceName(item.name ?? '', item.nameEn, item.displayName, language, requestLanguage) }));
}

/** Presentation-only copy. Never write this projection back to a route/navigation store. */
export function presentRouteLegNames(leg: RouteLeg, language: RouteLanguage,
  requestLanguage = requestLanguages.get(leg)): RouteLeg {
  if (leg.type !== 'WALK' && leg.type !== 'BUS' && leg.type !== 'METRO' && leg.type !== 'THSR' && leg.type !== 'TRA') return leg;
  const canonicalFrom = leg.type === 'WALK' ? leg.from : leg.type === 'BUS' ? leg.departureStop : leg.departureStation;
  const canonicalTo = leg.type === 'WALK' ? leg.to : leg.type === 'BUS' ? leg.arrivalStop : leg.arrivalStation;
  const canonicalRoute = leg.type === 'BUS' ? leg.routeName : leg.type === 'METRO' ? leg.lineName : leg.type === 'TRA' ? leg.trainTypeName : '';
  const names: LegSourceNames = {
    fromDisplayName: sourceName(canonicalFrom, leg.fromNameEn, leg.fromDisplayName, language, requestLanguage),
    toDisplayName: sourceName(canonicalTo, leg.toNameEn, leg.toDisplayName, language, requestLanguage),
    routeDisplayName: sourceName(canonicalRoute, leg.routeNameEn, leg.routeDisplayName, language, requestLanguage),
  };
  let result: RouteLeg;
  if (leg.type === 'WALK') {
    result = { ...leg, ...names, a11yFacilities: facilityNames(leg.a11yFacilities, language, requestLanguage) };
  } else {
    const intermediateStops = leg.intermediateStops?.map((stop) => ({ ...stop,
      displayName: sourceName(stop.name, stop.nameEn, stop.displayName, language, requestLanguage) }));
    result = leg.type === 'BUS'
      ? { ...leg, ...names, intermediateStops,
          departureStopA11y: facilityNames(leg.departureStopA11y, language, requestLanguage),
          arrivalStopA11y: facilityNames(leg.arrivalStopA11y, language, requestLanguage) }
      : { ...leg, ...names, intermediateStops,
          departureStationA11y: facilityNames(leg.departureStationA11y, language, requestLanguage),
          arrivalStationA11y: facilityNames(leg.arrivalStationA11y, language, requestLanguage) };
    if (result.type === 'METRO' && result.terminalStation?.trim()) {
      result.terminalDisplayName = sourceName(result.terminalStation, result.terminalNameEn,
        result.terminalDisplayName, language, requestLanguage);
    }
  }
  return result;
}

export function presentRouteNames(route: AccessibleRoute, language: RouteLanguage,
  requestLanguage = requestLanguages.get(route)): AccessibleRoute {
  return { ...route,
    legs: route.legs.map((leg) => presentRouteLegNames(leg, language, requestLanguage)),
    ...(route.facilities ? { facilities: Object.fromEntries(Object.entries(route.facilities).map(([id, facility]) =>
      [id, facilityNames([facility], language, requestLanguage)[0]])) } : {}),
  };
}

/** Pair against ORIGINAL steps before filtering/sorting. Duplicate indices invalidate every candidate. */
export function walkStreetNames(leg: WalkLeg, language: RouteLanguage,
  requestLanguage = requestLanguages.get(leg)): string[] {
  const steps = leg.steps ?? [];
  const entries = leg.stepStreetNames ?? [];
  const counts = new Map<number, number>();
  for (const entry of entries) counts.set(entry.index, (counts.get(entry.index) ?? 0) + 1);
  return steps.map((step, index) => {
    const entry = entries.find((item) => item.index === index);
    if (!entry || counts.get(index) !== 1 || !Number.isInteger(entry.index) ||
      entry.streetName !== step.streetName || !entry.nameEn?.trim()) return step.streetName;
    return sourceName(step.streetName, entry.nameEn, entry.displayName, language, requestLanguage);
  });
}
