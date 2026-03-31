import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer({ port: 18500 });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 6: Admin Participant & Book Management", () => {
  test("admin removes participant — cascades nomination and votes", async ({
    page,
  }) => {
    const adminApi = server.adminApiBase;

    // Setup via API: add participants
    await fetch(`${adminApi}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice" }),
    });
    await fetch(`${adminApi}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob" }),
    });

    const res = await fetch(`${server.apiBase}/participants`);
    const participants = await res.json();
    const aliceId = participants.find(
      (p: { name: string }) => p.name === "Alice",
    ).id;
    const bobId = participants.find(
      (p: { name: string }) => p.name === "Bob",
    ).id;

    // Both nominate books
    await fetch(`${server.apiBase}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Dune",
        authors: "Frank Herbert",
        participant_id: aliceId,
      }),
    });
    await fetch(`${server.apiBase}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Neuromancer",
        authors: "William Gibson",
        participant_id: bobId,
      }),
    });

    // Bob votes on Alice's book
    const booksRes = await fetch(`${server.apiBase}/books`);
    const books = await booksRes.json();
    const duneId = books.find(
      (b: { title: string }) => b.title === "Dune",
    ).id;

    await fetch(`${server.apiBase}/votes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: bobId,
        votes: [{ book_id: duneId, credits: 25 }],
      }),
    });

    // Admin removes Alice via UI
    await page.goto(server.adminUrl);
    await expect(
      page.getByRole("button", { name: "Delete Alice" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete Alice" }).click();

    // Alice should disappear from participant list
    await expect(
      page.getByRole("button", { name: "Delete Alice" }),
    ).not.toBeVisible();
    // Bob should still be there
    await expect(
      page.getByRole("button", { name: "Delete Bob" }),
    ).toBeVisible();

    // Alice's nomination (Dune) should move to backlog
    const nominatedSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Nominated Books" }),
    });
    await expect(nominatedSection.getByText("Dune")).not.toBeVisible();
    // Bob's nomination should still be there
    await expect(nominatedSection.getByText("Neuromancer")).toBeVisible();

    // Dune should now appear in the backlog
    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });
    await expect(backlogSection.getByText("Dune")).toBeVisible();

    // Bob's votes on Dune should be cleared — verify via user page
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Bob" }).click();

    // Bob should have full credits remaining (votes on deleted book were cleared)
    await expect(page.getByText("Remaining: 100")).toBeVisible();
  });
});
