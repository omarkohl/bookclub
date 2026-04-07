import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;
let aliceId: number;
let bobId: number;

test.beforeAll(async () => {
  server = await startServer({ port: 18400 });

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
  aliceId = participants.find((p: { name: string }) => p.name === "Alice").id;
  bobId = participants.find((p: { name: string }) => p.name === "Bob").id;

  // Both nominate
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

  const booksRes = await fetch(`${server.apiBase}/books`);
  const books = await booksRes.json();
  const dune = books.find((b: { title: string }) => b.title === "Dune");
  const neuro = books.find(
    (b: { title: string }) => b.title === "Neuromancer",
  );

  // Alice votes 80 credits
  await fetch(`${server.apiBase}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant_id: aliceId,
      votes: [
        { book_id: dune.id, credits: 50 },
        { book_id: neuro.id, credits: 30 },
      ],
    }),
  });

  // Bob votes 40 credits
  await fetch(`${server.apiBase}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant_id: bobId,
      votes: [{ book_id: dune.id, credits: 40 }],
    }),
  });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 5: Credit Budget Management", () => {
  test("admin changes budget, over-budget user's votes are cleared", async ({
    page,
  }) => {
    // Admin navigates to admin page
    await page.goto(server.adminUrl);

    // Verify current budget is shown
    await expect(page.getByText("Credit Budget:")).toBeVisible();
    await expect(page.getByText("100", { exact: true })).toBeVisible();

    // Enter new budget that's lower (50)
    await page.getByLabel("New credit budget").fill("50");
    await page.getByRole("button", { name: "Update" }).click();

    // Should see confirmation warning about affected users
    await expect(page.getByText("1 user")).toBeVisible();
    await expect(page.getByText("clear votes")).toBeVisible();

    // Confirm the change
    await page.getByRole("button", { name: "Confirm" }).click();

    // Wait for confirmation dialog to disappear — means PUT completed and votes were cleared
    await expect(
      page.getByRole("button", { name: "Confirm" }),
    ).not.toBeVisible();

    // Verify Alice's votes were cleared via API
    const aliceVotes = await fetch(
      `${server.apiBase}/votes?participant_id=${aliceId}`,
    );
    const aliceData = await aliceVotes.json();
    expect(aliceData).toHaveLength(0);

    // Verify Bob's votes are still there
    const bobVotes = await fetch(
      `${server.apiBase}/votes?participant_id=${bobId}`,
    );
    const bobData = await bobVotes.json();
    expect(bobData).toHaveLength(1);
  });

  test("no confirmation when no users affected", async ({ page }) => {
    // Budget is currently 50, raise to 200 (no one affected)
    await page.goto(server.adminUrl);
    await page.getByLabel("New credit budget").fill("200");
    await page.getByRole("button", { name: "Update" }).click();

    // Should not see confirmation, budget updates directly
    await expect(page.getByRole("button", { name: "Confirm" })).not.toBeVisible();
    await page.waitForFunction(
      () => document.body.textContent?.includes("200"),
    );
  });
});
