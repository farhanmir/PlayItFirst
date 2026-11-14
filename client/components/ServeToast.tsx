import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { play } from "../lib/audio";

/** Floating feedback when someone serves a drink or Jamie helps. */
export function ServeToast({ snapshot }: { snapshot: RoomSnapshot }) {
  const [toast, setToast] = useState<string | null>(null);
  const lastServed = useRef(snapshot.metrics.customersServed);
  const lastLog = useRef(snapshot.eventLog[0]);

  useEffect(() => {
    const served = snapshot.metrics.customersServed;
    if (served > lastServed.current) {
      const delta = served - lastServed.current;
      lastServed.current = served;
      setToast(delta > 1 ? `+${delta} served` : "Customer served");
      play("coin", 0.25);
      const id = window.setTimeout(() => setToast(null), 1400);
      return () => clearTimeout(id);
    }
    lastServed.current = served;
  }, [snapshot.metrics.customersServed]);

  useEffect(() => {
    const head = snapshot.eventLog[0];
    if (!head || head === lastLog.current) return;
    lastLog.current = head;
    if (/Jamie \(AI\).*served/i.test(head)) {
      setToast("Jamie cleared a ticket");
      const id = window.setTimeout(() => setToast(null), 1400);
      return () => clearTimeout(id);
    }
  }, [snapshot.eventLog[0]]);

  if (!toast) return null;
  return (
    <div className="serve-toast" role="status" aria-live="polite">
      {toast}
    </div>
  );
}
