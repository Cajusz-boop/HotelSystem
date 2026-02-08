"use client";

import { createContext, useContext, useRef } from "react";
import { createStore, useStore } from "zustand";
import type { Reservation } from "@/lib/tape-chart-types";

const MAX_HISTORY = 5;

interface TapeChartState {
  reservations: Reservation[];
  past: Reservation[][];
  future: Reservation[][];
}

interface TapeChartActions {
  setReservations: (next: Reservation[] | ((prev: Reservation[]) => Reservation[])) => void;
  hydrate: (reservations: Reservation[]) => void;
  undo: () => void;
  redo: () => void;
  resetToInitial: (initial: Reservation[]) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export type TapeChartStore = TapeChartState & TapeChartActions;

export function createTapeChartStore(initialReservations: Reservation[] = []) {
  return createStore<TapeChartStore>((set, get) => ({
    reservations: initialReservations,
    past: [],
    future: [],

    setReservations: (next) => {
      set((state) => {
        const current = state.reservations;
        const nextList = typeof next === "function" ? next(current) : next;
        if (nextList === current) return state;
        const newPast = [...state.past.slice(-(MAX_HISTORY - 1)), current];
        return {
          reservations: nextList,
          past: newPast,
          future: [],
        };
      });
    },

    hydrate: (reservations) => {
      set({ reservations, past: [], future: [] });
    },

    undo: () => {
      set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);
        const newFuture = [state.reservations, ...state.future];
        return {
          reservations: previous,
          past: newPast,
          future: newFuture,
        };
      });
    },

    redo: () => {
      set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        const newPast = [...state.past, state.reservations];
        return {
          reservations: next,
          past: newPast,
          future: newFuture,
        };
      });
    },

    resetToInitial: (initial) => {
      set({
        reservations: initial,
        past: [],
        future: [],
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  }));
}

type TapeChartStoreApi = ReturnType<typeof createTapeChartStore>;

const TapeChartStoreContext = createContext<TapeChartStoreApi | null>(null);

export function TapeChartStoreProvider({
  reservations,
  children,
}: {
  reservations: Reservation[];
  children: React.ReactNode;
}) {
  const storeRef = useRef<TapeChartStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createTapeChartStore(reservations);
  }
  return (
    <TapeChartStoreContext.Provider value={storeRef.current}>
      {children}
    </TapeChartStoreContext.Provider>
  );
}

export function useTapeChartStore<T>(selector: (state: TapeChartStore) => T): T {
  const store = useContext(TapeChartStoreContext);
  if (!store) {
    throw new Error("useTapeChartStore must be used within TapeChartStoreProvider");
  }
  return useStore(store, selector);
}
