import { describe, expect, it } from "vitest";
import { formatPhone, isPlausiblePhone, normalizeEmail, normalizePhone } from "./normalize";

describe("normalizePhone", () => {
  it("treats Ghanaian national numbers as +233", () => {
    expect(normalizePhone("024 412 3456")).toBe("+233244123456");
    expect(normalizePhone("0244-123-456")).toBe("+233244123456");
  });
  it("keeps explicit international prefixes", () => {
    expect(normalizePhone("+44 20 7946 0000")).toBe("+442079460000");
    expect(normalizePhone("0044 20 7946 0000")).toBe("+442079460000");
    expect(normalizePhone("+234 803 555 1234")).toBe("+2348035551234");
  });
  it("accepts country code without plus", () => {
    expect(normalizePhone("233244123456")).toBe("+233244123456");
  });
  it("matches the same number written differently", () => {
    expect(normalizePhone("0244 555 012")).toBe(normalizePhone("+233 24 455 5012"));
  });
  it("returns empty for no digits", () => {
    expect(normalizePhone("  ")).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("isPlausiblePhone", () => {
  it("accepts valid Ghanaian and international numbers", () => {
    expect(isPlausiblePhone("024 412 3456")).toBe(true);
    expect(isPlausiblePhone("+233 24 412 3456")).toBe(true);
    expect(isPlausiblePhone("+44 20 7946 0000")).toBe(true);
  });
  it("rejects malformed numbers", () => {
    expect(isPlausiblePhone("024 412")).toBe(false);
    expect(isPlausiblePhone("+233 24 412 34567")).toBe(false);
    expect(isPlausiblePhone("call me")).toBe(false);
  });
});

describe("normalizeEmail / formatPhone", () => {
  it("lower-cases and trims", () => expect(normalizeEmail("  A.B@Example.COM ")).toBe("a.b@example.com"));
  it("formats Ghanaian numbers consistently", () => expect(formatPhone("0244123456")).toBe("+233 24 412 3456"));
});
