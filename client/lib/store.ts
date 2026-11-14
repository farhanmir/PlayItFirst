import { create } from "zustand";
import type { PropertyListing, RoomSnapshot } from "../../shared/types";
import type { Conn, ConnStatus } from "./net";

interface AppState {
  screen: "landing" | "property" | "game";
  name: string;
  roomCode: string;
  you: string | null;
  snapshot: RoomSnapshot | null;
  properties: PropertyListing[];
  qrSvg: string | null;
  joinUrl: string | null;
  blueprint: string | null;
  conn: Conn | null;
  status: ConnStatus;
  mobile: boolean;
  set: (partial: Partial<AppState>) => void;
}

export const useApp = create<AppState>((set) => ({
  screen: "landing",
  name: "",
  roomCode: "",
  you: null,
  snapshot: null,
  properties: [],
  qrSvg: null,
  joinUrl: null,
  blueprint: null,
  conn: null,
  status: "closed",
  mobile: typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  set: (partial) => set(partial),
}));
