import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  MarkerClustererF,
  Polyline,
  useLoadScript,
} from "@react-google-maps/api";
import { Loader2, Navigation } from "lucide-react";

import type { CrisisRequest, CrisisType } from "@/components/crisis/types";
import type { VolunteerPosition } from "@/hooks/use-socket";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const LIBRARIES: ("geometry" | "places")[] = ["geometry", "places"];

type SafeZone = {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  description: string | null;
  createdAt: string;
};

type AuthUser = {
  role: string;
  email: string;
};

export type GoogleMapHandle = {
  panTo: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  filteredSortedRequests: CrisisRequest[];
  heatmapRequests: CrisisRequest[];
  safeZones: SafeZone[];
  volunteerPositions: Record<string, VolunteerPosition>;
  volunteerLocation: { lat: number; lng: number } | null;
  pendingCoords: { lat: number; lng: number } | null;
  routeAlternatives: Array<{ points: { lat: number; lng: number }[]; distanceM: number; durationSec: number }>;
  selectedRouteIdx: number;
  activeClaimedTask: { requestId: string; crisisLat: number; crisisLng: number } | null;
  directionsResult: { routes: Array<{ points: google.maps.LatLngLiteral[]; selected: boolean }> } | null;
  mapLayer: "streets" | "satellite";
  showHeatmap: boolean;
  heatmapMode: "combined" | "type";
  showClusters: boolean;
  showVolunteerHeatmap: boolean;
  showVolunteers: boolean;
  showZones: boolean;
  mode: "victim" | "volunteer";
  authUser: AuthUser | null;
  pinZoneMode: boolean;
  isOnDuty: boolean;
  deletingZoneId: number | null;
  popupRequest: CrisisRequest | null;
  volunteerPopup: VolunteerPosition | null;
  zonePopup: SafeZone | null;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (request: CrisisRequest) => void;
  onVolunteerMarkerClick: (vol: VolunteerPosition) => void;
  onZoneMarkerClick: (zone: SafeZone) => void;
  onClosePopup: () => void;
  onCloseVolunteerPopup: () => void;
  onCloseZonePopup: () => void;
  onSelectRoute: (idx: number) => void;
  onDeleteZone: (zoneId: number) => void;
  openDetails: (requestId: string) => void;
  onClaimRequest?: (requestId: string) => void;
  claimingId?: string | null;
  showRoute?: boolean;
};

// ─── Custom canvas heatmap overlay ───────────────────────────────────────────

function buildPalette(gradient: string[], stops?: number[]): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  gradient.forEach((color, i) => {
    const pos = stops ? stops[i] : i / (gradient.length - 1);
    g.addColorStop(Math.min(1, Math.max(0, pos)), color);
  });
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

// Smooth cubic ease-in — maps 0→1 with no discontinuity anywhere
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

class HeatmapOverlay {
  private overlay: google.maps.OverlayView;
  private canvas: HTMLCanvasElement;
  private points: google.maps.LatLngLiteral[] = [];
  private radius: number;
  private palette: Uint8ClampedArray;
  private opacity: number;
  private stops?: number[];

  constructor(opts: {
    points: google.maps.LatLngLiteral[];
    radius?: number;
    gradient: string[];
    stops?: number[];
    opacity?: number;
  }) {
    this.points = opts.points;
    this.radius = opts.radius ?? 40;
    this.opacity = opts.opacity ?? 0.75;
    this.stops = opts.stops;
    this.palette = buildPalette(opts.gradient, opts.stops);

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;pointer-events:none;left:0;top:0;";
    this.canvas.style.opacity = String(this.opacity);

    const self = this;
    this.overlay = new google.maps.OverlayView();

    this.overlay.onAdd = function () {
      const panes = this.getPanes()!;
      panes.overlayLayer.appendChild(self.canvas);
    };

    this.overlay.draw = function () {
      const map = this.getMap() as google.maps.Map;
      self.draw(this.getProjection(), map);
    };

    this.overlay.onRemove = function () {
      self.canvas.parentNode?.removeChild(self.canvas);
    };
  }

