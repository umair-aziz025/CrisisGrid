import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Loader2, MapPin, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "crisisgrid_recent_searches";
const MAX_RECENT  = 5;

type RecentEntry = { label: string; center: [number, number] };
type Suggestion  = google.maps.places.AutocompleteSuggestion;

type Props = {
  onSelect: (center: [number, number], placeName: string) => void;
};

function loadRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch { /* storage may be unavailable */ }
}

function pushRecent(entry: RecentEntry) {
  const prev = loadRecent().filter((r) => r.label !== entry.label);
  saveRecent([entry, ...prev]);
}

function newSessionToken() {
  return new google.maps.places.AutocompleteSessionToken();
}

export default function PlacesSearch({ onSelect }: Props) {
  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent,      setRecent]      = useState<RecentEntry[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [showDropdown,setShowDropdown]= useState(false);
  const [focused,     setFocused]     = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const getSession = useCallback(() => {
    if (!sessionRef.current) sessionRef.current = newSessionToken();
    return sessionRef.current;
  }, []);

  // Load recent searches on mount
  useEffect(() => { setRecent(loadRecent()); }, []);

  // Show recent searches when focused with empty input
  useEffect(() => {
    if (focused && !query.trim()) {
      setShowDropdown(recent.length > 0);
    }
  }, [focused, query, recent]);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(recent.length > 0 && focused);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            sessionToken: getSession(),
          });
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
      }
    }, 380);
  }, [focused, recent.length, getSession]);

  const commitSelect = useCallback((center: [number, number], label: string) => {
    setQuery(label);
    setShowDropdown(false);
    setSuggestions([]);
    sessionRef.current = null; // fresh session after billable call
    pushRecent({ label, center });
    setRecent(loadRecent());
    onSelect(center, label);
  }, [onSelect]);

  const handleSuggestionSelect = useCallback(async (s: Suggestion) => {
    const pred = s.placePrediction;
    if (!pred) return;
    const label = pred.text.toString();
    setQuery(label);
    setShowDropdown(false);
    setSuggestions([]);
    sessionRef.current = null;
    try {
      const place = pred.toPlace();
      await place.fetchFields({ fields: ["location"] });
      if (place.location) {
        commitSelect([place.location.lng(), place.location.lat()], label);
      }
    } catch { /* silent */ }
  }, [commitSelect]);

  const handleRecentSelect = useCallback((entry: RecentEntry) => {
    commitSelect(entry.center, entry.label);
  }, [commitSelect]);

  const handleClearRecent = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(STORAGE_KEY);
    setRecent([]);
    setShowDropdown(false);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setShowDropdown(recent.length > 0 && focused);
    setIsLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [recent.length, focused]);

  const showingRecent = !query.trim() && recent.length > 0;
  const showingSuggestions = !!query.trim() && suggestions.length > 0 && !isLoading;

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (!query.trim()) setShowDropdown(recent.length > 0);
            else if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => { setFocused(false); setShowDropdown(false); }, 160)}
          placeholder="Search places, cities, countries..."
          className="border-border/70 bg-background/90 pl-9 pr-8 shadow-lg backdrop-blur"
          data-testid="input-geocode-search"
          autoComplete="off"
        />
        {(query || isLoading) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            data-testid="button-geocode-clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-1 flex items-center gap-2 rounded-md border border-border/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Searching…</span>
        </div>
      )}

      {/* Dropdown — recent searches or live predictions */}
      {showDropdown && !isLoading && (showingRecent || showingSuggestions) && (
        <div
          className="mt-1 overflow-hidden rounded-md border border-border/70 bg-background/95 shadow-lg backdrop-blur"
          data-testid="geocode-results"
        >
          {/* Recent searches section */}
          {showingRecent && (
            <>
              <div className="flex items-center justify-between border-b border-border/30 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent searches
                </span>
                <button
                  type="button"
                  onMouseDown={handleClearRecent}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-destructive"
                  title="Clear history"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
              {recent.map((entry, idx) => (
                <button
                  key={`recent-${idx}`}
                  type="button"
                  onMouseDown={() => handleRecentSelect(entry)}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                  data-testid={`geocode-result-${idx}`}
                >
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="truncate text-xs text-foreground">{entry.label}</span>
                </button>
              ))}
            </>
          )}

          {/* Live Google Places predictions */}
          {showingSuggestions && suggestions.map((s, idx) => {
            const pred      = s.placePrediction;
            const main      = pred?.mainText?.toString()      ?? "";
            const secondary = pred?.secondaryText?.toString() ?? "";
            return (
              <button
                key={pred?.placeId ?? idx}
                type="button"
                onMouseDown={() => handleSuggestionSelect(s)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                data-testid={`geocode-result-${idx}`}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{main}</p>
                  {secondary && (
                    <p className="truncate text-[10px] text-muted-foreground">{secondary}</p>
                  )}
                </div>
              </button>
            );
          })}

          {/* Google branding (required by Places API ToS) */}
          <div className="flex items-center justify-end border-t border-border/40 px-3 py-1.5">
            <span className="text-[9px] text-muted-foreground/60">powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}
