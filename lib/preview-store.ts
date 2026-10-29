// Browser-only storage for the frontend preview (preferences and itinerary drafts).
// Nothing here reaches a server, and none of it is a booking. Replace with server
// state once guest accounts exist (Phase 3+).
import { useCallback, useSyncExternalStore } from "react";

import { EMPTY_ITINERARY, parseItinerary } from "@/lib/itinerary";
import { parsePreferences } from "@/lib/preferences";
import type { GuestPreferences, ItineraryDraft } from "@/lib/types/guest";

const PREFIX = "luxe-eco:preview:";

type StoreDefinition<T> = {
  key: string;
  initial: T;
  parse: (raw: unknown) => T | null;
};

export const preferencesStore: StoreDefinition<GuestPreferences | null> = {
  key: `${PREFIX}preferences:v1`,
  initial: null,
  parse: parsePreferences,
};

export const itineraryStore: StoreDefinition<ItineraryDraft> = {
  key: `${PREFIX}itinerary:v1`,
  initial: EMPTY_ITINERARY,
  parse: parseItinerary,
};

// Falls back to memory when storage is blocked (private mode, disabled site data).
const memory = new Map<string, string>();
let storageUnavailable = false;
const listeners = new Set<() => void>();
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string) {
  if (!storageUnavailable) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      storageUnavailable = true;
    }
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, raw: string | null) {
  if (!storageUnavailable) {
    try {
      if (raw === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, raw);
      return;
    } catch {
      storageUnavailable = true;
    }
  }
  if (raw === null) memory.delete(key);
  else memory.set(key, raw);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function readSnapshot<T>(store: StoreDefinition<T>): T {
  const raw = readRaw(store.key);
  const cached = snapshots.get(store.key);
  if (cached && cached.raw === raw) return cached.value as T;

  let value = store.initial;
  if (raw) {
    try {
      value = store.parse(JSON.parse(raw)) ?? store.initial;
    } catch {
      value = store.initial;
    }
  }
  snapshots.set(store.key, { raw, value });
  return value;
}

/**
 * Returns `undefined` until the browser value has been read (server render and
 * hydration), so callers can show a loading state instead of a wrong default.
 */
export function usePreviewStore<T>(store: StoreDefinition<T>) {
  const value = useSyncExternalStore<T | undefined>(
    subscribe,
    () => readSnapshot(store),
    () => undefined,
  );

  const setValue = useCallback(
    (next: T) => {
      writeRaw(store.key, next === null ? null : JSON.stringify(next));
      listeners.forEach((listener) => listener());
    },
    [store],
  );

  return [value, setValue] as const;
}
