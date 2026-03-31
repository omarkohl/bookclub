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

export function AdminPage({ apiBase }: { apiBase: string }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [backlogSearch, setBacklogSearch] = useState("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name);
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
                  aria-label={`Remove ${p.name}`}
                  className="rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  Remove
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
            {nominatedBooks.map((book) => (
              <li
                key={book.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{book.title}</p>
                  <p className="text-xs text-stone-500">
                    {book.authors}
                    {book.nominated_by && (
                      <span className="ml-2 text-stone-400">
                        by {participantMap.get(book.nominated_by) ?? "Unknown"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveToBacklogMutation.mutate(book.id)}
                    disabled={moveToBacklogMutation.isPending}
                    aria-label={`Move ${book.title} to backlog`}
                    className="rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Backlog
                  </button>
                  <button
                    onClick={() => deleteBookMutation.mutate(book.id)}
                    disabled={deleteBookMutation.isPending}
                    aria-label={`Delete ${book.title}`}
                    className="rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
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
            {filteredBacklog.map((book) => (
              <li
                key={book.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{book.title}</p>
                  <p className="text-xs text-stone-500">{book.authors}</p>
                </div>
                <button
                  onClick={() => deleteBookMutation.mutate(book.id)}
                  disabled={deleteBookMutation.isPending}
                  aria-label={`Delete ${book.title}`}
                  className="rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
