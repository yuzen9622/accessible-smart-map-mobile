// 移植自 Web `src/lib/toolResultCards.ts`（commit f5027af），邏輯逐段保留。差異：Web 的 `Record<string, any>` 改 `unknown` 存取；
// 所有使用者可見的中文（標題、標籤、摘要）改由注入的 `t` 產生；`target`（Web 的面板物件）改為 `marker`（AiMarker）。
import { a11yPlacesToMarkers, asRecArray, at, getLatLng, googlePlacesToMarkers, isOk, isRec } from './aiResults';
import type { Translate } from './types';
import { httpResultUrl } from './resultUrl';
import type { AiMarker } from './uiAction';
import type { LatLng } from '@/shared/geo';

type Rec = Record<string, unknown>;

export type ToolCardIcon = 'search' | 'a11y' | 'parking' | 'bus' | 'air' | 'env' | 'hazard' | 'nav';

export type ToolResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  url?: string;
  position?: LatLng | null;
  // 有 marker → 可開既有詳情；否則有 position → 飛到該點
  marker?: AiMarker;
};

export type ToolResultGroup = {
  heading: string;
  icon: ToolCardIcon;
  items: ToolResultItem[];
  /** 顯示在標題下的摘要文字（建議、天氣描述等） */
  note?: string;
};

// --- 列舉 → 標籤（對照 route domain 的後端型別）；key 為 `nativeAiA11yCategory_*` 等 ---
const A11Y_CATEGORIES = ['wheelchair_accessible', 'kerb_cut', 'ramp', 'elevator', 'toilet'];
const HAZARD_TYPES = ['obstacle', 'construction', 'data_error'];
const HAZARD_STATUSES = ['pending', 'verified', 'rejected', 'expired'];

