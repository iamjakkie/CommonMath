import { describe, expect, it } from "vitest";
import { responseIsCurrent } from "../src/engine/revision";

describe("responseIsCurrent", () => {
  it("accepts only the latest request id and input revision", () => {
    expect(responseIsCurrent({ id: "2", revision: 4 }, { id: "2", revision: 4 })).toBe(true);
    expect(responseIsCurrent({ id: "1", revision: 4 }, { id: "2", revision: 4 })).toBe(false);
    expect(responseIsCurrent({ id: "2", revision: 3 }, { id: "2", revision: 4 })).toBe(false);
  });
});
