import type { PlayerRole, RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";

const ROLES: { id: PlayerRole; title: string; blurb: string }[] = [
  { id: "owner", title: "Owner", blurb: "Strategy, director choices, Photon" },
  { id: "barista", title: "Barista", blurb: "Brew drinks at the machine" },
  { id: "cashier", title: "Cashier", blurb: "Take orders at the counter" },
  { id: "manager", title: "Manager", blurb: "Restock, collect, keep flow" },
];

export function RolePicker({ snapshot }: { snapshot: RoomSnapshot }) {
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);
  if (!me || snapshot.phase === "lobby") return null;

  return (
    <div className="role-strip panel">
      <span className="tag">Your role</span>
      <div className="role-chips">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            className={me.role === role.id ? "active" : ""}
            title={role.blurb}
            onClick={() => {
              play("ui", 0.2);
              // Soft client label — server treats all as interactive operators for the hackathon.
              useApp.getState().set({
                snapshot: {
                  ...snapshot,
                  players: snapshot.players.map((p) => (p.id === you ? { ...p, role: role.id } : p)),
                },
              });
            }}
          >
            {role.title}
          </button>
        ))}
      </div>
    </div>
  );
}
