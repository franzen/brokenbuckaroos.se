import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deploymentPath, previewContent, startPreview, validSnapshot, type PreviewState } from "../../lib/preview";
import { snapshot, siteId } from "../fixtures/preview";

const primaryUrl = "https://website.test/repository/";
const url = () => new URL(`${primaryUrl}new/nested/?preview=share-token`);
const response = (data = snapshot()) => Response.json(data);
const cleanups: Array<() => void> = [];
function run(fetcher = vi.fn<typeof fetch>().mockResolvedValue(response()), address = url, resolve = vi.fn(async (next: ReturnType<typeof snapshot>) => next.translation.title), identity: string | ((signal: AbortSignal) => Promise<string>) = siteId) {
  const states: PreviewState<string>[] = [];
  const controller = startPreview({ cmsUrl: "https://cms.test", siteId: identity, primaryUrl, address, fetch: fetcher, resolve, onChange: (state) => states.push(state) });
  cleanups.push(controller.dispose);
  return { controller, states, fetcher, resolve, latest: () => states.at(-1)! };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); });

describe("deployment paths and snapshot validation", () => {
  it("handles root, project, homepage and trailing slashes without stripping language segments", () => {
    expect(deploymentPath(url(), primaryUrl)).toBe("/new/nested");
    expect(deploymentPath(new URL(primaryUrl), primaryUrl)).toBe("/");
    expect(deploymentPath(new URL("https://website.test/repository"), primaryUrl)).toBe("/");
    expect(deploymentPath(new URL("https://website.test/en/new/"), "https://website.test/")).toBe("/en/new");
    expect(deploymentPath(new URL("https://website.test/repository-other/new"), primaryUrl)).toBeNull();
    expect(deploymentPath(new URL("https://other.test/repository/new"), primaryUrl)).toBeNull();
  });
  it.each([
    { schemaVersion: 2 }, { siteId: "wrong" }, { pageId: "otherpage000001" }, { locale: "de" }, { targetPath: "/elsewhere" },
    { expiresAt: "invalid" }, { revision: -1 }, { page: { ...snapshot().page, site: "wrong" } },
    { translation: { ...snapshot().translation, page: "wrong" } },
    { translation: { ...snapshot().translation, locale: "en" } },
    { translation: { ...snapshot().translation, path: "/different" } },
    { translation: { ...snapshot().translation, blocks: { version: 1, items: [{ type: "image", data: null }] } } },
  ])("rejects malformed or mismatched snapshots: %j", (change) => {
    expect(validSnapshot({ ...snapshot(), ...change }, siteId, "/new/nested")).toBe(false);
  });
  it("adapts shared and translated data without fetching the unpublished page", () => {
    const next = snapshot();
    expect(validSnapshot(next, siteId, "/new/nested")).toBe(true);
    expect(previewContent(next)).toMatchObject({ kind: "page", title: "Draft page", pageData: next.page });
  });
});

