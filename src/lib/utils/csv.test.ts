import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(escapeCsvCell('Osu Bakery, "Main"')).toBe('"Osu Bakery, ""Main"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises formula injection but keeps phone numbers", () => {
    expect(escapeCsvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeCsvCell("+233 24 412 3456")).toBe("+233 24 412 3456");
  });
  it("round-trips through parseCsv", () => {
    const csv = toCsv(["Name", "Note"], [["Ama", 'Said "hi", then left'], ["Kofi", "two\nlines"]]);
    expect(parseCsv(csv)).toEqual([["Name", "Note"], ["Ama", 'Said "hi", then left'], ["Kofi", "two\nlines"]]);
  });
  it("strips BOM and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("throws on an unclosed quote", () => {
    expect(() => parseCsv('a,b\n"oops,2')).toThrow();
  });
});
