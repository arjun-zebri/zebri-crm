import { describe, it, expect } from "vitest";

import {
  GridConfig,
  minutesFromGridStart,
  bandGeometry,
  layoutOverlaps,
} from "@/lib/calendar/grid-layout";

describe("grid-layout", () => {
  const cfg: GridConfig = {
    startHour: 6,
    endHour: 18,
    pxPerMinute: 2,
    timeZone: 'UTC',
  };

  // dayStart: 2026-08-20 00:00:00 UTC = epoch 1724092800000
  const dayStart = new Date("2026-08-20T00:00:00Z");

  describe("minutesFromGridStart", () => {
    it("returns 0 for midnight (start of the day)", () => {
      const midnight = new Date("2026-08-20T00:00:00Z");
      // Expected: 0 minutes from midnight
      expect(minutesFromGridStart(midnight, dayStart, 'UTC')).toBe(0);
    });

    it("returns 360 for 06:00 (6am)", () => {
      const sixAm = new Date("2026-08-20T06:00:00Z");
      // Expected: 6 * 60 = 360 minutes
      expect(minutesFromGridStart(sixAm, dayStart, 'UTC')).toBe(360);
    });

    it("returns 540 for 09:00 (9am)", () => {
      const nineAm = new Date("2026-08-20T09:00:00Z");
      // Expected: 9 * 60 = 540 minutes
      expect(minutesFromGridStart(nineAm, dayStart, 'UTC')).toBe(540);
    });

    it("returns 1080 for 18:00 (6pm, grid end)", () => {
      const sixPm = new Date("2026-08-20T18:00:00Z");
      // Expected: 18 * 60 = 1080 minutes
      expect(minutesFromGridStart(sixPm, dayStart, 'UTC')).toBe(1080);
    });

    it("handles time after midnight on the same day", () => {
      const twoAm = new Date("2026-08-20T02:00:00Z");
      // Expected: 2 * 60 = 120 minutes
      expect(minutesFromGridStart(twoAm, dayStart, 'UTC')).toBe(120);
    });
  });

  describe("bandGeometry", () => {
    it("returns geometry for interval fully inside the window", () => {
      // 09:00-10:00 is fully inside 6am-6pm grid
      // Start: 540 minutes from midnight = 180 minutes from grid start
      // Duration: 60 minutes
      // Expected topPx: 180 * 2 = 360
      // Expected heightPx: 60 * 2 = 120
      const interval = {
        start: "2026-08-20T09:00:00Z",
        end: "2026-08-20T10:00:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).not.toBeNull();
      expect(result?.topPx).toBe(360);
      expect(result?.heightPx).toBe(120);
    });

    it("returns null for interval entirely before grid start", () => {
      // 04:00-05:00 is entirely before 6am grid
      const interval = {
        start: "2026-08-20T04:00:00Z",
        end: "2026-08-20T05:00:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).toBeNull();
    });

    it("returns null for interval entirely after grid end", () => {
      // 20:00-21:00 is entirely after 6pm grid
      const interval = {
        start: "2026-08-20T20:00:00Z",
        end: "2026-08-20T21:00:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).toBeNull();
    });

    it("clamps interval straddling top edge", () => {
      // 05:00-09:00 straddles the 6am (360 min) start
      // Visible part: 06:00-09:00 = 180 minutes
      // Expected topPx: 0 (clamped to top)
      // Expected heightPx: 180 * 2 = 360
      const interval = {
        start: "2026-08-20T05:00:00Z",
        end: "2026-08-20T09:00:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).not.toBeNull();
      expect(result?.topPx).toBe(0);
      expect(result?.heightPx).toBe(360);
    });

    it("clamps interval straddling bottom edge", () => {
      // 16:00-20:00 straddles the 6pm (1080 min) end
      // Grid starts at 6am = 360 min from midnight
      // 16:00 = 960 minutes from midnight
      // Grid-relative start: (960 - 360) * 2 = 600 * 2 = 1200px
      // Visible part: 16:00-18:00 = 120 minutes = 240px
      // Expected topPx: 1200
      // Expected heightPx: 240
      const interval = {
        start: "2026-08-20T16:00:00Z",
        end: "2026-08-20T20:00:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).not.toBeNull();
      expect(result?.topPx).toBe(1200);
      expect(result?.heightPx).toBe(240);
    });

    it("clamps and enforces minimum height for 15-minute interval at 9am", () => {
      // 09:00-09:15 is 15 minutes = 30px (with pxPerMinute 2)
      // Minimum height should apply if it's less than the minimum
      // Let's assume MIN_HEIGHT_PX = 44 (from event-day-calendar)
      // Expected topPx: 360
      // Expected heightPx: >= 44
      const interval = {
        start: "2026-08-20T09:00:00Z",
        end: "2026-08-20T09:15:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).not.toBeNull();
      expect(result?.topPx).toBe(360);
      expect(result!.heightPx).toBeGreaterThanOrEqual(44);
    });

    it("enforces minimum height without extending past grid bottom", () => {
      // 17:55-18:00 is 5 minutes = 10px (with pxPerMinute 2)
      // Should get minimum height, but not extend past grid bottom
      // Grid ends at 18:00 = 720 minutes from grid start = 1440px
      // This interval starts at 17:55 = 715 minutes from grid start = 1430px
      // Minimum is 44px, so it would extend to 1474px if unclamped
      // But we should NOT extend past grid bottom, so it should be clamped
      // Expected: topPx 1430, heightPx at most to reach 1440px = 10px (no minimum enforcement if it breaks the grid)
      const interval = {
        start: "2026-08-20T17:55:00Z",
        end: "2026-08-20T18:00:00Z",
      };
      const result = bandGeometry(interval, dayStart, cfg);
      expect(result).not.toBeNull();
      expect(result?.topPx).toBe(1430);
      expect(result?.heightPx).toBe(10); // No minimum enforcement if it breaks the grid bottom
    });
  });

  describe("layoutOverlaps", () => {
    it("returns empty array for empty input", () => {
      const result = layoutOverlaps([]);
      expect(result).toEqual([]);
    });

    it("returns single item with col 0 and totalCols 1 for single item", () => {
      const items = [{ start: "2026-08-20T09:00:00Z", end: "2026-08-20T10:00:00Z", id: "a" }];
      const result = layoutOverlaps(items);
      expect(result).toHaveLength(1);
      expect(result[0]!.col).toBe(0);
      expect(result[0]!.totalCols).toBe(1);
      expect(result[0]!.item.id).toBe("a");
    });

    it("assigns col 0 and 1 to two overlapping items", () => {
      // Both start at 09:00, first ends 10:00, second ends 11:00
      const items = [
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T10:00:00Z", id: "a" },
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T11:00:00Z", id: "b" },
      ];
      const result = layoutOverlaps(items);
      expect(result).toHaveLength(2);
      const byId = new Map(result.map((r) => [r.item.id, r]));
      expect(byId.get("a")!.col).toBe(0);
      expect(byId.get("a")!.totalCols).toBe(2);
      expect(byId.get("b")!.col).toBe(1);
      expect(byId.get("b")!.totalCols).toBe(2);
    });

    it("assigns totalCols 1 to each non-overlapping item", () => {
      // First item 09:00-10:00, second item 10:00-11:00 (touching, not overlapping)
      const items = [
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T10:00:00Z", id: "a" },
        { start: "2026-08-20T10:00:00Z", end: "2026-08-20T11:00:00Z", id: "b" },
      ];
      const result = layoutOverlaps(items);
      expect(result).toHaveLength(2);
      const byId = new Map(result.map((r) => [r.item.id, r]));
      expect(byId.get("a")!.totalCols).toBe(1);
      expect(byId.get("b")!.totalCols).toBe(1);
    });

    it("handles three items where only two overlap", () => {
      // A: 09:00-10:00
      // B: 09:30-10:30 (overlaps with A)
      // C: 11:00-12:00 (does not overlap with A or B)
      const items = [
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T10:00:00Z", id: "a" },
        { start: "2026-08-20T09:30:00Z", end: "2026-08-20T10:30:00Z", id: "b" },
        { start: "2026-08-20T11:00:00Z", end: "2026-08-20T12:00:00Z", id: "c" },
      ];
      const result = layoutOverlaps(items);
      expect(result).toHaveLength(3);
      const byId = new Map(result.map((r) => [r.item.id, r]));
      expect(byId.get("a")!.totalCols).toBe(2);
      expect(byId.get("b")!.totalCols).toBe(2);
      expect(byId.get("c")!.totalCols).toBe(1);
    });

    it("preserves item order in result", () => {
      const items = [
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T10:00:00Z", id: "a" },
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T11:00:00Z", id: "b" },
      ];
      const result = layoutOverlaps(items);
      expect(result[0]!.item.id).toBe("a");
      expect(result[1]!.item.id).toBe("b");
    });

    it("handles complex overlapping: 4 items with 3 overlapping", () => {
      // A: 09:00-10:00
      // B: 09:30-10:30 (overlaps A)
      // C: 10:00-11:00 (touches A, overlaps B)
      // D: 11:00-12:00 (no overlap)
      // A and C touch but do not overlap (A ends exactly when C starts).
      // So A, B, C form a group but only need 2 columns: A and C share col 0, B is col 1.
      const items = [
        { start: "2026-08-20T09:00:00Z", end: "2026-08-20T10:00:00Z", id: "a" },
        { start: "2026-08-20T09:30:00Z", end: "2026-08-20T10:30:00Z", id: "b" },
        { start: "2026-08-20T10:00:00Z", end: "2026-08-20T11:00:00Z", id: "c" },
        { start: "2026-08-20T11:00:00Z", end: "2026-08-20T12:00:00Z", id: "d" },
      ];
      const result = layoutOverlaps(items);
      const byId = new Map(result.map((r) => [r.item.id, r]));
      expect(byId.get("a")!.totalCols).toBe(2);
      expect(byId.get("b")!.totalCols).toBe(2);
      expect(byId.get("c")!.totalCols).toBe(2);
      expect(byId.get("d")!.totalCols).toBe(1);
    });
  });
});
