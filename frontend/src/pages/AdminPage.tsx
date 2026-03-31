import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Participant {
  id: number;
  name: string;
  created_at: string;
}

interface Book {
  id: number;
  title: string;
  authors: string;
  description?: string;
  link?: string;
  nominated_by: number | null;
  status: string;
}

interface Settings {
  credit_budget: number;
  voting_state: string;
  pins_enabled: boolean;
}

// --- SVG Icons ---
function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function ArchiveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" />
      <path
        fillRule="evenodd"
        d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zm5.22 1.72a.75.75 0 011.06 0L10 10.94l1.72-1.72a.75.75 0 111.06 1.06l-2.25 2.25a.75.75 0 01-1.06 0L7.22 10.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function BookEditForm({
  book,
  onSave,
  onCancel,
  isPending,
}: {
  book: Book;
  onSave: (data: {
    title: string;
    authors: string;
    description: string;
    link: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors);
  const [description, setDescription] = useState(book.description ?? "");
  const [link, setLink] = useState(book.link ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const a = authors.trim();
    if (!t || !a) return;
    onSave({
      title: t,
      authors: a,
      description: description.trim(),
      link: link.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Book title"
        maxLength={500}
        aria-label="Edit book title"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <input
        type="text"
        value={authors}
        onChange={(e) => setAuthors(e.target.value)}
        placeholder="Author(s)"
        maxLength={500}
        aria-label="Edit author(s)"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        maxLength={5000}
        aria-label="Edit description"
        rows={2}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Link (optional)"
        maxLength={2000}
        aria-label="Edit link"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
        >
          <CheckIcon /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
        >
          <XIcon /> Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminPage({ apiBase }: { apiBase: string }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [backlogSearch, setBacklogSearch] = useState("");
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [nominatingBookId, setNominatingBookId] = useState<number | null>(null);
  const [nominateUserId, setNominateUserId] = useState<number | null>(null);
  const [budgetConfirm, setBudgetConfirm] = useState<{
    budget: number;
    affectedUsers: number;
  } | null>(null);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/settings`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const toggleVotingMutation = useMutation({
    mutationFn: async (newState: string) => {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          voting_state: newState,
        }),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const previewBudgetMutation = useMutation({
    mutationFn: async (newBudget: number) => {
      const res = await fetch(
        `${apiBase}/settings/budget-preview?budget=${newBudget}`,
      );
      if (!res.ok) throw new Error("Failed to preview budget change");
      return res.json() as Promise<{ affected_users: number }>;
    },
    onSuccess: (data, newBudget) => {
      if (data.affected_users > 0) {
        setBudgetConfirm({
          budget: newBudget,
          affectedUsers: data.affected_users,
        });
      } else {
        applyBudgetMutation.mutate(newBudget);
      }
    },
  });

  const applyBudgetMutation = useMutation({
    mutationFn: async (newBudget: number) => {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          credit_budget: newBudget,
        }),
      });
      if (!res.ok) throw new Error("Failed to update budget");
      return res.json();
    },
    onSuccess: () => {
      setBudgetInput("");
      setBudgetConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const { data: participants = [], isLoading } = useQuery<Participant[]>({
    queryKey: ["admin", "participants"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: books = [] } = useQuery<Book[]>({
    queryKey: ["admin", "books"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/books`);
      if (!res.ok) throw new Error("Failed to fetch books");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${apiBase}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create participant");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "participants"] });
      setNewName("");
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${apiBase}/participants/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete participant");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "participants"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${apiBase}/books/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete book");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
    },
  });

  const moveToBacklogMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${apiBase}/books/${id}/move-to-backlog`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to move to backlog");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
    },
  });

  const editBookMutation = useMutation({
    mutationFn: async ({
      bookId,
      data,
    }: {
      bookId: number;
      data: {
        title: string;
        authors: string;
        description: string;
        link: string;
      };
    }) => {
      const res = await fetch(`${apiBase}/books/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update book");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
      setEditingBookId(null);
    },
  });

  const nominateForUserMutation = useMutation({
    mutationFn: async ({
      bookId,
      participantId,
    }: {
      bookId: number;
      participantId: number;
    }) => {
      const res = await fetch(`${apiBase}/books/nominate-for-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: bookId,
          participant_id: participantId,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to nominate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
      setNominatingBookId(null);
      setNominateUserId(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  const handleDeleteBook = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    deleteBookMutation.mutate(id);
  };

  const nominatedBooks = books.filter((b) => b.status === "nominated");
  const backlogBooks = books.filter((b) => b.status === "backlog");
  const filteredBacklog = (() => {
    if (!backlogSearch.trim()) return backlogBooks;
    const q = backlogSearch.toLowerCase();
    return backlogBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authors.toLowerCase().includes(q) ||
        (b.description?.toLowerCase().includes(q) ?? false),
    );
  })();
  const participantMap = new Map(participants.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Book Club Admin</h1>

      {settings && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Voting</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-stone-500">
              Status:{" "}
              <span className="font-medium text-stone-900">
                {settings.voting_state === "open"
                  ? "Voting Open"
                  : "Results Revealed"}
              </span>
            </span>
            <button
              onClick={() =>
                toggleVotingMutation.mutate(
                  settings.voting_state === "open" ? "revealed" : "open",
                )
              }
              disabled={toggleVotingMutation.isPending}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
            >
              {settings.voting_state === "open"
                ? "Reveal Results"
                : "Reopen Voting"}
            </button>
          </div>

          <div className="mt-4">
            <label className="text-sm text-stone-500">
              Credit Budget:{" "}
              <span className="font-medium text-stone-900">
                {settings.credit_budget}
              </span>
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="New budget"
                aria-label="New credit budget"
                className="w-32 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              />
              <button
                onClick={() => {
                  const val = parseInt(budgetInput, 10);
                  if (val > 0) previewBudgetMutation.mutate(val);
                }}
                disabled={
                  !budgetInput ||
                  parseInt(budgetInput, 10) <= 0 ||
                  previewBudgetMutation.isPending ||
                  applyBudgetMutation.isPending
                }
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
              >
                Update
              </button>
            </div>
            {budgetConfirm && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  Changing budget to {budgetConfirm.budget} will clear votes for{" "}
                  <strong>
                    {budgetConfirm.affectedUsers}{" "}
                    {budgetConfirm.affectedUsers === 1 ? "user" : "users"}
                  </strong>{" "}
                  who exceed the new limit.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      applyBudgetMutation.mutate(budgetConfirm.budget)
                    }
                    disabled={applyBudgetMutation.isPending}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setBudgetConfirm(null)}
                    className="rounded-md px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Participants</h2>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Participant name"
            maxLength={100}
            aria-label="Participant name"
            className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {isLoading && <p className="mt-4 text-sm text-stone-500">Loading...</p>}

        {participants.length === 0 && !isLoading ? (
          <p className="mt-4 text-sm text-stone-500">
            No participants yet. Add some above.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  disabled={deleteMutation.isPending}
                  aria-label={`Delete ${p.name}`}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  <TrashIcon /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Nominated Books</h2>
        {nominatedBooks.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No nominations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {nominatedBooks.map((book) =>
              editingBookId === book.id ? (
                <li key={book.id} className="px-4 py-3">
                  <BookEditForm
                    book={book}
                    onSave={(data) =>
                      editBookMutation.mutate({ bookId: book.id, data })
                    }
                    onCancel={() => setEditingBookId(null)}
                    isPending={editBookMutation.isPending}
                  />
                </li>
              ) : (
                <li
                  key={book.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{book.title}</p>
                    <p className="text-xs text-stone-500">{book.authors}</p>
                    {book.nominated_by && (
                      <p className="text-xs text-stone-400">
                        Nominated by{" "}
                        {participantMap.get(book.nominated_by) ?? "Unknown"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingBookId(book.id)}
                      aria-label={`Edit ${book.title}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                    >
                      <PencilIcon /> Edit
                    </button>
                    <button
                      onClick={() => moveToBacklogMutation.mutate(book.id)}
                      disabled={moveToBacklogMutation.isPending}
                      aria-label={`Move ${book.title} to backlog`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <ArchiveIcon /> Backlog
                    </button>
                    <button
                      onClick={() => handleDeleteBook(book.id)}
                      disabled={deleteBookMutation.isPending}
                      aria-label={`Delete ${book.title}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <TrashIcon /> Delete
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Backlog</h2>
        {backlogBooks.length > 0 && (
          <input
            type="text"
            value={backlogSearch}
            onChange={(e) => setBacklogSearch(e.target.value)}
            placeholder="Search backlog..."
            aria-label="Search backlog"
            className="mt-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          />
        )}
        {filteredBacklog.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            {backlogBooks.length === 0
              ? "No books in backlog."
              : "No matching books."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {filteredBacklog.map((book) =>
              editingBookId === book.id ? (
                <li key={book.id} className="px-4 py-3">
                  <BookEditForm
                    book={book}
                    onSave={(data) =>
                      editBookMutation.mutate({ bookId: book.id, data })
                    }
                    onCancel={() => setEditingBookId(null)}
                    isPending={editBookMutation.isPending}
                  />
                </li>
              ) : nominatingBookId === book.id ? (
                <li key={book.id} className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{book.title}</p>
                    <p className="text-xs text-stone-500">{book.authors}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={nominateUserId ?? ""}
                      onChange={(e) =>
                        setNominateUserId(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      aria-label="Select participant"
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                    >
                      <option value="">Select participant...</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (nominateUserId) {
                          nominateForUserMutation.mutate({
                            bookId: book.id,
                            participantId: nominateUserId,
                          });
                        }
                      }}
                      disabled={
                        !nominateUserId || nominateForUserMutation.isPending
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <CheckIcon /> Confirm
                    </button>
                    <button
                      onClick={() => {
                        setNominatingBookId(null);
                        setNominateUserId(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                    >
                      <XIcon /> Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={book.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{book.title}</p>
                    <p className="text-xs text-stone-500">{book.authors}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingBookId(book.id)}
                      aria-label={`Edit ${book.title}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                    >
                      <PencilIcon /> Edit
                    </button>
                    <button
                      onClick={() => setNominatingBookId(book.id)}
                      aria-label={`Nominate ${book.title}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                    >
                      <StarIcon /> Nominate
                    </button>
                    <button
                      onClick={() => handleDeleteBook(book.id)}
                      disabled={deleteBookMutation.isPending}
                      aria-label={`Delete ${book.title}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <TrashIcon /> Delete
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
