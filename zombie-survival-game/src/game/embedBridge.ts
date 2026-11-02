/**
 * Talking to a page that frames the game (the Jackie app's /zombie-survival page).
 *
 * Its Back, Restart and open-in-a-tab buttons tear this page down, and a save started while a
 * page unloads may never commit, so they ask for a save first and wait for the answer. The
 * protocol is two messages; the Jackie side lives in that app's `src/pages/ZombieSurvival.tsx`
 * and must use the same strings.
 */
export const EMBED_SAVE = "zombie-survival:save";
export const EMBED_SAVED = "zombie-survival:saved";

/**
 * What came of a save asked for on the way out. `nothing`: no run to save (title or death
 * screen). `hunted`/`busy`: the autosave's own rules said no, so the frame should ask before
 * the run is lost. `failed`: the browser refused to store it.
 */
export type ExitVerdict = { saved: boolean; reason: "nothing" | "hunted" | "busy" | "failed" | null };

type FrameEvent = Pick<MessageEvent, "data" | "origin" | "source">;
type Host = Pick<Window, "parent" | "location">;

/**
 * Answers one message if it is a save request from the page framing this one, on this origin.
 * Anything else is ignored: another origin could otherwise make the game write saves, and a
 * message from inside the game (or a top-level tab, whose parent is itself) is not a frame.
 */
export async function answerFrame(e: FrameEvent, host: Host, save: () => Promise<ExitVerdict>): Promise<boolean> {
  if (host.parent === (host as unknown) || e.source !== host.parent || e.origin !== host.location.origin) return false;
  const req = e.data as { type?: unknown; id?: unknown } | null;
  if (!req || req.type !== EMBED_SAVE) return false;
  const verdict = await save().catch((): ExitVerdict => ({ saved: false, reason: "failed" }));
  host.parent.postMessage({ type: EMBED_SAVED, id: req.id, ...verdict }, host.location.origin);
  return true;
}

/** Starts answering the framing page; returns the function that stops it. */
export function listenForFrame(win: Window, save: () => Promise<ExitVerdict>): () => void {
  const onMessage = (e: MessageEvent) => void answerFrame(e, win, save);
  win.addEventListener("message", onMessage);
  return () => win.removeEventListener("message", onMessage);
}