describe("preview lifecycle", () => {
  it("resolves the known site before preview and reuses its id for polls", async () => {
    const identity = vi.fn(async () => siteId);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValue(new Response(null, { status: 204 }));
    const current = run(fetcher, undefined, undefined, identity);
    await vi.advanceTimersByTimeAsync(1000);
    expect(identity).toHaveBeenCalledTimes(1);
    expect(String(current.fetcher.mock.calls[0][0])).toBe(`https://cms.test/api/cms/preview?site=${siteId}`);
    expect(String(current.fetcher.mock.calls[1][0])).toContain(`site=${siteId}&revision=1`);
    expect(current.latest().view).toBe("Draft page");
  });
  it("retries a failed site lookup before fetching any preview content", async () => {
    const identity = vi.fn(async () => siteId).mockRejectedValueOnce(new Error("offline"));
    const current = run(undefined, undefined, undefined, identity);
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest()).toMatchObject({ status: "disconnected", view: null });
    expect(current.fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(identity).toHaveBeenCalledTimes(2);
    expect(current.latest().view).toBe("Draft page");
  });
  it("does not overlap site lookup or use a late result after navigation", async () => {
    let finish!: (id: string) => void;
    let address = url();
    const identity = vi.fn((signal: AbortSignal) => { expect(signal.aborted).toBe(false); return new Promise<string>((resolve) => { finish = resolve; }); });
    const current = run(undefined, () => address, undefined, identity);
    await vi.advanceTimersByTimeAsync(3000);
    expect(identity).toHaveBeenCalledTimes(1);
    expect(current.fetcher).not.toHaveBeenCalled();
    address = new URL(`${primaryUrl}other`);
    expect(current.controller.check()).toBe(false);
    expect(identity.mock.calls[0][0].aborted).toBe(true);
    finish(siteId);
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest()).toMatchObject({ status: "ended", view: null });
    expect(current.fetcher).not.toHaveBeenCalled();
  });
  it("rejects a preview for a different site than the key resolved", async () => {
    const current = run(undefined, undefined, undefined, async () => "anothersite0001");
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest()).toMatchObject({ status: "mismatch", view: null });
    expect(current.resolve).not.toHaveBeenCalled();
  });
  it("uses only the header for the token and conditionally polls without rerendering a 204", async () => {
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValue(new Response(null, { status: 204 })));
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest().view).toBe("Draft page");
    const [address, init] = current.fetcher.mock.calls[0];
    expect(String(address)).toBe(`https://cms.test/api/cms/preview?site=${siteId}`);
    expect(init).toMatchObject({ headers: { "X-CMS-Preview": "share-token" }, cache: "no-store", credentials: "omit" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(String(current.fetcher.mock.calls[1][0])).toContain("revision=1");
    expect(current.resolve).toHaveBeenCalledTimes(1);
    expect(current.latest().status).toBe("connected");
    expect(current.states).toHaveLength(2);
  });
  it("updates changed revisions", async () => {
    const first = snapshot();
    const second = { ...first, revision: 2, translation: { ...first.translation, title: "Edited draft" } };
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(response(first)).mockResolvedValue(response(second)));
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest().view).toBe("Edited draft");
    expect(current.resolve).toHaveBeenCalledTimes(2);
  });
  it("does not overlap delayed requests", async () => {
    let finish!: (response: Response) => void;
    const current = run(vi.fn<typeof fetch>().mockImplementation(() => new Promise((resolve) => { finish = resolve; })));
    await vi.advanceTimersByTimeAsync(3000);
    expect(current.fetcher).toHaveBeenCalledTimes(1);
    finish(response());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(current.fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(current.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([404, 410])("clears content and stops on API %s", async (status) => {
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValue(new Response(null, { status })));
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest()).toMatchObject({ status: status === 410 ? "expired" : "unavailable", view: null });
    await vi.advanceTimersByTimeAsync(5000);
    expect(current.fetcher).toHaveBeenCalledTimes(2);
  });
  it("retries an initial network error without resolving published content", async () => {
    const current = run(vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response()));
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest()).toMatchObject({ status: "disconnected", view: null });
    expect(current.resolve).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest().status).toBe("connected");
  });
  it.each(["offline", "unchanged", "hung"])("expires independently of %s polls and rejects late results", async (mode) => {
    const next = snapshot({ expiresAt: new Date(Date.now() + 2500).toISOString() });
    let finish!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(next));
    if (mode === "offline") fetcher.mockRejectedValue(new Error("offline"));
    else if (mode === "unchanged") fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    else fetcher.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const current = run(fetcher);
    await vi.advanceTimersByTimeAsync(1000);
    if (mode === "offline") expect(current.latest().view).toBe("Draft page");
    const signal = fetcher.mock.calls.at(-1)?.[1]?.signal;
    await vi.advanceTimersByTimeAsync(1500);
    expect(current.latest()).toMatchObject({ status: "expired", view: null });
    if (mode === "hung") {
      expect(signal?.aborted).toBe(true);
      finish(response({ ...next, revision: 2 }));
      await vi.advanceTimersByTimeAsync(0);
      expect(current.latest().view).toBeNull();
    }
  });
  it("checks expiry on resume even when the deadline timer has not run", async () => {
    const current = run();
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(new Date(Date.now() + 3600001));
    expect(current.controller.check()).toBe(false);
    expect(current.latest().view).toBeNull();
  });
  it("expires while public layout resolution is still in flight", async () => {
    const first = snapshot({ expiresAt: new Date(Date.now() + 500).toISOString() });
    let finish!: (view: string) => void;
    const resolver = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const current = run(vi.fn<typeof fetch>().mockResolvedValue(response(first)), url, resolver);
    await vi.advanceTimersByTimeAsync(500);
    expect(current.latest()).toMatchObject({ status: "expired", view: null });
    finish("Late layout");
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest().view).toBeNull();
  });
  it("does not resolve a snapshot whose deadline has already passed", async () => {
    const current = run(vi.fn<typeof fetch>().mockResolvedValue(response(snapshot({ expiresAt: new Date(Date.now() - 1).toISOString() }))));
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest()).toMatchObject({ status: "expired", view: null });
    expect(current.resolve).not.toHaveBeenCalled();
  });
  it("recovers from an unexpected initial 204 with a fresh read", async () => {
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValue(response()));
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest()).toMatchObject({ status: "disconnected", view: null });
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest().view).toBe("Draft page");
    expect(String(current.fetcher.mock.calls[1][0])).not.toContain("revision=");
  });
  it("rejects attempts to extend the fixed expiry", async () => {
    const first = snapshot();
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(response(first)).mockResolvedValue(response({ ...first, revision: 2, expiresAt: new Date(Date.now() + 7200000).toISOString() })));
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest()).toMatchObject({ status: "mismatch", view: null });
  });
  it("retries public layout loading after an accepted snapshot and a 204", async () => {
    const resolver = vi.fn(async (next: ReturnType<typeof snapshot>) => next.translation.title).mockRejectedValueOnce(new Error("public API offline"));
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValue(new Response(null, { status: 204 })), url, resolver);
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest().view).toBe("Draft page");
  });
  it("stops when the route changes or the token is replaced", async () => {
    let address = url();
    const current = run(undefined, () => address);
    await vi.advanceTimersByTimeAsync(0);
    address = new URL(`${primaryUrl}elsewhere`);
    expect(current.controller.check()).toBe(false);
    expect(current.latest()).toMatchObject({ status: "ended", view: null });
  });
  it("cancels before startup without issuing a request", async () => {
    const current = run();
    current.controller.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(current.fetcher).not.toHaveBeenCalled();
  });
  it("keeps empty preview parameters in preview mode", async () => {
    const current = run(undefined, () => new URL(`${primaryUrl}new/nested?preview=`));
    await vi.advanceTimersByTimeAsync(0);
    expect(current.latest()).toMatchObject({ status: "mismatch", view: null });
    expect(current.fetcher).not.toHaveBeenCalled();
  });
  it("clears a previously rendered snapshot on an identity mismatch", async () => {
    const current = run(vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValue(response(snapshot({ siteId: "wrong-site" }))));
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.latest()).toMatchObject({ status: "mismatch", view: null });
  });
  it("reports missing configuration without attempting a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const states: PreviewState<string>[] = [];
    const current = startPreview({ cmsUrl: "", siteId, primaryUrl, address: url, fetch: fetcher, resolve: async () => "draft", onChange: (next) => states.push(next) });
    cleanups.push(current.dispose);
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)?.status).toBe("configuration-error");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
