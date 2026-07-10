import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/streamdeck/mutiny-control.ps1", "utf8");

describe("Stream Deck PowerShell helper", () => {
  it("avoids syntax introduced after Windows PowerShell 5.1", () => {
    const powerShell7OnlyOperators = ["?.", "??", "??=", "&&", "||"];

    for (const operator of powerShell7OnlyOperators) {
      expect(script, `PowerShell 7-only operator: ${operator}`).not.toContain(operator);
    }
  });

  it("preserves HTTP status extraction for error responses", () => {
    expect(script).toContain("$_.Exception.Response");
    expect(script).toContain(".StatusCode");
    expect(script).toContain(".value__");
    expect(script).toContain('Write-Warning "Mutiny returned HTTP $code for /$Command"');
  });
});
