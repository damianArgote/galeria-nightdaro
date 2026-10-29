import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function restrictedImportErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports");
}

describe("src/core import boundaries", () => {
  it.each([
    'import { NextResponse } from "next/server";',
    'import Link from "next/link";',
    'import { useState } from "react";',
    'import { eq } from "drizzle-orm";',
    'import { pgTable } from "drizzle-orm/pg-core";',
  ])("rejects %s inside src/core", async (code) => {
    const errors = await restrictedImportErrors(`${code}\n`, "src/core/artworks/artwork.ts");
    expect(errors).toHaveLength(1);
  });

  it("allows the same imports outside src/core", async () => {
    const errors = await restrictedImportErrors(
      'import { eq } from "drizzle-orm";\n',
      "src/infra/artworks/drizzle-artwork-repository.ts",
    );
    expect(errors).toHaveLength(0);
  });
});
