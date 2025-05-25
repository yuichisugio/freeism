import { describe, expect, test } from "vitest";

describe("Vitest Setup Test", () => {
  test("should pass basic test", () => {
    expect(1 + 1).toBe(2);
  });

  test("should handle async operations", async () => {
    const result = await Promise.resolve("test");
    expect(result).toBe("test");
  });

  test("should work with objects", () => {
    const user = { id: 1, name: "Test User" };
    expect(user).toEqual({ id: 1, name: "Test User" });
    expect(user).toHaveProperty("name", "Test User");
  });

  test("should handle arrays", () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });
});
