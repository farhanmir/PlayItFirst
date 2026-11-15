/** One messaging consumer per process. Unknown configuration fails closed. */
export function photonMessagingTransport(): "bounded-inbox" | "webhook" | "disabled" {
  const value = process.env.PHOTON_MESSAGING_TRANSPORT?.trim() || "bounded-inbox";
  return value === "bounded-inbox" || value === "webhook" ? value : "disabled";
}
