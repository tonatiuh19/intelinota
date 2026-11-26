import { describe, it, expect } from "vitest";
import searchReducer, { setQuery, instantSearch } from "./searchSlice";
import newsletterReducer, { subscribeNewsletter } from "./newsletterSlice";

const article = (id: number) => ({ id, slug: `s${id}`, title: `t${id}` }) as any;

describe("searchSlice", () => {
  it("ignores stale responses (race: older query resolves last)", () => {
    let s = searchReducer(undefined, setQuery("react"));
    s = searchReducer(s, {
      type: instantSearch.fulfilled.type,
      payload: [article(1)],
      meta: { arg: "rea" },
    });
    expect(s.results).toEqual([]);
    s = searchReducer(s, {
      type: instantSearch.fulfilled.type,
      payload: [article(2)],
      meta: { arg: "react" },
    });
    expect(s.results).toHaveLength(1);
  });
  it("aborted requests do not set an error", () => {
    let s = searchReducer(undefined, setQuery("x"));
    s = searchReducer(s, { type: instantSearch.rejected.type, meta: { arg: "x", aborted: true } });
    expect(s.error).toBeNull();
  });
  it("clearing the query clears results", () => {
    let s = searchReducer(undefined, setQuery("react"));
    s = searchReducer(s, { type: instantSearch.fulfilled.type, payload: [article(1)], meta: { arg: "react" } });
    s = searchReducer(s, setQuery("  "));
    expect(s.results).toEqual([]);
  });
});

describe("newsletterSlice", () => {
  it("tracks which form instance submitted", () => {
    let s = newsletterReducer(undefined, {
      type: subscribeNewsletter.pending.type,
      meta: { arg: { email: "a@b.co", source: "footer" } },
    });
    expect(s.source).toBe("footer");
    s = newsletterReducer(s, { type: subscribeNewsletter.fulfilled.type, payload: "ok" });
    expect(s.status).toBe("succeeded");
  });
});
