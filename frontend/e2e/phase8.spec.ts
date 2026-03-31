import { test, expect } from "@playwright/test";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startServer({ port: 18700 });

  // Setup participants via API
  await fetch(`${server.adminApiBase}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alice" }),
  });
  await fetch(`${server.adminApiBase}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bob" }),
  });
});

test.afterAll(() => {
  server.cleanup();
});

test.describe("Phase 8: Book management", () => {
  test("user can edit own nomination", async ({ page }) => {
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });

    // Nominate a book
    await nomSection.getByLabel("Book title").fill("EditTest Book");
    await nomSection.getByLabel("Author(s)").fill("Author One");
    await nomSection.getByLabel("Description").fill("Old desc");
    await nomSection.getByRole("button", { name: "Nominate" }).click();
    await expect(nomSection.getByText("EditTest Book")).toBeVisible();

    // Click edit
    await nomSection
      .getByRole("button", { name: /edit/i })
      .click();

    // Edit form should appear with pre-filled values
    await expect(nomSection.getByLabel("Edit book title")).toHaveValue(
      "EditTest Book",
    );
    await nomSection.getByLabel("Edit book title").fill("EditTest Book Updated");
    await nomSection.getByLabel("Edit description").fill("New desc");
    await nomSection.getByRole("button", { name: /save/i }).click();

    // Should see updated values
    await expect(nomSection.getByText("EditTest Book Updated")).toBeVisible();
    await expect(nomSection.getByText("New desc")).toBeVisible();

    // Cleanup: delete the nomination
    page.on("dialog", (dialog) => dialog.accept());
    await nomSection.getByRole("button", { name: /delete/i }).click();
    await expect(
      nomSection.getByText("You haven't nominated a book yet"),
    ).toBeVisible();
  });

  test("user can move own nomination to backlog", async ({ page }) => {
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });
    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });

    // Nominate
    await nomSection.getByLabel("Book title").fill("MoveTest Book");
    await nomSection.getByLabel("Author(s)").fill("Author Two");
    await nomSection.getByRole("button", { name: "Nominate" }).click();
    await expect(nomSection.getByText("MoveTest Book")).toBeVisible();

    // Move to backlog
    await nomSection.getByRole("button", { name: /backlog/i }).click();

    // Should appear in backlog
    await expect(backlogSection.getByText("MoveTest Book")).toBeVisible();
    // Nomination area should show form (no current nomination)
    await expect(
      nomSection.getByText("You haven't nominated a book yet"),
    ).toBeVisible();

    // Cleanup: delete from backlog
    page.on("dialog", (dialog) => dialog.accept());
    await backlogSection
      .getByRole("button", { name: /delete.*MoveTest/i })
      .click();
  });

  test("user can edit backlog book", async ({ page }) => {
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });

    // Add to backlog
    await backlogSection.getByRole("button", { name: "Add Book" }).click();
    await page.getByLabel("Backlog book title").fill("BacklogEdit Book");
    await page.getByLabel("Backlog author(s)").fill("Author Three");
    await page.getByRole("button", { name: "Add to Backlog" }).click();
    await expect(backlogSection.getByText("BacklogEdit Book")).toBeVisible();

    // Edit
    await backlogSection
      .getByRole("button", { name: /edit.*BacklogEdit/i })
      .click();
    const editTitle = backlogSection.getByLabel("Edit book title");
    await expect(editTitle).toHaveValue("BacklogEdit Book");
    await editTitle.fill("BacklogEdit Updated");
    await backlogSection.getByRole("button", { name: /save/i }).click();

    await expect(
      backlogSection.getByText("BacklogEdit Updated"),
    ).toBeVisible();

    // Cleanup
    page.on("dialog", (dialog) => dialog.accept());
    await backlogSection
      .getByRole("button", { name: /delete.*BacklogEdit/i })
      .click();
  });

  test("delete nomination requires confirmation", async ({ page }) => {
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });

    // Nominate
    await nomSection.getByLabel("Book title").fill("DeleteConfirm Book");
    await nomSection.getByLabel("Author(s)").fill("Author Four");
    await nomSection.getByRole("button", { name: "Nominate" }).click();
    await expect(nomSection.getByText("DeleteConfirm Book")).toBeVisible();

    // Dismiss delete confirmation - book should remain
    page.on("dialog", (dialog) => dialog.dismiss());
    await nomSection.getByRole("button", { name: /delete/i }).click();
    await expect(nomSection.getByText("DeleteConfirm Book")).toBeVisible();

    // Accept delete confirmation
    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => dialog.accept());
    await nomSection.getByRole("button", { name: /delete/i }).click();
    await expect(
      nomSection.getByText("You haven't nominated a book yet"),
    ).toBeVisible();
  });

  test("nominate form hidden after nomination, shown via button with backlog hint", async ({
    page,
  }) => {
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });

    // Nominate first book
    await nomSection.getByLabel("Book title").fill("HintTest Book");
    await nomSection.getByLabel("Author(s)").fill("Author Five");
    await nomSection.getByRole("button", { name: "Nominate" }).click();
    await expect(nomSection.getByText("HintTest Book")).toBeVisible();

    // Form should be hidden after nomination
    await expect(nomSection.getByLabel("Book title")).not.toBeVisible();

    // Clicking "Nominate a different book" reveals the form with backlog hint
    await nomSection
      .getByRole("button", { name: "Nominate a different book" })
      .click();
    await expect(nomSection.getByLabel("Book title")).toBeVisible();
    await expect(
      nomSection.getByText("Check the backlog below first"),
    ).toBeVisible();

    // Cleanup
    page.on("dialog", (dialog) => dialog.accept());
    await nomSection.getByRole("button", { name: /delete/i }).click();
  });

  test("admin UI shows 'Nominated by' format", async ({ page }) => {
    // Alice nominates via user UI
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });
    await nomSection.getByLabel("Book title").fill("AdminDisplay Book");
    await nomSection.getByLabel("Author(s)").fill("Author Six");
    await nomSection.getByRole("button", { name: "Nominate" }).click();
    await expect(nomSection.getByText("AdminDisplay Book")).toBeVisible();

    // Go to admin
    await page.goto(server.adminUrl);
    const adminNomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Nominated Books" }),
    });

    await expect(
      adminNomSection.getByText("Nominated by Alice"),
    ).toBeVisible();

    // Cleanup: delete via admin
    page.on("dialog", (dialog) => dialog.accept());
    await adminNomSection.getByRole("button", { name: /delete/i }).click();
  });

  test("admin can edit any nominated book", async ({ page }) => {
    // Alice nominates
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });
    await nomSection.getByLabel("Book title").fill("AdminEdit Book");
    await nomSection.getByLabel("Author(s)").fill("Author Seven");
    await nomSection.getByRole("button", { name: "Nominate" }).click();
    await expect(nomSection.getByText("AdminEdit Book")).toBeVisible();

    // Admin edits
    await page.goto(server.adminUrl);
    const adminNomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Nominated Books" }),
    });

    await adminNomSection
      .getByRole("button", { name: "Edit AdminEdit Book" })
      .click();
    const editTitle = adminNomSection.getByLabel("Edit book title");
    await expect(editTitle).toHaveValue("AdminEdit Book");
    await editTitle.fill("AdminEdit Updated");
    await adminNomSection.getByRole("button", { name: /save/i }).click();

    await expect(adminNomSection.getByText("AdminEdit Updated")).toBeVisible();

    // Cleanup
    page.on("dialog", (dialog) => dialog.accept());
    await adminNomSection.getByRole("button", { name: /delete/i }).click();
  });

  test("admin can nominate backlog book for a user", async ({ page }) => {
    // Add to backlog via user UI
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const backlogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });
    await backlogSection.getByRole("button", { name: "Add Book" }).click();
    await page.getByLabel("Backlog book title").fill("NominateFor Book");
    await page.getByLabel("Backlog author(s)").fill("Author Eight");
    await page.getByRole("button", { name: "Add to Backlog" }).click();
    await expect(backlogSection.getByText("NominateFor Book")).toBeVisible();

    // Admin nominates it for Bob
    await page.goto(server.adminUrl);
    const adminBacklog = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Backlog" }),
    });

    await adminBacklog
      .getByRole("button", { name: /nominate.*NominateFor/i })
      .click();
    // Should show participant picker
    await adminBacklog.getByRole("combobox").selectOption({ label: "Bob" });
    await adminBacklog.getByRole("button", { name: /confirm/i }).click();

    // Should now be in nominated section
    const adminNomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Nominated Books" }),
    });
    await expect(adminNomSection.getByText("NominateFor Book")).toBeVisible();
    await expect(
      adminNomSection.getByText("Nominated by Bob"),
    ).toBeVisible();

    // Cleanup
    page.on("dialog", (dialog) => dialog.accept());
    await adminNomSection
      .getByRole("button", { name: /delete.*NominateFor/i })
      .click();
  });

  test("admin delete requires confirmation", async ({ page }) => {
    // Alice nominates
    await page.goto(server.clubUrl);
    await page.getByRole("button", { name: "Alice" }).click();

    const nomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your Nomination" }),
    });
    await nomSection.getByLabel("Book title").fill("AdminDel Book");
    await nomSection.getByLabel("Author(s)").fill("Author Nine");
    await nomSection.getByRole("button", { name: "Nominate" }).click();

    // Admin tries to delete
    await page.goto(server.adminUrl);
    const adminNomSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Nominated Books" }),
    });

    // Dismiss delete - book should remain
    page.on("dialog", (dialog) => dialog.dismiss());
    await adminNomSection.getByRole("button", { name: /delete/i }).click();
    await expect(adminNomSection.getByText("AdminDel Book")).toBeVisible();

    // Accept delete
    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => dialog.accept());
    await adminNomSection.getByRole("button", { name: /delete/i }).click();
    await expect(
      adminNomSection.getByText("No nominations yet."),
    ).toBeVisible();
  });
});