  private draw(projection: google.maps.MapCanvasProjection, map: google.maps.Map) {
    if (!projection || !map) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest())!;
    const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast())!;
    if (!sw || !ne) return;

    const left = Math.round(Math.min(sw.x, ne.x));
    const top  = Math.round(Math.min(ne.y, sw.y));
    const width  = Math.round(Math.abs(ne.x - sw.x));
    const height = Math.round(Math.abs(sw.y - ne.y));

    if (width <= 0 || height <= 0) return;

    this.canvas.style.left = `${left}px`;
    this.canvas.style.top  = `${top}px`;
    this.canvas.width  = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    if (this.points.length === 0) return;

    // ── Step 1: Accumulate intensity with a true Gaussian, NO hard radius clip ──
    // Sigma = r * 0.45  →  search box = 1.8r so edge intensity ≈ exp(-16) ≈ 0
    // This completely eliminates the solid-circle ring artifact.
    const intensity = new Float32Array(width * height);
    const r   = this.radius;
    const r2  = r * r;
    // Gaussian sigma^2 expressed as a fraction of r^2: exp(-d2 / (r2 * SIGMA_FRAC))
    const SIGMA_FRAC  = 0.38;
    // Search box extends to where exp(-BOX_FRAC/SIGMA_FRAC) ≈ 0.001 (invisible)
    const BOX_FRAC    = 2.6;            // search radius = r * sqrt(BOX_FRAC) ≈ 1.61r
    const searchR     = Math.ceil(r * Math.sqrt(BOX_FRAC));
    const cutoff2     = r2 * BOX_FRAC;  // skip pixels beyond this distance^2

    for (const pt of this.points) {
      const px = projection.fromLatLngToDivPixel(new google.maps.LatLng(pt.lat, pt.lng));
      if (!px) continue;
      const cx = Math.round(px.x - left);
      const cy = Math.round(px.y - top);

      const x0 = Math.max(0, cx - searchR);
      const x1 = Math.min(width  - 1, cx + searchR);
      const y0 = Math.max(0, cy - searchR);
      const y1 = Math.min(height - 1, cy + searchR);

      for (let y = y0; y <= y1; y++) {
        const dy  = y - cy;
        const dy2 = dy * dy;
        if (dy2 > cutoff2) continue;
        const rowOffset = y * width;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const d2 = dx * dx + dy2;
          if (d2 > cutoff2) continue;
          // Pure Gaussian — fades smoothly to ~0 before we stop searching, no ring
          intensity[rowOffset + x] += Math.exp(-d2 / (r2 * SIGMA_FRAC));
        }
      }
    }

    // ── Step 2: Colorize — continuous alpha, no discontinuous offsets ─────────
    // Peak raw intensity for a single isolated point: exp(0) = 1.0
    // Typical range with cluster overlap: 1.0 – 4.0
    // We normalize so 3× overlap → 100% palette saturation.
    const PEAK = Math.max(1.0, this.points.length > 1 ? 2.8 : 1.0);
    const img  = ctx.createImageData(width, height);
    const d    = img.data;
    const p    = this.palette;

    for (let i = 0, j = 0; i < intensity.length; i++, j += 4) {
      const val = intensity[i];
      if (val < 0.004) continue; // below perception — skip entirely (no threshold ring)

      // norm ∈ [0,1]: smoothstep removes any kink at low values → seamless fade
      const norm = smoothstep(Math.min(1, val / PEAK));
      const idx  = Math.floor(norm * 255) * 4;

      d[j]     = p[idx];
      d[j + 1] = p[idx + 1];
      d[j + 2] = p[idx + 2];
      // Alpha: power < 1 brightens mid-range so glow is visible even at low density,
      // while still fading to true zero at the edges (no ring possible).
      d[j + 3] = Math.floor(Math.pow(norm, 0.65) * 215);
    }

    ctx.putImageData(img, 0, 0);
  }

  setMap(map: google.maps.Map | null) {
    this.overlay.setMap(map);
  }

  update(points: google.maps.LatLngLiteral[], gradient?: string[], stops?: number[]) {
    this.points = points;
    if (gradient) this.palette = buildPalette(gradient, stops ?? this.stops);
    const map = this.overlay.getMap() as google.maps.Map | null;
    if (map) this.draw(this.overlay.getProjection(), map);
  }
}

// ─── Gradient presets ─────────────────────────────────────────────────────────
// Exact mobile palette: blue → orange → red (matches marker icon colors)
// Per-type gradients use each marker's exact brand color at peak.

