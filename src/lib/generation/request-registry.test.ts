import { describe, it, expect, beforeEach } from "vitest";
import {
  registerGeneration,
  isLatest,
  abortGeneration,
  abortAllGenerations,
  clearGeneration,
  __test_resetRegistry,
} from "./request-registry";

beforeEach(() => {
  __test_resetRegistry();
});

describe("registerGeneration", () => {
  it("first registration returns requestId=1", () => {
    const handle = registerGeneration("img-1");
    expect(handle.imageId).toBe("img-1");
    expect(handle.requestId).toBe(1);
    expect(handle.controller).toBeInstanceOf(AbortController);
    expect(handle.signal).toBe(handle.controller.signal);
    expect(handle.signal.aborted).toBe(false);
  });

  it("second registration for same imageId returns requestId=2 and aborts first", () => {
    const first = registerGeneration("img-1");
    const second = registerGeneration("img-1");
    expect(first.signal.aborted).toBe(true);
    expect(second.requestId).toBe(2);
    expect(second.signal.aborted).toBe(false);
  });

  it("different imageIds have independent counters", () => {
    const a = registerGeneration("img-a");
    const b = registerGeneration("img-b");
    const a2 = registerGeneration("img-a");
    expect(a.requestId).toBe(1);
    expect(b.requestId).toBe(1);
    expect(a2.requestId).toBe(2);
    expect(b.signal.aborted).toBe(false);
  });
});

describe("isLatest", () => {
  it("returns true for the most recent requestId", () => {
    const handle = registerGeneration("img-1");
    expect(isLatest("img-1", handle.requestId)).toBe(true);
  });

  it("returns false for a stale requestId after re-register", () => {
    const first = registerGeneration("img-1");
    registerGeneration("img-1");
    expect(isLatest("img-1", first.requestId)).toBe(false);
  });

  it("returns false for unknown imageId", () => {
    expect(isLatest("never-registered", 1)).toBe(false);
  });

  it("returns true for latest after multiple registrations", () => {
    registerGeneration("img-1");
    registerGeneration("img-1");
    const third = registerGeneration("img-1");
    expect(isLatest("img-1", third.requestId)).toBe(true);
    expect(isLatest("img-1", 1)).toBe(false);
    expect(isLatest("img-1", 2)).toBe(false);
  });
});

describe("abortGeneration", () => {
  it("aborts the current handle signal", () => {
    const handle = registerGeneration("img-1");
    expect(handle.signal.aborted).toBe(false);
    abortGeneration("img-1");
    expect(handle.signal.aborted).toBe(true);
  });

  it("is a no-op for unknown imageId (no throw)", () => {
    expect(() => abortGeneration("nonexistent")).not.toThrow();
  });

  it("isLatest still works after abortGeneration (handle not removed)", () => {
    const handle = registerGeneration("img-1");
    abortGeneration("img-1");
    expect(isLatest("img-1", handle.requestId)).toBe(true);
  });
});

describe("abortAllGenerations", () => {
  it("aborts every active handle", () => {
    const a = registerGeneration("img-a");
    const b = registerGeneration("img-b");
    const c = registerGeneration("img-c");
    abortAllGenerations();
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
    expect(c.signal.aborted).toBe(true);
  });

  it("is a no-op when no handles are active", () => {
    expect(() => abortAllGenerations()).not.toThrow();
  });
});

describe("clearGeneration", () => {
  it("removes the handle but preserves latestRequestId for isLatest", () => {
    const handle = registerGeneration("img-1");
    clearGeneration("img-1");
    expect(isLatest("img-1", handle.requestId)).toBe(true);
  });

  it("does not abort the signal on clear", () => {
    const handle = registerGeneration("img-1");
    clearGeneration("img-1");
    expect(handle.signal.aborted).toBe(false);
  });

  it("is a no-op for unknown imageId", () => {
    expect(() => clearGeneration("nonexistent")).not.toThrow();
  });

  it("after clear, re-registering increments counter correctly", () => {
    registerGeneration("img-1");
    clearGeneration("img-1");
    const second = registerGeneration("img-1");
    expect(second.requestId).toBe(2);
  });
});
