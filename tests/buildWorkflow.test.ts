import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("deprecated Electron build workflow", () => {
  it("runs validation for relevant pull requests while keeping manual dispatch", () => {
    const workflow = readFileSync(".github/workflows/build.yml", "utf8");
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/paths:/);
    expect(workflow).toContain('"src/**"');
    expect(workflow).toContain('"tests/**"');
  });
});