type HeatGrad = { colors: string[]; stops: number[] };

// Combined: matches mobile exactly — cool blue (low) → amber (mid) → crisis red (high)
// Colors intentionally match marker icons: rescue=#2BB3F2, food=#F2A325, medical=#F23B3B
const GRAD_COMBINED: HeatGrad = {
  colors: [
    "rgba(0,0,0,0)",
    "rgba(43,179,242,0.0)",   // #2BB3F2 fully transparent → start of visible range
    "#2BB3F2",                // rescue blue  — low density
    "#7DD4F0",                // blue-cyan bridge
    "#F2A325",                // food-water amber — mid density
    "#F27B25",                // amber-orange bridge
    "#F25A3B",                // orange-red
    "#F23B3B",                // medical red  — high density
  ],
  stops: [0, 0.04, 0.12, 0.28, 0.48, 0.65, 0.82, 1.0],
};

// Medical: transparent → soft rose → vivid red (exact marker color #F23B3B)
const GRAD_MEDICAL: HeatGrad = {
  colors: [
    "rgba(0,0,0,0)",
    "rgba(242,59,59,0.0)",
    "rgba(242,59,59,0.55)",
    "#F25555",
    "#F23B3B",
    "#D42E2E",
  ],
  stops: [0, 0.05, 0.22, 0.50, 0.78, 1.0],
};

// Food/water: transparent → warm amber → vivid orange (exact marker color #F2A325)
const GRAD_FOOD: HeatGrad = {
  colors: [
    "rgba(0,0,0,0)",
    "rgba(242,163,37,0.0)",
    "rgba(242,163,37,0.55)",
    "#F2B840",
    "#F2A325",
    "#D48C1A",
  ],
  stops: [0, 0.05, 0.22, 0.50, 0.78, 1.0],
};

// Rescue: transparent → sky blue → vivid cyan (exact marker color #2BB3F2)
const GRAD_RESCUE: HeatGrad = {
  colors: [
    "rgba(0,0,0,0)",
    "rgba(43,179,242,0.0)",
    "rgba(43,179,242,0.55)",
    "#4DC4F5",
    "#2BB3F2",
    "#1A96D4",
  ],
  stops: [0, 0.05, 0.22, 0.50, 0.78, 1.0],
};

// Volunteer: transparent → soft emerald → vivid green (matches volunteer marker #10b981)
const GRAD_VOL: HeatGrad = {
  colors: [
    "rgba(0,0,0,0)",
    "rgba(16,185,129,0.0)",
    "rgba(16,185,129,0.5)",
    "#34d399",
    "#10b981",
    "#059669",
  ],
  stops: [0, 0.05, 0.22, 0.50, 0.78, 1.0],
};

// ─── Marker icon helpers ──────────────────────────────────────────────────────
// Clean single-border style matching mobile exactly:
//   - Dark filled circle (#1E293B background)
//   - Single 2px border in the type's brand color
//   - White icon centred inside
//   - Small status dot top-right (green = unclaimed, grey = claimed)

function crisisMarkerIcon(type: CrisisType, claimed: boolean): google.maps.Icon {
  const COLORS: Record<string, string> = {
    medical:    "#F23B3B",
    food_water: "#F2A325",
    rescue:     "#2BB3F2",
  };
  const color = COLORS[type] || "#6b7280";

  // Lucide icon paths (viewBox 0 0 24 24) — white fill/stroke
  const ICONS: Record<string, string> = {
    medical: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="white" stroke="white" stroke-width="0.5"/><path d="M3.22 12H9.5l1.5-1.5 2 3 2-5 1.5 2.5h5.27" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    food_water: `<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" fill="white"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" fill="white"/>`,
    rescue:     `<path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="white"/>`,
  };
  const iconPath = ICONS[type] || `<circle cx="12" cy="12" r="8" fill="white"/>`;

  // Single compact circle — same size as mobile (38px total canvas, 17px radius)
  const size    = 38;
  const half    = size / 2;       // 19
  const rCircle = half - 2;       // 17 — the one and only circle
  const iconSize = 16;
  const iconOff  = half - iconSize / 2;

  // Status dot: green when unclaimed (QUEUED/ACTIVE), grey when claimed/resolved
  const dotColor  = claimed ? "#64748b" : "#22c55e";
  const dotR      = 4;
  const dotCx     = half + rCircle - dotR + 1;
  const dotCy     = half - rCircle + dotR - 1;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <g opacity='${claimed ? 0.55 : 1}'>
      <circle cx='${half}' cy='${half}' r='${rCircle}' fill='#1E293B' stroke='${color}' stroke-width='2.5'/>
      <g transform='translate(${iconOff},${iconOff})'>
        <svg viewBox='0 0 24 24' width='${iconSize}' height='${iconSize}'>${iconPath}</svg>
      </g>
      <circle cx='${dotCx}' cy='${dotCy}' r='${dotR}' fill='${dotColor}' stroke='#1E293B' stroke-width='2'/>
    </g>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(half, half),
  };
}

