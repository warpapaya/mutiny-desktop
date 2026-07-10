import { describe, expect, it } from "vitest";

import { configDefaults, configSchema } from "../src/native/configSchema";

describe("desktop config contract", () => {
  it("persists the hosted startMinimisedToTray key", () => {
    expect(configSchema.startMinimisedToTray.type).toBe("boolean");
    expect(configDefaults.startMinimisedToTray).toBe(false);
  });
});