function enumLabel(known: readonly string[], prefix: string, value: unknown, t: Translate): string | undefined {
  return typeof value === 'string' && known.includes(value) ? t(`${prefix}${value}`) : undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

/** 雙語名稱（TDX BilingualName）或純字串都能取出中文 */
function localName(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (isRec(v)) return str(v.Zh_tw) || str(v.zh_tw) || str(v.En);
  return undefined;
}

function isAffirmative(v: unknown): boolean {
  return ['1', 'true', '是', 'y', 'yes'].includes(String(v ?? '').trim().toLowerCase());
}

/** TDX EstimateTime 為秒，轉成易讀文字 */
function fmtEtaSeconds(sec: unknown, t: Translate): string | undefined {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return undefined;
  if (sec <= 0) return t('nativeAiEtaArriving');
  if (sec < 60) return t('nativeAiEtaSoon');
  return t('nativeAiEtaMinutes', { minutes: Math.round(sec / 60) });
}

function markersToItems(markers: AiMarker[]): ToolResultItem[] {
  return markers.map((m) => ({
    id: m.id,
    title: m.title,
    subtitle: m.subtitle,
    position: m.position,
    marker: m,
  }));
}

/** 把含座標的陣列轉成可點飛行的卡片 */
function locationItems(
  items: Rec[],
  t: Translate,
  opts: {
    prefix: string;
    id?: (it: Rec, index: number) => string | undefined;
    title: (it: Rec) => string | undefined;
    subtitle?: (it: Rec) => string | undefined;
    badge?: (it: Rec) => string | undefined;
    requirePosition?: boolean;
  },
): ToolResultItem[] {
  const out: ToolResultItem[] = [];
  items.forEach((it, i) => {
    const position = getLatLng(it);
    if (opts.requirePosition && !position) return;
    const rawId =
      opts.id?.(it, i) ?? it.id ?? it._id ?? it.osmId ?? it.plateNumb ?? it.PlateNumb ?? it.stopUid ?? it.StopUID ?? it.name ?? i;
    out.push({
      id: `${opts.prefix}_${String(rawId)}`,
      title: opts.title(it) || t('nativeAiItemFallback'),
      subtitle: opts.subtitle?.(it),
      badge: opts.badge?.(it),
      position,
    });
  });
  return out;
}

function joinDot(parts: (string | null | undefined)[]): string | undefined {
  return parts.filter(Boolean).join(' · ') || undefined;
}

function busScheduleText(value: unknown, t: Translate): string | undefined {
  return asRecArray(value).map((schedule) => {
    const frequencies = asRecArray(schedule.frequencies).map((frequency) => {
      if (frequency.scheduleType === 'trip') {
        return joinDot([str(frequency.serviceDays), t('nativeAiOriginDeparture', {
          stop: str(frequency.originStopDisplayName) || str(frequency.originStopName) || '',
          time: str(frequency.originDepartureTime) || '',
        }), ...asRecArray(frequency.stopTimes).map((stop) => joinDot([str(stop.stopDisplayName) || str(stop.stopName), str(stop.arrivalTime)]))]);
      }
      return joinDot([str(frequency.serviceDays), [str(frequency.start), str(frequency.end)].filter(Boolean).join('–'),
        t('nativeAiHeadway', { min: str(frequency.minHeadwayMins) || '?', max: str(frequency.maxHeadwayMins) || '?' })]);
    });
    return joinDot([str(schedule.subRouteDisplayName) || str(schedule.subRouteName), str(schedule.directionLabel),
      schedule.first ? t('nativeAiFirstLastService', { first: str(schedule.first) || '', last: str(schedule.last) || '' }) : undefined,
      ...frequencies]);
  }).filter(Boolean).join('\n') || undefined;
}

function campusName(campus: Rec): string | undefined {
  return joinDot([str(campus.displaySchoolName) || str(campus.schoolName), str(campus.displayBranchName) || str(campus.branchName)]);
}

/** 把工具結果正規化成既有的卡片群組。 */
export function getToolResultGroup(name: string, result: unknown, t: Translate): ToolResultGroup | null {
  if (!isOk(result)) return null;
  const res: Rec = result;

  switch (name) {
    case 'findCampusAccessibility': {
      const items = locationItems(asRecArray(res.campuses), t, {
        prefix: 'campus', id: (campus) => str(campus.campusId), title: campusName,
        subtitle: (campus) => joinDot([str(campus.displayAddress) || str(campus.address), str(campus.phone),
          t('nativeAiCampusFacilityCount', { count: Number(campus.facilityCount ?? 0) }),
          ...asRecArray(campus.facTypeSummary).map((entry) => `${str(entry.label) || str(entry.code)} ${str(entry.count) || ''}`)]),
      });
      return items.length ? { heading: t('nativeAiCardCampus'), icon: 'a11y', items,
        note: t('nativeAiCampusPage', { page: Number(res.page ?? 1), pages: Number(res.totalPages ?? 1), total: Number(res.totalCount ?? items.length) }) } : null;
    }
    case 'getCampusAccessibilityDetails': {
      const campus = isRec(res.campus) ? res.campus : {};
      const items = locationItems(asRecArray(res.facilities), t, {
        prefix: `campus_${str(campus.campusId) || ''}`, id: (facility) => str(facility.facUid),
        title: (facility) => str(facility.displayName) || str(facility.name) || str(facility.facType) || str(facility.type),
        subtitle: (facility) => joinDot([str(facility.building), str(facility.facType) || str(facility.type),
          Array.isArray(facility.floors) ? facility.floors.map(str).filter(Boolean).join(', ') : undefined,
          ...asRecArray(facility.specs).map((spec) => `${str(spec.label) || ''}: ${str(spec.value) || ''}`)]),
      });
      const facilityCount = items.length;
      if (campusName(campus) || getLatLng(campus)) items.unshift({ id: `campus_${str(campus.campusId) || '0'}`, title: campusName(campus) || t('nativeAiCardCampus'), position: getLatLng(campus) });
      return items.length ? { heading: campusName(campus) || t('nativeAiCardCampus'), icon: 'a11y', items,
        note: joinDot([str(campus.displayAddress) || str(campus.address), str(campus.phone),
          t('nativeAiCampusFacilityCount', { count: Number(res.totalMatchedFacilities ?? facilityCount) }),
          res.truncated ? t('nativeAiResultsTruncated', { count: facilityCount }) : undefined]) } : null;
    }
    case 'getBusArrival': {
      const items = locationItems(asRecArray(res.arrivals), t, {
        prefix: 'arrival', id: (arrival, index) => `${str(arrival.subRouteUid) || index}_${str(arrival.direction) || index}`,
        title: (arrival) => str(arrival.stopDisplayName) || str(arrival.stopName) || str(res.stopDisplayName) || str(res.stopName),
        subtitle: (arrival) => joinDot([str(res.routeDisplayName) || str(res.routeName), str(arrival.subRouteDisplayName) || str(arrival.subRouteName), str(arrival.directionLabel),
          typeof arrival.estimateMinutes === 'number' ? t('nativeAiEtaMinutes', { minutes: arrival.estimateMinutes }) : undefined,
          str(arrival.statusLabel), str(arrival.plateNumb)]),
      });
      return items.length ? { heading: t('nativeAiCardBusArrival'), icon: 'bus', items } : null;
    }
    case 'findNearbyBusStops': {
      const items = locationItems(asRecArray(res.stops), t, {
        prefix: 'nearby_stop', title: (stop) => str(stop.stopDisplayName) || str(stop.stopName),
        subtitle: (stop) => {
          const routes = stop.routeDisplayNames ?? stop.routes;
          return joinDot([Array.isArray(routes) ? routes.map(str).filter(Boolean).join(', ') : undefined,
            typeof stop.distance === 'number' ? t('nativeAiDistanceAbout', { value: Math.round(stop.distance) }) : undefined]);
        },
      });
      return items.length ? { heading: t('nativeAiCardBusStops'), icon: 'bus', items } : null;
    }
    case 'getTrainTimetable':
    case 'getStationTimetable': {
      const stationName = (value: unknown) => str(at(value, 'displayName')) || str(at(value, 'name'));
      const items = asRecArray(res.trains).map((train, index) => ({
        id: `train_${str(train.trainNo) || index}_${str(train.departureTime) || index}`,
        title: joinDot([str(train.trainNo), str(train.trainTypeDisplayName) || str(train.trainType), str(train.departureTime), str(train.arrivalTime)]) || t('nativeAiScheduleFallback'),
        subtitle: joinDot([stationName(res.origin) || stationName(res.station), stationName(res.destination) || str(train.destinationDisplayName) || str(train.destination),
          typeof train.durationMinutes === 'number' ? t('nativeAiDurationMinutes', { minutes: train.durationMinutes }) : undefined,
          train.arrivesNextDay ? t('nativeAiNextDay') : undefined]),
      }));
      return items.length ? { heading: t('nativeAiCardTrainTimetable'), icon: 'bus', items, note: joinDot([str(res.railSystem), str(res.date), str(res.note),
        res.firstTrain ? t('nativeAiFirstLastService', { first: str(res.firstTrain) || '', last: str(res.lastTrain) || '' }) : undefined]) } : null;
    }
    case 'getMetroAlerts':
    case 'getTransitAlerts': {
      const alerts = asRecArray(res.alerts).flatMap((entry) => Array.isArray(entry.alerts)
        ? asRecArray(entry.alerts).map((alert) => ({ ...alert, railSystem: entry.railSystem, updatedAt: entry.updatedAt })) : [entry]);
      const items = alerts.map((alert, index) => ({ id: `alert_${str(alert.railSystem) || ''}_${str(alert.alertId) || index}`,
        title: str(alert.title) || t('nativeAiCardTransitAlerts'),
        subtitle: joinDot([str(alert.description), str(alert.railSystem), ...asRecArray(alert.stations).map((station) => str(station.name) || str(station.id)),
          str(alert.startTime), str(alert.endTime), str(alert.updateTime) || str(alert.updatedAt)]), url: httpResultUrl(alert.alertUrl),
      }));
      const summary = str(res.summary);
      if (!items.length && summary) items.push({ id: 'alert_summary', title: summary, subtitle: undefined, url: undefined });
      return items.length ? { heading: t('nativeAiCardTransitAlerts'), icon: 'hazard', note: str(res.summary), items } : null;
    }
    case 'searchAccessibilityGuide': {
      const items = asRecArray(res.results).map((guide, index) => ({ id: `guide_${index}`, title: str(guide.title) || t('nativeAiCardGuide'),
        subtitle: str(guide.content), badge: joinDot([str(guide.category), str(guide.source)]), url: httpResultUrl(guide.source) }));
      const message = str(res.message);
      if (!items.length && message) items.push({ id: 'guide_empty', title: message, subtitle: undefined, badge: undefined, url: undefined });
      return items.length ? { heading: t('nativeAiCardGuide'), icon: 'a11y', items } : null;
    }
    case 'webSearch': {
      const items = asRecArray(res.sources).map((source, index) => ({ id: `web_${index}`, title: str(source.title) || str(source.domain) || str(source.url) || t('nativeAiCardSources'),
        subtitle: str(source.domain) || str(source.url), url: httpResultUrl(source.url) }));
      if (!items.length && str(res.answer)) items.push({ id: 'web_answer', title: t('nativeAiCardSources'), subtitle: undefined, url: undefined });
      return items.length ? { heading: t('nativeAiCardSources'), icon: 'search', note: str(res.answer), items } : null;
    }
    case 'findGooglePlaces': {
      const items = markersToItems(googlePlacesToMarkers(result, t));
      return items.length ? { heading: t('nativeAiCardPlaces'), icon: 'search', items } : null;
    }

    case 'findA11yPlaces': {
      const items = markersToItems(a11yPlacesToMarkers(result, t));
      return items.length ? { heading: t('nativeAiA11yFacilities'), icon: 'a11y', items } : null;
    }

    // SlimOsmA11y[]: { osmId, name?, category(enum), wheelchair?, location: GeoPoint }
    case 'getA11yFacilityDetails': {
      const items = locationItems(asRecArray(res.facilities), t, {
        prefix: 'a11yfac',
        title: (f) =>
          str(f.displayName) || str(f.name) || enumLabel(A11Y_CATEGORIES, 'nativeAiA11yCategory_', f.category, t) || str(f.category),
        subtitle: (f) =>
          joinDot([
            enumLabel(A11Y_CATEGORIES, 'nativeAiA11yCategory_', f.category, t) || str(f.category),
            isRec(f.tags) ? Object.entries(f.tags).map(([key, value]) => `${key}: ${str(value) ?? ''}`).join('\n') : undefined,
            f.wheelchair === 'yes'
              ? t('nativeAiWheelchairYes')
              : f.wheelchair === 'limited'
                ? t('nativeAiWheelchairLimited')
                : undefined,
          ]),
      });
      return items.length ? { heading: t('nativeAiCardA11yDetails'), icon: 'a11y', items } : null;
    }

    // 停車格 / 停車場混合（ParkingSpaceNearby | ParkingLotNearby）：
    // 格位用 placeName/district/quantity，停車場用 name/address/disabledSpaces。
    case 'findNearbyParking': {
      const items = locationItems(asRecArray(res.parkingSpots), t, {
        prefix: 'parking',
        title: (p) => str(p.displayName) || str(p.placeName) || str(p.name) || t('nativeAiCardParking'),
        subtitle: (p) =>
          joinDot([str(p.displayAddress) || str(p.address) || str(p.district) || str(p.city), str(p.spaceLabel)]) || str(p.chargeType),
        badge: (p) => {
          const q = str(p.disabledSpaces ?? p.quantity ?? p.availableSpaces);
          return q != null ? t('nativeAiParkingSpaces', { value: q }) : undefined;
        },
        requirePosition: true,
      });
      const total = str(res.total);
      return items.length
        ? {
            heading: t('nativeAiCardParking'),
            icon: 'parking',
            items,
            note: total ? t('nativeAiParkingTotal', { value: total }) : undefined,
          }
        : null;
    }

    // HazardReport[]: { hazardType, reportedLocation.coordinates, description, status, aiAnalysis.summary }
    case 'getNearbyHazards': {
      const data = at(res, 'data');
      const reports = [...asRecArray(at(data, 'reports') ?? res.reports ?? data), ...asRecArray(at(data, 'roadEvents'))];
      const items = locationItems(reports, t, {
        prefix: 'hazard',
        title: (r) => str(r.title) ||
          enumLabel(HAZARD_TYPES, 'nativeAiHazardType_', r.hazardType, t) ||
          str(r.hazardType) ||
          str(r.type) ||
          t('nativeAiHazardFallback'),
        subtitle: (r) => joinDot([
          str(r.description) || str(at(r, 'aiAnalysis', 'summary')),
          str(r.locationDescription), str(r.source), str(r.severity),
          enumLabel(HAZARD_STATUSES, 'nativeAiHazardStatus_', r.status, t) || str(r.status),
        ]),
      });
      return items.length ? { heading: t('nativeAiCardHazards'), icon: 'hazard', items } : null;
    }

    // LiveBus[]: { plateNumb, routeName, directionLabel, lat, lng, isLowFloor, hasLiftOrRamp, statusLabel, stopsAway }
    case 'trackBuses': {
      const items = locationItems(asRecArray(res.buses), t, {
        prefix: 'bus',
        id: (b, i) => str(b.plateNumb) || str(b.PlateNumb) || String(i),
        title: (b) => {
          const route = str(b.routeDisplayName) || str(res.routeDisplayName) || str(b.routeName) || str(res.routeName);
          const plate = str(b.plateNumb);
          if (route && plate && route !== plate) {
            return `${route} · ${plate}`;
          }
          return route || plate || t('nativeAiBusFallback');
        },
        subtitle: (b) =>
          joinDot([
            str(b.directionLabel),
            b.stopsAway != null ? t('nativeAiStopsAway', { count: Number(b.stopsAway) }) : str(b.statusLabel),
          ]),
        badge: (b) => (isAffirmative(b.isLowFloor) || isAffirmative(b.hasLiftOrRamp) ? t('nativeAiLowFloor') : undefined),
      });
      const count = str(res.count);
      const low = str(res.lowFloorCount);
      const note = [
        count != null ? t('nativeAiBusCount', { value: count }) : null,
        low != null ? t('nativeAiBusLowFloorCount', { value: low }) : null,
      ]
        .filter(Boolean)
        .join(t('nativeAiListSeparator'));
      return items.length
        ? {
            heading: t('nativeAiCardBuses'),
            icon: 'bus',
            items,
            note: note || undefined,
          }
        : null;
    }

    // directions[].stops（TDX 形狀：StopName.Zh_tw、StopPosition、EstimateTime 秒）
    case 'getBusRoute':
    case 'getBusRouteDetail': {
      const dirs = asRecArray(res.directions);
      const stops: Rec[] = [];
      for (const [index, d] of dirs.entries()) {
        const dirLabel = str(d.toDisplayName) || str(d.to) || localName(d.destination ?? d.DestinationStop) || str(d.directionLabel) || str(d.direction);
        for (const s of asRecArray(d.stops)) stops.push({ ...s, __dir: dirLabel, __directionId: `${str(d.subRouteUid) ?? index}_${str(d.direction) ?? index}` });
      }
      const items = locationItems(stops, t, {
        prefix: 'stop',
        id: (s, i) =>
          `${s.__directionId}_${str(s.StopUID) || str(s.stopUid) || str(s.StopID) || str(s.stopId) || localName(s.StopName) || i}_${str(s.seq) ?? i}`,
        title: (s) => str(s.displayName) || str(s.stopDisplayName) || localName(s.StopName) || str(s.stopName) || str(s.name) || t('nativeAiStopFallback'),
        subtitle: (s) => {
          const etaRaw = s.EstimateTime ?? s.estimateTime ?? s.eta;
          const eta = typeof etaRaw === 'number' ? fmtEtaSeconds(etaRaw, t) : str(etaRaw);
          return joinDot([str(s.__dir), typeof s.estimateMinutes === 'number' ? t('nativeAiEtaMinutes', { minutes: s.estimateMinutes }) : eta, str(s.statusLabel)]);
        },
      });
      const routeName = str(res.routeDisplayName) || localName(res.routeName) || str(res.routeNo);
      return items.length
        ? {
            heading: routeName ? t('nativeAiCardBusStopsOf', { route: routeName }) : t('nativeAiCardBusStops'),
            icon: 'bus',
            items,
            note: busScheduleText(res.schedules, t),
          }
        : null;
    }

    case 'getBusTimetable': {
      const scheduleText = busScheduleText(res.schedules, t);
      if (scheduleText) return { heading: str(res.routeDisplayName) || str(res.routeName) || t('nativeAiCardBusTimetable'), icon: 'bus', note: str(res.note), items: [{ id: 'bus_schedule', title: t('nativeAiCardBusTimetable'), subtitle: scheduleText }] };
      const schedules = asRecArray(res.schedules);
      const fallback = t('nativeAiScheduleFallback');
      const items: ToolResultItem[] = schedules
        .map((s, i) => {
          const rawTime = str(s.time) || str(s.DepartureTime) || str(s.departureTime) || str(s.ArrivalTime);
          return {
            id: `sched_${i}`,
            title: rawTime || fallback,
            subtitle: joinDot([str(s.subRouteDisplayName) || localName(s.destination ?? s.DestinationStop), str(s.note)]),
          };
        })
        .filter((it) => it.title !== fallback || it.subtitle);
      const routeName = str(res.routeDisplayName) || localName(res.routeName);
      return items.length
        ? {
            heading: routeName ? t('nativeAiCardBusTimetableOf', { route: routeName }) : t('nativeAiCardBusTimetable'),
            icon: 'bus',
            items,
          }
        : null;
    }

    // getAirQuality 工具：{ pm25, quality, advice, coordinates, city, area }
    case 'getAirQuality': {
      const pm25 = str(res.pm25);
      const quality = str(res.quality) || str(res.description);
      const position = getLatLng(res.coordinates ?? res);
      const place = [str(res.city), str(res.area)].filter(Boolean).join(' ');
      if (pm25 == null && quality == null) return null;
      return {
        heading: place ? t('nativeAiCardAirIn', { place }) : t('nativeAiCardAir'),
        icon: 'air',
        note: str(res.advice),
        items: [
          {
            id: 'air_0',
            title: pm25 != null ? `PM2.5 ${pm25} μg/m³` : (quality ?? t('nativeAiCardAir')),
            subtitle: pm25 != null ? quality : undefined,
            position,
          },
        ],
      };
    }

    // EnvironmentData: { weather{temperature,condition,...}, airQuality{description,quality}, cameras{items:[{name,url,distance}]} }
    case 'getEnvironmentInfo': {
      const items: ToolResultItem[] = [];
      const w = isRec(res.weather) ? res.weather : undefined;
      if (w && w.status !== 'unavailable') {
        const temp = str(w.temperature ?? w.temp);
        const desc = str(w.condition ?? w.description ?? w.weather);
        const title = [temp != null ? `${temp}°C` : null, desc].filter(Boolean).join(' ') || t('nativeAiWeather');
        const rain = str(w.precipitationProbability);
        items.push({
          id: 'env_weather',
          title,
          subtitle: rain != null ? t('nativeAiRainChance', { value: rain }) : undefined,
        });
      }
      const aq = isRec(res.airQuality) ? res.airQuality : undefined;
      if (aq && aq.status !== 'unavailable') {
        const pm25 = str(aq.pm25);
        items.push({
          id: 'env_air',
          title: pm25 != null ? `PM2.5 ${pm25}` : t('nativeAiAirQualityValue', { value: str(aq.quality) ?? '' }).trim(),
          subtitle: str(aq.description),
          position: getLatLng(aq.coordinates ?? aq),
        });
      }
      // cameras.items（EnvironmentData）或 nearbyCctv（工具別名）；多半無座標
      const cams = asRecArray(at(res, 'cameras', 'items') ?? res.nearbyCctv);
      cams.forEach((c, i) => {
        items.push({
          id: `cctv_${i}`,
          title: str(c.name) || str(c.title) || t('nativeAiCctvFallback'),
          subtitle: c.distance != null ? t('nativeAiDistanceAbout', { value: Math.round(Number(c.distance)) }) : str(c.address) || str(c.road),
          position: getLatLng(c),
        });
      });

      return items.length ? { heading: t('nativeAiCardEnvironment'), icon: 'env', items } : null;
    }

    // NavInstruction[]: { text, type, relativeDirection, distanceM, streetName }（無座標）
    case 'getNavInstructions': {
      const instructions = asRecArray(res.instructions);
      const items: ToolResultItem[] = instructions.map((step, i) => {
        const dist =
          typeof step.distanceM === 'number' && step.distanceM > 0
            ? step.distanceM >= 1000
              ? `${(step.distanceM / 1000).toFixed(1)} km`
              : `${Math.round(step.distanceM)} m`
            : undefined;
        return {
          id: `nav_${i}`,
          title: str(step.text) || str(step.instruction) || t('nativeAiStepFallback', { n: i + 1 }),
          subtitle: joinDot([str(step.relativeDirection), str(step.streetName), dist]),
        };
      });
      const total = str(res.totalSteps);
      return items.length
        ? {
            heading: t('nativeAiCardNavigation'),
            icon: 'nav',
            items,
            note: total ? t('nativeAiNavTotal', { value: total }) : undefined,
          }
        : null;
    }

    default:
      return null;
  }
}

function mergeIntoExistingGroup(existing: ToolResultGroup, incoming: ToolResultGroup): ToolResultGroup {
  const merged = new Map(existing.items.map((item) => [item.id, item]));
  const replacesExisting = incoming.items.some((item) => merged.has(item.id));
  for (const item of incoming.items) merged.set(item.id, item);
  const mergedItems = [...merged.values()];
  const mergedNote = replacesExisting ? incoming.note : joinDot([existing.note, incoming.note !== existing.note ? incoming.note : undefined]);

  return {
    ...existing,
    items: mergedItems,
    note: mergedNote,
  };
}

/**
 * 將一則訊息內的多個 ToolActivity 聚合為去重且整理過的 ToolResultGroup 列表。
 * - 相同 heading/icon 的群組自動合併並依據 id 去重
 * - 保留全部結果，由卡片元件分批顯示
 */
export function getAggregatedToolResults(
  activities: { name: string; result?: unknown; status?: string }[] | undefined,
  t: Translate,
): ToolResultGroup[] {
  if (!activities?.length) return [];

  const groups: ToolResultGroup[] = [];

  for (const act of activities) {
    if (act.status === 'running' || act.status === 'error') continue;
    const group = getToolResultGroup(act.name, act.result, t);
    if (!group?.items.length) continue;

    const existingIndex = groups.findIndex((g) => g.icon === group.icon && g.heading === group.heading);

    if (existingIndex !== -1) {
      groups[existingIndex] = mergeIntoExistingGroup(groups[existingIndex], group);
    } else {
      groups.push({
        ...group,
        items: group.items,
      });
    }
  }

  return groups;
}