function volunteerMarkerIcon(email: string, unavailable: boolean): google.maps.Icon {
  const initials = email.split("@")[0].slice(0, 2).toUpperCase();
  const bg = unavailable ? "#94a3b8" : "#10b981";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><circle cx='18' cy='18' r='16' fill='${bg}' stroke='white' stroke-width='2.5'/><text x='18' y='23' font-family='sans-serif' font-size='12' font-weight='bold' fill='white' text-anchor='middle'>${initials}</text></svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) };
}

function myLocationIcon(): google.maps.Icon {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='14' fill='#3b82f6' fill-opacity='0.18'/><circle cx='12' cy='12' r='8' fill='#3b82f6' stroke='white' stroke-width='3'/></svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(24, 24), anchor: new google.maps.Point(12, 12) };
}

// ─── Cluster marker renderer (matches mobile: dark circle, red border, count) ─

const crisisClusterRenderer = {
  render({ count, position }: { count: number; position: google.maps.LatLng }): google.maps.Marker {
    const size   = count >= 100 ? 52 : count >= 10 ? 46 : 40;
    const half   = size / 2;
    const fsize  = count >= 100 ? 11 : 13;
    // Lucide "Users" icon path (viewBox 0 0 24 24), rendered at 12×12
    const userPath = "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
      <circle cx='${half}' cy='${half}' r='${half - 2}' fill='#1E293B' stroke='#F23B3B' stroke-width='2.5'/>
      <g transform='translate(${half - 6},${half - 11})'>
        <svg viewBox='0 0 24 24' width='12' height='12' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
          <path d='${userPath}'/>
        </svg>
      </g>
      <text x='${half}' y='${half + 10}' font-family='sans-serif' font-size='${fsize}' font-weight='700' fill='white' text-anchor='middle'>${count}</text>
    </svg>`;
    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor:     new google.maps.Point(half, half),
      },
      zIndex: 1000 + count,
    });
  },
};

function zoneMarkerIcon(type: string): google.maps.Icon {
  const bgs: Record<string, string> = { shelter: "#10b981", hospital: "#ef4444", staging: "#f59e0b" };
  const emojis: Record<string, string> = { shelter: "🏠", hospital: "🏥", staging: "🚩" };
  const bg = bgs[type] || "#10b981";
  const emoji = emojis[type] || "📍";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect x='2' y='2' width='28' height='28' rx='6' fill='${bg}' stroke='white' stroke-width='2.5'/><text x='16' y='22' font-size='14' text-anchor='middle'>${emoji}</text></svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) };
}

function pendingMarkerIcon(): google.maps.Icon {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='14' cy='14' r='11' fill='#8b5cf6' stroke='white' stroke-width='3'/><text x='14' y='19' font-size='13' text-anchor='middle' fill='white'>+</text></svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

function geoJsonToPath(geoJSON: any): google.maps.LatLngLiteral[] {
  try {
    return (geoJSON?.geometry?.coordinates as [number, number][] ?? []).map(([lng, lat]) => ({ lat, lng }));
  } catch { return []; }
}

const ZONE_LABELS: Record<string, string> = { shelter: "Shelter", hospital: "Hospital", staging: "Staging Area" };

// ─── Constants ────────────────────────────────────────────────────────────────

const mapContainerStyle = { width: "100%", height: "100%" };

// ─── Component ────────────────────────────────────────────────────────────────

const GoogleMapView = forwardRef<GoogleMapHandle, Props>((props, ref) => {
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: LIBRARIES });

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapTypeRef = useRef<"streets" | "satellite">(props.mapLayer);

  // Heatmap overlay refs
  const hmCombinedRef = useRef<HeatmapOverlay | null>(null);
  const hmMedRef      = useRef<HeatmapOverlay | null>(null);
  const hmFoodRef     = useRef<HeatmapOverlay | null>(null);
  const hmRescueRef   = useRef<HeatmapOverlay | null>(null);
  const hmVolRef      = useRef<HeatmapOverlay | null>(null);

  // My location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    panTo: (lat, lng, zoom) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat, lng });
        if (zoom !== undefined) mapInstanceRef.current.setZoom(zoom);
      }
    },
  }), []);

  // Continuous GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Sync map type
  useEffect(() => {
    mapTypeRef.current = props.mapLayer;
    mapInstanceRef.current?.setOptions({ mapTypeId: props.mapLayer === "satellite" ? "satellite" : "roadmap" });
  }, [props.mapLayer]);

  // ── Crisis heatmap — QUEUED requests only ─────────────────────────────────
  // Only unclaimed (QUEUED) requests show in the heatmap — claimed/resolved ones
  // already have a volunteer assigned so they don't need the urgency glow.
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    [hmCombinedRef, hmMedRef, hmFoodRef, hmRescueRef].forEach((r) => {
      r.current?.setMap(null);
      r.current = null;
    });

    // Filter to QUEUED only — matches mobile behaviour exactly
    const queuedRequests = props.heatmapRequests.filter((r) => r.status === "QUEUED");

    if (!props.showHeatmap || queuedRequests.length === 0) return;

    const map = mapInstanceRef.current;

    if (props.heatmapMode === "combined") {
      hmCombinedRef.current = new HeatmapOverlay({
        points:   queuedRequests.map((r) => ({ lat: r.lat, lng: r.lng })),
        gradient: GRAD_COMBINED.colors,
        stops:    GRAD_COMBINED.stops,
        // radius 80px at typical zoom — enough glow without smearing the whole map
        radius:  80,
        opacity: 0.62,
      });
      hmCombinedRef.current.setMap(map);
    } else {
      const groups: Record<string, google.maps.LatLngLiteral[]> = { medical: [], food_water: [], rescue: [] };
      for (const r of queuedRequests) groups[r.type]?.push({ lat: r.lat, lng: r.lng });

      if (groups.medical.length > 0) {
        hmMedRef.current = new HeatmapOverlay({ points: groups.medical, gradient: GRAD_MEDICAL.colors, stops: GRAD_MEDICAL.stops, radius: 80, opacity: 0.62 });
        hmMedRef.current.setMap(map);
      }
      if (groups.food_water.length > 0) {
        hmFoodRef.current = new HeatmapOverlay({ points: groups.food_water, gradient: GRAD_FOOD.colors, stops: GRAD_FOOD.stops, radius: 80, opacity: 0.62 });
        hmFoodRef.current.setMap(map);
      }
      if (groups.rescue.length > 0) {
        hmRescueRef.current = new HeatmapOverlay({ points: groups.rescue, gradient: GRAD_RESCUE.colors, stops: GRAD_RESCUE.stops, radius: 80, opacity: 0.62 });
        hmRescueRef.current.setMap(map);
      }
    }
  }, [mapLoaded, props.showHeatmap, props.heatmapMode, props.heatmapRequests]);

  // ── Volunteer heatmap ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    hmVolRef.current?.setMap(null);
    hmVolRef.current = null;

    if (!props.showVolunteerHeatmap) return;
    const pts = Object.values(props.volunteerPositions).map((v) => ({ lat: v.lat, lng: v.lng }));
    if (pts.length === 0) return;

    hmVolRef.current = new HeatmapOverlay({ points: pts, gradient: GRAD_VOL.colors, stops: GRAD_VOL.stops, radius: 50, opacity: 0.72 });
    hmVolRef.current.setMap(mapInstanceRef.current);
  }, [mapLoaded, props.showVolunteerHeatmap, props.volunteerPositions]);

  // Cleanup on unmount
  useEffect(() => () => {
    [hmCombinedRef, hmMedRef, hmFoodRef, hmRescueRef, hmVolRef].forEach((r) => r.current?.setMap(null));
  }, []);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapInstanceRef.current = map;
    setMapLoaded(true);
    map.setOptions({ mapTypeId: mapTypeRef.current === "satellite" ? "satellite" : "roadmap" });
  }, []);

  // Static initial values so GoogleMap doesn't snap back on drag or re-render
  const [initialCenter] = useState<{ lat: number; lng: number }>(() => {
    return props.volunteerLocation ?? { lat: 16, lng: 10 };
  });
  const [initialZoom] = useState<number>(() => {
    return props.volunteerLocation ? 14 : 2;
  });

  const hasCenteredInitial = useRef(false);

  // Center exactly once when user or volunteer location is first acquired
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    const loc = userLocation ?? props.volunteerLocation;
    if (loc && !hasCenteredInitial.current) {
      mapInstanceRef.current.panTo(loc);
      mapInstanceRef.current.setZoom(14);
      hasCenteredInitial.current = true;
    }
  }, [userLocation, props.volunteerLocation, mapLoaded]);

  // Build map options — disable individual controls instead of disableDefaultUI
  const mapOptions = useMemo(() => {
    const base = {
      clickableIcons: false,
      gestureHandling: "cooperative" as const,
      mapTypeId: props.mapLayer === "satellite" ? "satellite" : "roadmap",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      keyboardShortcuts: true,
      scrollwheel: false,
      disableDoubleClickZoom: true,
      // Explicitly enable these
      zoomControl: false,
      rotateControl: true,
    };
    if (typeof google === "undefined" || !google.maps) {
      return base;
    }
    return {
      ...base,
      rotateControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
    };
  }, [props.mapLayer]);

  const handleClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    props.onMapClick(e.latLng.lat(), e.latLng.lng());
  }, [props.onMapClick]);

  const goToMyLocation = useCallback(() => {
    const loc = userLocation ?? props.volunteerLocation;
    if (!loc || !mapInstanceRef.current) return;
    mapInstanceRef.current.panTo(loc);
    if (mapInstanceRef.current.getZoom() !== undefined && mapInstanceRef.current.getZoom()! < 14) {
      mapInstanceRef.current.setZoom(14);
    }
  }, [userLocation, props.volunteerLocation]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-destructive">Map failed to load</p>
          <p className="text-xs text-muted-foreground">Check your connection and try again</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Google Maps…</p>
        </div>
      </div>
    );
  }

  const hasLocation = !!(userLocation || props.volunteerLocation);

  return (
    <div className="relative h-full w-full min-h-0">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={initialCenter}
        zoom={initialZoom}
        onLoad={handleMapLoad}
        onClick={handleClick}
        options={mapOptions}
      >
        {/* Pending request pin */}
        {props.pendingCoords && (
          <Marker position={props.pendingCoords} icon={pendingMarkerIcon()} zIndex={200} />
        )}

        {/* Route polylines — visible to both volunteer (activeClaimedTask) and victim (showRoute) */}
        {(props.activeClaimedTask || props.showRoute) && props.routeAlternatives.map((route, idx) => {
          const isPrimary = idx === props.selectedRouteIdx;
          return (
            <Polyline
              key={`route-${idx}`}
              path={route.points}
              options={{
                strokeColor:   isPrimary ? "#2BB3F2" : "#94a3b8",
                strokeOpacity: isPrimary ? 0.95 : 0.55,
                strokeWeight:  isPrimary ? 6 : 4,
                zIndex:        isPrimary ? 10 : 5,
                clickable: !isPrimary,
                icons: isPrimary ? [] : [
                  {
                    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                    offset: "0",
                    repeat: "16px",
                  },
                ],
              }}
              onClick={() => props.onSelectRoute(idx)}
            />
          );
        })}

        {/* Safe zone markers */}
        {props.showZones && props.safeZones.map((zone) => (
          <Marker key={`zone-${zone.id}`} position={{ lat: zone.lat, lng: zone.lng }} icon={zoneMarkerIcon(zone.type)} zIndex={30} onClick={() => props.onZoneMarkerClick(zone)} />
        ))}

        {/* Zone popup */}
        {props.zonePopup && (
          <InfoWindow position={{ lat: props.zonePopup.lat, lng: props.zonePopup.lng }} onCloseClick={props.onCloseZonePopup} options={{ pixelOffset: new google.maps.Size(0, -20), disableAutoPan: true }}>
            <div style={{ minWidth: 180, padding: 4, fontFamily: "sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>{props.zonePopup.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, border: "1px solid #e2e8f0", color: "#64748b" }}>
                  {ZONE_LABELS[props.zonePopup.type] ?? props.zonePopup.type}
                </span>
              </div>
              {props.zonePopup.description && <p style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{props.zonePopup.description}</p>}
              <p style={{ fontSize: 9, color: "#94a3b8" }}>{props.zonePopup.lat.toFixed(4)}, {props.zonePopup.lng.toFixed(4)}</p>
              {props.authUser?.role === "admin" && (
                <button
                  type="button"
                  disabled={props.deletingZoneId === props.zonePopup.id}
                  onClick={() => props.onDeleteZone(props.zonePopup!.id)}
                  style={{ marginTop: 8, width: "100%", padding: "3px 0", fontSize: 11, fontWeight: 600, background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  {props.deletingZoneId === props.zonePopup.id ? "Removing…" : "Remove Zone"}
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {/* Volunteer markers */}
        {props.showVolunteers && (props.authUser?.role === "admin" || props.authUser?.role === "volunteer") &&
          Object.values(props.volunteerPositions)
            .filter((v) => v.email !== props.authUser?.email)
            .map((vol) => (
              <Marker
                key={`vol-${vol.email}`}
                position={{ lat: vol.lat, lng: vol.lng }}
                icon={volunteerMarkerIcon(vol.email, !!(vol as any)._unavailable)}
                zIndex={50}
                onClick={() => props.onVolunteerMarkerClick(vol)}
              />
            ))
        }

        {/* Volunteer self dot (on duty) */}
        {props.showVolunteers && props.volunteerLocation && props.authUser?.role === "volunteer" && props.isOnDuty && (
          <Marker position={props.volunteerLocation} icon={myLocationIcon()} zIndex={60} />
        )}

        {/* Volunteer popup */}
        {props.volunteerPopup && (
          <InfoWindow position={{ lat: props.volunteerPopup.lat, lng: props.volunteerPopup.lng }} onCloseClick={props.onCloseVolunteerPopup} options={{ pixelOffset: new google.maps.Size(0, -24), disableAutoPan: true }}>
            <div style={{ minWidth: 185, padding: 4, fontFamily: "sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: (props.volunteerPopup as any)._unavailable ? "#94a3b8" : "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                  {props.volunteerPopup.email.split("@")[0].slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#111", textTransform: "capitalize" }}>
                    {props.volunteerPopup.email.split("@")[0].replace(/[._]/g, " ")}
                  </p>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: (props.volunteerPopup as any)._unavailable ? "#f1f5f9" : "#d1fae5", color: (props.volunteerPopup as any)._unavailable ? "#64748b" : "#059669" }}>
                    {(props.volunteerPopup as any)._unavailable ? "Off Duty" : "On Duty"}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 9, color: "#94a3b8" }}>{props.volunteerPopup.lat.toFixed(4)}, {props.volunteerPopup.lng.toFixed(4)}</p>
              <p style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>Last seen: {formatTime(props.volunteerPopup.timestamp)}</p>
              {props.authUser?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current && props.volunteerPopup) {
                      mapInstanceRef.current.panTo({ lat: props.volunteerPopup.lat, lng: props.volunteerPopup.lng });
                    }
                    props.onCloseVolunteerPopup();
                  }}
                  style={{ marginTop: 6, width: "100%", padding: "3px 0", fontSize: 11, fontWeight: 600, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, cursor: "pointer", color: "#374151" }}
                >
                  Fly to
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {/* Crisis markers — always rendered alongside heatmap (matches mobile).
            The heatmap is a visual overlay; markers with their ring icons remain
            clickable and provide the interactive layer. */}
        {(() => {
          const markerRequests = props.filteredSortedRequests;

          return props.showClusters ? (
            <MarkerClustererF
              options={{ renderer: crisisClusterRenderer }}
              onClusterClick={(_evt, cluster) => {
                if (mapInstanceRef.current && cluster.bounds) {
                  mapInstanceRef.current.fitBounds(cluster.bounds);
                }
              }}
            >
              {(clusterer) => (
                <>
                  {markerRequests.map((request) => (
                    <Marker
                      key={request.id}
                      position={{ lat: request.lat, lng: request.lng }}
                      clusterer={clusterer}
                      icon={crisisMarkerIcon(request.type, request.claimed)}
                      zIndex={request.claimed ? 10 : 20}
                      onClick={() => { props.onMarkerClick(request); if (props.mode === "volunteer") props.openDetails(request.id); }}
                    />
                  ))}
                </>
              )}
            </MarkerClustererF>
          ) : (
            markerRequests.map((request) => (
              <Marker
                key={request.id}
                position={{ lat: request.lat, lng: request.lng }}
                icon={crisisMarkerIcon(request.type, request.claimed)}
                zIndex={request.claimed ? 10 : 20}
                onClick={() => { props.onMarkerClick(request); if (props.mode === "volunteer") props.openDetails(request.id); }}
              />
            ))
          );
        })()}

        {/* Crisis popup */}
        {props.popupRequest && (
          <InfoWindow position={{ lat: props.popupRequest.lat, lng: props.popupRequest.lng }} onCloseClick={props.onClosePopup} options={{ pixelOffset: new google.maps.Size(0, -14), disableAutoPan: true }}>
            <div style={{ minWidth: 180, padding: 4, fontFamily: "sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111", textTransform: "capitalize" }}>
                  {props.popupRequest.type === "food_water" ? "Food / Water" : props.popupRequest.type}
                </span>
                {props.popupRequest.claimed && (
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "#dbeafe", color: "#1d4ed8" }}>Claimed</span>
                )}
              </div>
              <p style={{ fontSize: 11, color: "#374151", marginBottom: 4, WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {props.popupRequest.description}
              </p>
              <p style={{ fontSize: 9, color: "#94a3b8" }}>{formatTime(props.popupRequest.createdAt)}</p>
              <p style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{props.popupRequest.lat.toFixed(4)}, {props.popupRequest.lng.toFixed(4)}</p>
              {/* Claim button for volunteers */}
              {props.onClaimRequest && !props.popupRequest.claimed && props.authUser?.role === "volunteer" && (
                <button
                  type="button"
                  disabled={props.claimingId === props.popupRequest.id}
                  onClick={() => props.onClaimRequest?.(props.popupRequest!.id)}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "5px 0",
                    fontSize: 11,
                    fontWeight: 600,
                    background: props.claimingId === props.popupRequest.id ? "#94a3b8" : "#10b981",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: props.claimingId === props.popupRequest.id ? "not-allowed" : "pointer",
                  }}
                >
                  {props.claimingId === props.popupRequest.id ? "Claiming..." : "Claim Task"}
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {/* My location blue dot */}
        {userLocation && !(props.authUser?.role === "volunteer" && props.isOnDuty && props.volunteerLocation) && (
          <Marker position={userLocation} icon={myLocationIcon()} zIndex={100} />
        )}
      </GoogleMap>

      {/* Zoom + My Location — stacked on right side */}
      <div className="absolute bottom-14 right-3 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() ?? 10) + 1)}
          title="Zoom in"
          className="flex h-9 w-9 items-center justify-center rounded-t-lg bg-white text-gray-700 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-colors hover:bg-gray-50 active:bg-gray-100"
          style={{ border: "1px solid rgba(0,0,0,0.12)", borderBottom: "none" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() ?? 10) - 1)}
          title="Zoom out"
          className="flex h-9 w-9 items-center justify-center rounded-b-lg bg-white text-gray-700 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-colors hover:bg-gray-50 active:bg-gray-100"
          style={{ border: "1px solid rgba(0,0,0,0.12)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        {hasLocation && (
          <button
            type="button"
            onClick={goToMyLocation}
            title="My location"
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-colors hover:bg-gray-50 active:bg-gray-100"
            style={{ border: "1px solid rgba(0,0,0,0.12)" }}
          >
            <Navigation className="h-5 w-5 text-blue-500" fill="#3b82f6" />
          </button>
        )}
      </div>

      {/* Pin-zone mode hint */}
      {props.pinZoneMode && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-4">
          <div className="rounded-full border border-emerald-500/60 bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-400 backdrop-blur">
            Click on the map to pin a safe zone
          </div>
        </div>
      )}
    </div>
  );
});

GoogleMapView.displayName = "GoogleMapView";
export default GoogleMapView;
