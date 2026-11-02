import { describe, expect, it } from "vitest";
import { answerFrame, EMBED_SAVE, EMBED_SAVED, type ExitVerdict } from "./embedBridge";

function framed(origin = "https://app.example") {
  const posted: { msg: unknown; target: string }[] = [];
  const parent = { postMessage: (msg: unknown, target: string) => posted.push({ msg, target }) };
  const host = { parent, location: { origin } } as unknown as Window;
  return { host, parent, posted };
}

const saved = async (): Promise<ExitVerdict> => ({ saved: true, reason: null });

describe("answering the page that frames the game", () => {
  it("saves when the framing page asks, and answers with the request's id", async () => {
    const { host, parent, posted } = framed();
    let calls = 0;
    const handled = await answerFrame({ data: { type: EMBED_SAVE, id: 7 }, origin: "https://app.example", source: parent as unknown as Window }, host, async () => {
      calls++;
      return { saved: true, reason: null };
    });
    expect(handled).toBe(true);
    expect(calls).toBe(1);
    expect(posted).toEqual([{ msg: { type: EMBED_SAVED, id: 7, saved: true, reason: null }, target: "https://app.example" }]);
  });

  it("passes on why it didn't save, so the frame can ask before the run is lost", async () => {
    const { host, parent, posted } = framed();
    await answerFrame({ data: { type: EMBED_SAVE, id: 1 }, origin: "https://app.example", source: parent as unknown as Window }, host, async () => ({ saved: false, reason: "hunted" }));
    expect(posted[0].msg).toMatchObject({ saved: false, reason: "hunted" });
  });

  it("reports a save that threw as failed instead of never answering", async () => {
    const { host, parent, posted } = framed();
    await answerFrame({ data: { type: EMBED_SAVE, id: 2 }, origin: "https://app.example", source: parent as unknown as Window }, host, async () => {
      throw new Error("quota");
    });
    expect(posted[0].msg).toMatchObject({ saved: false, reason: "failed" });
  });

  it("ignores requests from another origin, which could otherwise make the game write saves", async () => {
    const { host, parent, posted } = framed();
    const handled = await answerFrame({ data: { type: EMBED_SAVE, id: 3 }, origin: "https://evil.example", source: parent as unknown as Window }, host, saved);
    expect(handled).toBe(false);
    expect(posted).toEqual([]);
  });

  it("ignores messages that don't come from the framing page or aren't save requests", async () => {
    const { host, parent, posted } = framed();
    expect(await answerFrame({ data: { type: EMBED_SAVE }, origin: "https://app.example", source: null }, host, saved)).toBe(false);
    expect(await answerFrame({ data: { type: "something-else" }, origin: "https://app.example", source: parent as unknown as Window }, host, saved)).toBe(false);
    expect(await answerFrame({ data: null, origin: "https://app.example", source: parent as unknown as Window }, host, saved)).toBe(false);
    expect(posted).toEqual([]);
  });

  it("does nothing in its own tab, where the parent is the page itself", async () => {
    const self = { location: { origin: "https://app.example" }, postMessage: () => {} } as unknown as Window & { parent: Window };
    (self as { parent: Window }).parent = self;
    expect(await answerFrame({ data: { type: EMBED_SAVE }, origin: "https://app.example", source: self }, self, saved)).toBe(false);
  });
});
