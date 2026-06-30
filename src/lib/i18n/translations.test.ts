import { describe, it, expect } from "vitest";
import { translate, translations, LANGUAGES } from "./translations";

describe("translate", () => {
  it("returns the English string when lang is 'en'", () => {
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
  });

  it("returns the Korean string when lang is 'ko'", () => {
    expect(translate("ko", "nav.dashboard")).toBe("대시보드");
  });

  it("falls back to English when a key is missing in Korean", () => {
    // Inject a key only present in English for this test
    translations.en["__test.fallback"] = "Fallback Value";
    expect(translate("ko", "__test.fallback")).toBe("Fallback Value");
    delete translations.en["__test.fallback"];
  });

  it("falls back to the key itself when unknown in both languages", () => {
    expect(translate("en", "totally.unknown.key")).toBe("totally.unknown.key");
    expect(translate("ko", "totally.unknown.key")).toBe("totally.unknown.key");
  });

  it("keeps Korean translations in sync with English keys", () => {
    const enKeys = Object.keys(translations.en).sort();
    const koKeys = Object.keys(translations.ko).sort();
    expect(koKeys).toEqual(enKeys);
  });

  it("exports the supported language list", () => {
    expect(LANGUAGES).toEqual(["en", "ko"]);
  });
});
