import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer();
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 1: Participants & Identity Selection", () => {
  test("admin adds and removes participants", async ({ page }) => {
    await page.goto(server.adminUrl);

    // Should see admin page
    await expect(
      page.getByRole("heading", { name: "Book Club Admin" }),
    ).toBeVisible();
    await expect(page.getByText("No participants yet")).toBeVisible();

    // Add Alice
    await page.getByLabel("Participant name").fill("Alice");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Alice")).toBeVisible();

    // Add Bob
    await page.getByLabel("Participant name").fill("Bob");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Bob")).toBeVisible();

    // Should show both participants
    const items = page.getByRole("listitem");
    await expect(items).toHaveCount(2);

    // Remove Alice
    await page.getByRole("button", { name: "Remove Alice" }).click();
    await expect(items).toHaveCount(1);
    await expect(page.getByText("Alice")).not.toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
  });

  test("admin cannot add duplicate participant", async ({ page }) => {
    await page.goto(server.adminUrl);

    // Bob already exists from previous test — add Charlie, then duplicate
    await page.getByLabel("Participant name").fill("Charlie");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Charlie")).toBeVisible();

    await page.getByLabel("Participant name").fill("Charlie");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("participant already exists")).toBeVisible();
  });

  test("user picks their name from participant list", async ({ page }) => {
    await page.goto(server.clubUrl);

    // Should see participant picker
    await expect(
      page.getByRole("heading", { name: "Who are you?" }),
    ).toBeVisible();

    // Pick Bob
    await page.getByRole("button", { name: "Bob" }).click();
    await expect(page.getByText("Welcome, Bob!")).toBeVisible();

    // Refresh — should persist selection
    await page.reload();
    await expect(page.getByText("Welcome, Bob!")).toBeVisible();

    // Switch user
    await page.getByRole("button", { name: "Switch user" }).click();
    await expect(
      page.getByRole("heading", { name: "Who are you?" }),
    ).toBeVisible();
  });

  test("user sees empty state when no participants exist", async ({ page }) => {
    // Start a fresh server with no participants
    const fresh = await startServer({ port: 18090 });
    try {
      await page.goto(fresh.clubUrl);
      await expect(
        page.getByText("No participants have been added yet"),
      ).toBeVisible();
    } finally {
      fresh.cleanup();
    }
  });
});
