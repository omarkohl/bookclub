import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer({ port: 18100 });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 2: Books & Nominations", () => {
  test("user nominates, sees book list, admin manages books", async ({
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

    // User flow: Alice picks identity and nominates
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    // Should see "no nomination" prompt
    await expect(
      page.getByText("You haven't nominated a book yet"),
    ).toBeVisible();

    // Fill nomination form
    await page.getByLabel("Book title").fill("Dune");
    await page.getByLabel("Author(s)").fill("Frank Herbert");
    await page.getByLabel("Description").fill("A sci-fi epic about spice");
    await page.getByRole("button", { name: "Nominate", exact: true }).click();

    // Should see the nomination in "Your Nomination" section
    await expect(
      page.getByRole("heading", { name: "Your Nomination" }),
    ).toBeVisible();
    // The nomination section shows title and authors
    const nominationSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });
    await expect(nominationSection.getByText("Dune")).toBeVisible();
    await expect(nominationSection.getByText("Frank Herbert")).toBeVisible();

    // Should see the book in the voting section
    await expect(
      page.getByRole("heading", { name: "Vote" }),
    ).toBeVisible();

    // Admin sees the nomination and deletes it
    await page.goto(server.adminUrl);
    await expect(page.getByText("Dune")).toBeVisible();
    await page.getByRole("button", { name: "Delete Dune" }).click();
    await expect(page.getByText("No nominations yet")).toBeVisible();

    // User nominates again
    await page.goto(server.clubUrl);
    // Alice still selected from localStorage
    await expect(
      page.getByText("You haven't nominated a book yet"),
    ).toBeVisible();
    await page.getByLabel("Book title").fill("Neuromancer");
    await page.getByLabel("Author(s)").fill("William Gibson");
    await page.getByRole("button", { name: "Nominate", exact: true }).click();

    // Admin moves it to backlog
    await page.goto(server.adminUrl);
    await expect(page.getByText("Neuromancer")).toBeVisible();
    await page
      .getByRole("button", { name: "Move Neuromancer to backlog" })
      .click();

    // Should appear in backlog, nominations empty
    await expect(page.getByText("No nominations yet")).toBeVisible();
    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });
    await expect(backlogSection.getByText("Neuromancer")).toBeVisible();
  });

  test("user clicks book to see description and link", async ({ page }) => {
    // Setup: nominate a book with description and link
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    await page.getByLabel("Book title").fill("Hyperion");
    await page.getByLabel("Author(s)").fill("Dan Simmons");
    await page
      .getByLabel("Description")
      .fill("A far-future pilgrimage tale");
    await page.getByLabel("Link").fill("https://example.com/hyperion");
    await page
      .getByRole("button", { name: "Nominate", exact: true })
      .click();

    // Book should appear in the voting section
    const voteSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Vote" }),
    });
    const bookItem = voteSection.getByRole("listitem").filter({
      hasText: "Hyperion",
    });
    await expect(bookItem).toBeVisible();

    // Description and link should NOT be visible yet
    await expect(
      bookItem.getByText("A far-future pilgrimage tale"),
    ).not.toBeVisible();

    // Click the book title to expand details
    await bookItem.getByText("Hyperion", { exact: false }).first().click();

    // Now description and link should be visible
    await expect(
      bookItem.getByText("A far-future pilgrimage tale"),
    ).toBeVisible();
    await expect(
      bookItem.getByRole("link", { name: "https://example.com/hyperion" }),
    ).toBeVisible();

    // Click again to collapse
    await bookItem.getByText("Hyperion", { exact: false }).first().click();
    await expect(
      bookItem.getByText("A far-future pilgrimage tale"),
    ).not.toBeVisible();
  });
});
