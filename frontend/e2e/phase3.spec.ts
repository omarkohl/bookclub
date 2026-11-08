import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer({ port: 18200 });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 3: Quadratic Voting", () => {
  test("user distributes credits and sees remaining update", async ({
    page,
  }) => {
    // Setup: admin adds participants
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

    // Get participant IDs
    const participantsRes = await fetch(`${server.apiBase}/participants`);
    const participants = await participantsRes.json();
    const alice = participants.find(
      (p: { name: string }) => p.name === "Alice",
    );
    const bob = participants.find((p: { name: string }) => p.name === "Bob");

    // Alice and Bob nominate books via API
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

    // User flow: Alice picks identity
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    // Should see voting section with remaining credits
    await expect(page.getByTestId("remaining-credits")).toHaveText("100");

    // Allocate credits to Dune
    const duneInput = page.getByLabel("Credits for Dune");
    await duneInput.fill("16");
    await expect(page.getByTestId("remaining-credits")).toHaveText("84");

    // Allocate credits to Neuromancer
    const neuroInput = page.getByLabel("Credits for Neuromancer");
    await neuroInput.fill("9");
    await expect(page.getByTestId("remaining-credits")).toHaveText("75");

    // Save votes
    await page.getByRole("button", { name: "Save Votes" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // Reload and verify votes persist
    await page.reload();
    await expect(page.getByTestId("remaining-credits")).toHaveText("75");
    await expect(page.getByLabel("Credits for Dune")).toHaveValue("16");
    await expect(page.getByLabel("Credits for Neuromancer")).toHaveValue("9");
  });

  test("voting rejects over-budget allocation", async ({ page }) => {
    // Use the already-set-up server from previous test (Alice is still there)
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    // Try to allocate more than budget
    await page.getByLabel("Credits for Dune").fill("60");
    await page.getByLabel("Credits for Neuromancer").fill("50");

    // Remaining should show negative
    await expect(page.getByTestId("remaining-credits")).toHaveText("-10");

    // Save button should be disabled
    await expect(
      page.getByRole("button", { name: "Save Votes" }),
    ).toBeDisabled();
  });

  test("credits of a deleted nomination can be spent again", async ({
    page,
  }) => {
    const srv = await startServer({ port: 18201 });
    try {
      const nominate = async (name: string, title: string) => {
        const res = await fetch(`${srv.adminApiBase}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const { id } = await res.json();
        await fetch(`${srv.apiBase}/books`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, authors: "X", participant_id: id }),
        });
      };
      await nominate("Carol", "Dune");
      await nominate("Dave", "Solaris");

      await page.goto(srv.clubUrl);
      await page.getByRole("button", { name: "Carol" }).click();
      await page.getByLabel("Credits for Dune").fill("50");
      await page.getByLabel("Credits for Solaris").fill("50");
      await page.getByRole("button", { name: "Save Votes" }).click();
      await expect(page.getByText("Saved")).toBeVisible();

      // Deleting the nomination frees its credits without a page reload.
      page.on("dialog", (d) => void d.accept());
      await page.getByRole("button", { name: "Delete nomination" }).click();
      await expect(page.getByLabel("Credits for Dune")).not.toBeVisible();
      await expect(page.getByTestId("remaining-credits")).toHaveText("50");

      await page.getByLabel("Credits for Solaris").fill("100");
      await expect(page.getByTestId("remaining-credits")).toHaveText("0");
      await page.getByRole("button", { name: "Save Votes" }).click();
      await expect(page.getByText("Saved")).toBeVisible();

      await page.reload();
      await expect(page.getByLabel("Credits for Solaris")).toHaveValue("100");
    } finally {
      srv.cleanup();
    }
  });
});
