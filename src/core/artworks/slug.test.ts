import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugify("Night Daro Portrait")).toBe("night-daro-portrait");
  });

  it("strips accents and ñ diacritics", () => {
    expect(slugify("Noche de Neón y Ñandú")).toBe("noche-de-neon-y-nandu");
  });

  it("collapses symbols and trims leading and trailing separators", () => {
    expect(slugify("  ¡WIP #3 -- boceto!  ")).toBe("wip-3-boceto");
  });
});
