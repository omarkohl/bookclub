import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer({ port: 18600 });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 7: Backlog", () => {
  test("add to backlog, search, nominate from backlog, replaced nomination goes to backlog", async ({
    page,
  }) => {
    // Setup: admin adds participants
    await page.goto(server.adminUrl);
    await page.getByLabel("Participant name").fill("Alice");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Alice")).toBeVisible();

    await page.getByLabel("Participant name").fill("Bob");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Bob")).toBeVisible();

    // User flow: Alice picks identity
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    // Backlog should be empty initially
    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });
    await expect(backlogSection.getByText("No books in backlog.")).toBeVisible();

    // Add books to backlog
    await backlogSection.getByRole("button", { name: "Add Book" }).click();
    await page.getByLabel("Backlog book title").fill("Dune");
    await page.getByLabel("Backlog author(s)").fill("Frank Herbert");
    await page.getByLabel("Backlog description").fill("A sci-fi epic about spice");
    await page.getByRole("button", { name: "Add to Backlog" }).click();

    // Form should close, book should appear
    await expect(backlogSection.getByText("Dune")).toBeVisible();
    await expect(backlogSection.getByText("Frank Herbert")).toBeVisible();

    // Add a second book
    await backlogSection.getByRole("button", { name: "Add Book" }).click();
    await page.getByLabel("Backlog book title").fill("Neuromancer");
    await page.getByLabel("Backlog author(s)").fill("William Gibson");
    await page
      .getByLabel("Backlog description")
      .fill("Cyberpunk classic about cyberspace");
    await page.getByRole("button", { name: "Add to Backlog" }).click();

    await expect(backlogSection.getByText("Neuromancer")).toBeVisible();

    // Add a third book for search testing
    await backlogSection.getByRole("button", { name: "Add Book" }).click();
    await page.getByLabel("Backlog book title").fill("Snow Crash");
    await page.getByLabel("Backlog author(s)").fill("Neal Stephenson");
    await page.getByRole("button", { name: "Add to Backlog" }).click();

    await expect(backlogSection.getByText("Snow Crash")).toBeVisible();

    // Search: filter by title
    await page.getByLabel("Search backlog").fill("neuro");
    await expect(backlogSection.getByText("Neuromancer")).toBeVisible();
    await expect(backlogSection.getByText("Dune")).not.toBeVisible();
    await expect(backlogSection.getByText("Snow Crash")).not.toBeVisible();

    // Search: filter by author
    await page.getByLabel("Search backlog").fill("herbert");
    await expect(backlogSection.getByText("Dune")).toBeVisible();
    await expect(backlogSection.getByText("Neuromancer")).not.toBeVisible();

    // Search: filter by description
    await page.getByLabel("Search backlog").fill("cyberpunk");
    await expect(backlogSection.getByText("Neuromancer")).toBeVisible();
    await expect(backlogSection.getByText("Dune")).not.toBeVisible();

    // Search: no results
    await page.getByLabel("Search backlog").fill("nonexistent");
    await expect(backlogSection.getByText("No matching books.")).toBeVisible();

    // Clear search
    await page.getByLabel("Search backlog").fill("");
    await expect(backlogSection.getByText("Dune")).toBeVisible();
    await expect(backlogSection.getByText("Neuromancer")).toBeVisible();
    await expect(backlogSection.getByText("Snow Crash")).toBeVisible();

    // Nominate from backlog
    await backlogSection
      .getByRole("button", { name: "Nominate Dune" })
      .click();

    // Dune should disappear from backlog and appear as nomination
    await expect(backlogSection.getByText("Dune")).not.toBeVisible();
    const nominationSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });
    await expect(nominationSection.getByText("Dune")).toBeVisible();

    // Nominate another from backlog — should replace current nomination
    // and old nomination (Dune) should move to backlog
    await backlogSection
      .getByRole("button", { name: "Nominate Neuromancer" })
      .click();

    // Neuromancer is now the nomination
    await expect(nominationSection.getByText("Neuromancer")).toBeVisible();
    // Dune should be back in backlog (replaced nomination goes to backlog)
    await expect(backlogSection.getByText("Dune")).toBeVisible();
    // Neuromancer should be gone from backlog
    await expect(backlogSection.getByText("Neuromancer")).not.toBeVisible({
      timeout: 2000,
    });

    // Delete a book from backlog (accept confirmation dialog)
    page.on("dialog", (dialog) => dialog.accept());
    await backlogSection
      .getByRole("button", { name: "Delete Snow Crash" })
      .click();
    await expect(backlogSection.getByText("Snow Crash")).not.toBeVisible();
  });

  test("admin backlog search works", async ({ page }) => {
    // Books from previous test are still in the DB (same server)
    await page.goto(server.adminUrl);

    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });

    // Search should filter admin backlog
    await backlogSection.getByLabel("Search backlog").fill("dune");
    await expect(backlogSection.getByText("Dune")).toBeVisible();
  });
});
