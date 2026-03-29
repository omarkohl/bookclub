import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer({ port: 18300 });

  // Setup: create participants and nominations
  const adminApi = server.adminApiBase;
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
  const alice = participants.find((p: { name: string }) => p.name === "Alice");
  const bob = participants.find((p: { name: string }) => p.name === "Bob");

  // Both nominate books
  await fetch(`${server.apiBase}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Dune",
      authors: "Frank Herbert",
      participant_id: alice.id,
    }),
  });
  await fetch(`${server.apiBase}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Neuromancer",
      authors: "William Gibson",
      participant_id: bob.id,
    }),
  });

  // Alice votes
  const booksRes = await fetch(`${server.apiBase}/books`);
  const books = await booksRes.json();
  const dune = books.find((b: { title: string }) => b.title === "Dune");
  const neuro = books.find(
    (b: { title: string }) => b.title === "Neuromancer",
  );

  await fetch(`${server.apiBase}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant_id: alice.id,
      votes: [
        { book_id: dune.id, credits: 25 },
        { book_id: neuro.id, credits: 9 },
      ],
    }),
  });

  // Bob votes
  await fetch(`${server.apiBase}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant_id: bob.id,
      votes: [
        { book_id: dune.id, credits: 4 },
        { book_id: neuro.id, credits: 36 },
      ],
    }),
  });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 4: Voting State & Results", () => {
  test("admin toggles voting state and user sees results", async ({
    page,
  }) => {
    // Admin reveals results
    await page.goto(server.adminUrl);
    await expect(
      page.getByRole("button", { name: "Reveal Results" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reveal Results" }).click();
    await expect(
      page.getByRole("button", { name: "Reopen Voting" }),
    ).toBeVisible();

    // User sees scores (not vote inputs)
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    // Should see "Results" heading, not "Vote"
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();

    // Should see scores (one per book)
    await expect(page.getByText("score").first()).toBeVisible();

    // Should NOT see remaining credits or Save Votes button
    await expect(page.getByTestId("remaining-credits")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Votes" }),
    ).not.toBeVisible();

    // Nomination section should be hidden
    await expect(
      page.getByRole("heading", { name: "Your Nomination" }),
    ).not.toBeVisible();
  });

  test("nominations are frozen when results revealed", async ({ page }) => {
    // Try to nominate via API — should be rejected
    const res = await fetch(`${server.apiBase}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Forbidden Book",
        authors: "Nobody",
        participant_id: 1,
      }),
    });
    expect(res.status).toBe(409);
  });

  test("voting is locked when results revealed", async () => {
    // Try to vote via API — should be rejected
    const res = await fetch(`${server.apiBase}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: 1,
        votes: [{ book_id: 1, credits: 10 }],
      }),
    });
    expect(res.status).toBe(409);
  });

  test("admin reopens voting and user can vote again", async ({ page }) => {
    // Admin reopens
    await page.goto(server.adminUrl);
    await page.getByRole("button", { name: "Reopen Voting" }).click();
    await expect(
      page.getByRole("button", { name: "Reveal Results" }),
    ).toBeVisible();

    // User can now see vote inputs
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    await expect(page.getByRole("heading", { name: "Vote" })).toBeVisible();
    await expect(page.getByTestId("remaining-credits")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Votes" }),
    ).toBeVisible();

    // Nomination section should be visible again
    await expect(
      page.getByRole("heading", { name: "Your Nomination" }),
    ).toBeVisible();
  });
});
