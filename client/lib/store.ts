import { create } from "zustand";
import type { FurnitureKind, PropertyListing, RoomSnapshot } from "../../shared/types";
import type { Conn, ConnStatus } from "./net";
import { detectDevice, type DeviceKind } from "./device";

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
  device: DeviceKind | null;
  /** Catalog selection for click-to-place on the café floor (build mode). */
  buildKind: FurnitureKind | null;
  set: (partial: Partial<AppState>) => void;
}

const uaMobile =
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

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
  mobile: uaMobile,
  device: null,
  buildKind: null,
  set: (partial) => set(partial),
}));

if (typeof window !== "undefined") {
  void detectDevice().then((device) => {
    useApp.getState().set({ device, mobile: device === "phone" || uaMobile });
  });
}
