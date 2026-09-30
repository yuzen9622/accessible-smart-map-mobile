// 移植自 Web `src/lib/toolResultCards.ts`（commit f5027af），邏輯逐段保留。差異：Web 的 `Record<string, any>` 改 `unknown` 存取；
// 所有使用者可見的中文（標題、標籤、摘要）改由注入的 `t` 產生；`target`（Web 的面板物件）改為 `marker`（AiMarker）。
import { a11yPlacesToMarkers, asRecArray, at, getLatLng, googlePlacesToMarkers, isOk, isRec } from './aiResults';
import type { Translate } from './types';
import type { AiMarker } from './uiAction';
import type { LatLng } from '@/shared/geo';

type Rec = Record<string, unknown>;

export type ToolCardIcon = 'search' | 'a11y' | 'parking' | 'bus' | 'air' | 'env' | 'hazard' | 'nav';

export type ToolResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
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

const MAX_ITEMS = 30;

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
  items.slice(0, MAX_ITEMS).forEach((it, i) => {
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

/**
 * 把任一工具的結果正規化成統一的卡片群組；無法渲染時回 null。
 */
export function getToolResultGroup(name: string, result: unknown, t: Translate): ToolResultGroup | null {
  if (!isOk(result)) return null;
  const res: Rec = result;

  switch (name) {
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
          str(f.name) || enumLabel(A11Y_CATEGORIES, 'nativeAiA11yCategory_', f.category, t) || str(f.category),
        subtitle: (f) =>
          joinDot([
            enumLabel(A11Y_CATEGORIES, 'nativeAiA11yCategory_', f.category, t) || str(f.category),
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
        title: (p) => str(p.placeName) || str(p.name) || t('nativeAiCardParking'),
        subtitle: (p) =>
          joinDot([str(p.address) || str(p.district) || str(p.city), str(p.spaceLabel)]) || str(p.chargeType),
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
      const reports = asRecArray(at(data, 'reports') ?? res.reports ?? data);
      const items = locationItems(reports, t, {
        prefix: 'hazard',
        title: (r) =>
          enumLabel(HAZARD_TYPES, 'nativeAiHazardType_', r.hazardType, t) ||
          str(r.hazardType) ||
          str(r.type) ||
          t('nativeAiHazardFallback'),
        subtitle: (r) =>
          str(r.description) ||
          str(at(r, 'aiAnalysis', 'summary')) ||
          enumLabel(HAZARD_STATUSES, 'nativeAiHazardStatus_', r.status, t) ||
          str(r.status),
        requirePosition: true,
      });
      return items.length ? { heading: t('nativeAiCardHazards'), icon: 'hazard', items } : null;
    }

    // LiveBus[]: { plateNumb, routeName, directionLabel, lat, lng, isLowFloor, hasLiftOrRamp, statusLabel, stopsAway }
    case 'trackBuses': {
      const items = locationItems(asRecArray(res.buses), t, {
        prefix: 'bus',
        id: (b, i) => str(b.plateNumb) || str(b.PlateNumb) || String(i),
        title: (b) => {
          const route = str(b.routeName);
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
        requirePosition: true,
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
      for (const d of dirs) {
        const dirLabel = localName(d.destination ?? d.DestinationStop) || str(d.direction);
        for (const s of asRecArray(d.stops)) stops.push({ ...s, __dir: dirLabel });
      }
      const items = locationItems(stops, t, {
        prefix: 'stop',
        id: (s, i) =>
          str(s.StopUID) || str(s.stopUid) || str(s.StopID) || str(s.stopId) || localName(s.StopName) || String(i),
        title: (s) => localName(s.StopName) || str(s.stopName) || str(s.name) || t('nativeAiStopFallback'),
        subtitle: (s) => {
          const etaRaw = s.EstimateTime ?? s.estimateTime ?? s.eta;
          const eta = typeof etaRaw === 'number' ? fmtEtaSeconds(etaRaw, t) : str(etaRaw);
          return joinDot([str(s.__dir), eta]);
        },
      });
      const routeName = localName(res.routeName) || str(res.routeNo);
      return items.length
        ? {
            heading: routeName ? t('nativeAiCardBusStopsOf', { route: routeName }) : t('nativeAiCardBusStops'),
            icon: 'bus',
            items,
          }
        : null;
    }

    case 'getBusTimetable': {
      const schedules = asRecArray(res.schedules);
      const fallback = t('nativeAiScheduleFallback');
      const items: ToolResultItem[] = schedules
        .slice(0, MAX_ITEMS)
        .map((s, i) => {
          const rawTime = str(s.time) || str(s.DepartureTime) || str(s.departureTime) || str(s.ArrivalTime);
          return {
            id: `sched_${i}`,
            title: rawTime || fallback,
            subtitle: joinDot([localName(s.destination ?? s.DestinationStop), str(s.note)]),
          };
        })
        .filter((it) => it.title !== fallback || it.subtitle);
      const routeName = localName(res.routeName);
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
      cams.slice(0, MAX_ITEMS).forEach((c, i) => {
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
      const items: ToolResultItem[] = instructions.slice(0, MAX_ITEMS).map((step, i) => {
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

const MAX_DISPLAY_ITEMS_PER_GROUP = 12;

function mergeIntoExistingGroup(existing: ToolResultGroup, incoming: ToolResultGroup): ToolResultGroup {
  const seenIds = new Set(existing.items.map((it) => it.id));
  const seenKeys = new Set(existing.items.map((it) => `${it.title}_${it.subtitle ?? ''}`));

  const mergedItems = [...existing.items];
  for (const it of incoming.items) {
    const key = `${it.title}_${it.subtitle ?? ''}`;
    if (!seenIds.has(it.id) && !seenKeys.has(key)) {
      seenIds.add(it.id);
      seenKeys.add(key);
      mergedItems.push(it);
    }
  }

  let mergedNote = existing.note;
  if (incoming.note && incoming.note !== existing.note) {
    mergedNote = existing.note ? `${existing.note} · ${incoming.note}` : incoming.note;
  }

  return {
    ...existing,
    items: mergedItems.slice(0, MAX_DISPLAY_ITEMS_PER_GROUP),
    note: mergedNote,
  };
}

/**
 * 將一則訊息內的多個 ToolActivity 聚合為去重且整理過的 ToolResultGroup 列表。
 * - 相同 heading/icon 的群組自動合併並依據 id 去重
 * - 單一群組限制最多顯示項目數，避免畫面過度膨脹
 */
export function getAggregatedToolResults(
  activities: { name: string; result?: unknown; status?: string }[] | undefined,
  t: Translate,
): ToolResultGroup[] {
  if (!activities?.length) return [];

  const groups: ToolResultGroup[] = [];

  for (const act of activities) {
    if (act.status === 'running') continue;
    const group = getToolResultGroup(act.name, act.result, t);
    if (!group?.items.length) continue;

    const existingIndex = groups.findIndex((g) => g.icon === group.icon && g.heading === group.heading);

    if (existingIndex !== -1) {
      groups[existingIndex] = mergeIntoExistingGroup(groups[existingIndex], group);
    } else {
      groups.push({
        ...group,
        items: group.items.slice(0, MAX_DISPLAY_ITEMS_PER_GROUP),
      });
    }
  }

  return groups;
}
