import type { CafeFeedback, FeedbackTopic } from "../../shared/types";

const LABELS: Record<FeedbackTopic, string> = {
  seating: "Seating",
  decor: "Decor",
  queue: "Queue",
  staff: "Staff",
  stock: "Stock",
  layout: "Layout",
  vibe: "Vibe",
};

/** What Grok-driven customers noticed about the café, most discussed first. */
export function CustomerFeedback({ feedback, limit = 4 }: { feedback?: CafeFeedback; limit?: number }) {
  const rows = (Object.entries(feedback ?? {}) as [FeedbackTopic, NonNullable<CafeFeedback[FeedbackTopic]>][])
    .filter(([, t]) => t.liked + t.disliked > 0)
    .sort(([, a], [, b]) => b.liked + b.disliked - (a.liked + a.disliked))
    .slice(0, limit);
  if (!rows.length) return null;
  return (
    <section className="customer-feedback" aria-label="What customers noticed">
      <p className="tag">What customers noticed · Grok</p>
      <ul>
        {rows.map(([topic, t]) => (
          <li key={topic} className={t.disliked > t.liked ? "bad" : "ok"}>
            <strong>{LABELS[topic]}</strong>
            <span>
              {t.liked > 0 ? `${t.liked} liked` : ""}
              {t.liked > 0 && t.disliked > 0 ? " · " : ""}
              {t.disliked > 0 ? `${t.disliked} unhappy` : ""}
            </span>
            {t.last ? <em>“{t.last}”</em> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
