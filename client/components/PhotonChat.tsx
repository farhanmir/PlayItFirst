import { useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

export function PhotonChat({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const [text, setText] = useState("");

  return (
    <aside className="side-panel panel photon-panel">
      <div className="photon-head">
        <div>
          <p className="tag">Photon</p>
          <h3>Jamie · Café Manager</h3>
        </div>
      </div>
      <form
        className="photon-compose"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          conn?.send({ t: "photon_reply", body: text.trim() });
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="move alex to drinks and order more milk"
          aria-label="Message Jamie"
        />
        <button className="btn btn-small" type="submit">
          Send
        </button>
      </form>
      <div className="photon-thread">
        {snapshot.photon.length === 0 && (
          <p className="empty">AI employees message you here — problems, decisions, and floor updates.</p>
        )}
        {[...snapshot.photon].reverse().map((m) => (
          <div key={m.id} className={`bubble ${m.role === "Owner" ? "you" : "them"}`}>
            <strong>{m.from}</strong>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
