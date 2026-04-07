import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Participant,
  Book,
  Settings,
  Vote,
  BookScore,
  VoteDetail,
} from "../types";
import { BookCard } from "../components/BookCard";
import { BookEditForm } from "../components/BookEditForm";
import {
  PencilIcon,
  TrashIcon,
  ArchiveIcon,
  StarIcon,
  PlusIcon,
  XIcon,
} from "../components/Icons";

const STORAGE_KEY = "bookclub_participant_id";

export function UserPage({ apiBase }: { apiBase: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });

  const { data: participants = [], isLoading } = useQuery<Participant[]>({
    queryKey: ["participants"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: books = [] } = useQuery<Book[]>({
    queryKey: ["books"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/books`);
      if (!res.ok) throw new Error("Failed to fetch books");
      return res.json();
    },
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/settings`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const selectedParticipant = useMemo(() => {
    if (selectedId === null || participants.length === 0) return null;
    const found = participants.find((p) => p.id === selectedId);
    if (!found) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return found ?? null;
  }, [participants, selectedId]);

  const myNomination = useMemo(
    () =>
      selectedParticipant
        ? books.find(
            (b) =>
              b.nominated_by === selectedParticipant.id &&
              b.status === "nominated",
          )
        : undefined,
    [books, selectedParticipant],
  );

  const handleSelect = (id: number) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const handleLogout = () => {
    setSelectedId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-500">Loading...</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Book Club</h1>
        <p className="mt-4 text-stone-500">
          No participants have been added yet. Ask your admin to set up.
        </p>
      </div>
    );
  }

  if (!selectedParticipant) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12">
        <h1 className="text-center text-2xl font-bold tracking-tight">
          Book Club
        </h1>
        <h2 className="mt-6 text-center text-stone-500">Who are you?</h2>
        <ul className="mt-4 space-y-2">
          {participants.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => handleSelect(p.id)}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-left font-medium transition-colors hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const isRevealed = settings?.voting_state === "revealed";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Book Club</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500">
            {selectedParticipant.name}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          >
            Logout
          </button>
        </div>
      </div>

      {!isRevealed && (
        <NominationSection
          apiBase={apiBase}
          participantId={selectedParticipant.id}
          myNomination={myNomination}
          queryClient={queryClient}
        />
      )}

      {books.length > 0 && settings && (
        <VotingSection
          apiBase={apiBase}
          participantId={selectedParticipant.id}
          books={books}
          participants={participants}
          settings={settings}
          queryClient={queryClient}
        />
      )}

      <BacklogSection
        apiBase={apiBase}
        participantId={selectedParticipant.id}
        isRevealed={isRevealed}
        queryClient={queryClient}
      />
    </div>
  );
}

function NominationSection({
  apiBase,
  participantId,
  myNomination,
  queryClient,
}: {
  apiBase: string;
  participantId: number;
  myNomination: Book | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const nominateMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      authors: string;
      description: string;
      link: string;
      participant_id: number;
    }) => {
      const res = await fetch(`${apiBase}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to nominate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
      setTitle("");
      setAuthors("");
      setDescription("");
      setLink("");
      setError("");
      setShowForm(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const editMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      authors: string;
      description: string;
      link: string;
    }) => {
      const res = await fetch(`${apiBase}/books/${myNomination!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, participant_id: participantId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await fetch(`${apiBase}/books/${bookId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete nomination");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const moveToBacklogMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await fetch(`${apiBase}/books/${bookId}/move-to-backlog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participantId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to move to backlog");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
      queryClient.invalidateQueries({ queryKey: ["votes"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const a = authors.trim();
    if (!t || !a) return;
    nominateMutation.mutate({
      title: t,
      authors: a,
      description: description.trim(),
      link: link.trim(),
      participant_id: participantId,
    });
  };

  const handleDelete = (bookId: number) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    deleteMutation.mutate(bookId);
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Your Nomination</h2>
      {myNomination ? (
        editing ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
            <BookEditForm
              book={myNomination}
              onSave={(data) => editMutation.mutate(data)}
              onCancel={() => setEditing(false)}
              isPending={editMutation.isPending}
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            <li className="px-4 py-3">
              <BookCard
                book={myNomination}
                expanded={expandedId === myNomination.id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === myNomination.id ? null : myNomination.id,
                  )
                }
                actions={
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      aria-label="Edit nomination"
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                    >
                      <PencilIcon /> Edit
                    </button>
                    <button
                      onClick={() =>
                        moveToBacklogMutation.mutate(myNomination.id)
                      }
                      disabled={moveToBacklogMutation.isPending}
                      aria-label="Move to backlog"
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <ArchiveIcon /> Move to Backlog
                    </button>
                    <button
                      onClick={() => handleDelete(myNomination.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="Delete nomination"
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <TrashIcon /> Delete
                    </button>
                  </>
                }
              />
            </li>
          </ul>
        )
      ) : (
        <p className="mt-2 text-sm text-stone-500">
          You haven&apos;t nominated a book yet.
        </p>
      )}

      <div className="mt-4">
        {myNomination ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          >
            {showForm ? (
              <>
                <XIcon /> Cancel
              </>
            ) : (
              <>
                <PlusIcon /> Nominate a different book
              </>
            )}
          </button>
        ) : (
          <h3 className="text-sm font-medium text-stone-700">
            Nominate a book
          </h3>
        )}
        {(showForm || !myNomination) && (
          <>
            <p className="mt-1 text-xs text-stone-400">
              Check the backlog below first — the book might already be there.
              {myNomination &&
                " Your current nomination will be moved to the backlog."}
            </p>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
                maxLength={500}
                aria-label="Book title"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              />
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Author(s)"
                maxLength={500}
                aria-label="Author(s)"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                maxLength={5000}
                aria-label="Description"
                rows={2}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              />
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Link (optional)"
                maxLength={2000}
                aria-label="Link"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
              />
              <button
                type="submit"
                disabled={nominateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
              >
                <StarIcon /> Nominate
              </button>
            </form>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function BacklogSection({
  apiBase,
  participantId,
  isRevealed,
  queryClient,
}: {
  apiBase: string;
  participantId: number;
  isRevealed: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: backlog = [] } = useQuery<Book[]>({
    queryKey: ["backlog"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/backlog`);
      if (!res.ok) throw new Error("Failed to fetch backlog");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      authors: string;
      description: string;
      link: string;
    }) => {
      const res = await fetch(`${apiBase}/backlog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to add to backlog");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
      setTitle("");
      setAuthors("");
      setDescription("");
      setLink("");
      setShowAdd(false);
    },
  });

  const nominateMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await fetch(`${apiBase}/books/nominate-from-backlog`, {
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
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await fetch(`${apiBase}/books/${bookId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
    },
  });

  const editMutation = useMutation({
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
        throw new Error(body.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
      setEditingId(null);
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return backlog;
    const q = search.toLowerCase();
    return backlog.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authors.toLowerCase().includes(q) ||
        (b.description?.toLowerCase().includes(q) ?? false),
    );
  }, [backlog, search]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const a = authors.trim();
    if (!t || !a) return;
    addMutation.mutate({
      title: t,
      authors: a,
      description: description.trim(),
      link: link.trim(),
    });
  };

  const handleDelete = (bookId: number) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    deleteMutation.mutate(bookId);
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Backlog</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
        >
          {showAdd ? (
            <>
              <XIcon /> Cancel
            </>
          ) : (
            <>
              <PlusIcon /> Add Book
            </>
          )}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mt-3 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Book title"
            maxLength={500}
            aria-label="Backlog book title"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          />
          <input
            type="text"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Author(s)"
            maxLength={500}
            aria-label="Backlog author(s)"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            maxLength={5000}
            aria-label="Backlog description"
            rows={2}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          />
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (optional)"
            maxLength={2000}
            aria-label="Backlog link"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          />
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
          >
            <PlusIcon /> Add to Backlog
          </button>
        </form>
      )}

      {backlog.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search backlog..."
          aria-label="Search backlog"
          className="mt-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
        />
      )}

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          {backlog.length === 0 ? "No books in backlog." : "No matching books."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {filtered.map((book) =>
            editingId === book.id ? (
              <li key={book.id} className="px-4 py-3">
                <BookEditForm
                  book={book}
                  onSave={(data) =>
                    editMutation.mutate({ bookId: book.id, data })
                  }
                  onCancel={() => setEditingId(null)}
                  isPending={editMutation.isPending}
                />
              </li>
            ) : (
              <li key={book.id} className="px-4 py-3">
                <BookCard
                  book={book}
                  expanded={expandedId === book.id}
                  onToggle={() =>
                    setExpandedId(expandedId === book.id ? null : book.id)
                  }
                  actions={
                    <>
                      <button
                        onClick={() => setEditingId(book.id)}
                        aria-label={`Edit ${book.title}`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                      >
                        <PencilIcon /> Edit
                      </button>
                      {!isRevealed && (
                        <button
                          onClick={() => nominateMutation.mutate(book.id)}
                          disabled={nominateMutation.isPending}
                          aria-label={`Nominate ${book.title}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                        >
                          <StarIcon /> Nominate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(book.id)}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete ${book.title}`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 disabled:opacity-50"
                      >
                        <TrashIcon /> Delete
                      </button>
                    </>
                  }
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function VotingSection({
  apiBase,
  participantId,
  books,
  participants,
  settings,
  queryClient,
}: {
  apiBase: string;
  participantId: number;
  books: Book[];
  participants: Participant[];
  settings: Settings;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const isRevealed = settings.voting_state === "revealed";

  const { data: myVotes = [] } = useQuery<Vote[]>({
    queryKey: ["votes", participantId],
    queryFn: async () => {
      const res = await fetch(
        `${apiBase}/votes?participant_id=${participantId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch votes");
      return res.json();
    },
  });

  const { data: scores = [] } = useQuery<BookScore[]>({
    queryKey: ["scores"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/scores`);
      if (!res.ok) throw new Error("Failed to fetch scores");
      return res.json();
    },
    enabled: isRevealed,
  });

  const savedVoteMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const v of myVotes) {
      map.set(v.book_id, v.credits);
    }
    return map;
  }, [myVotes]);

  const [allocations, setAllocations] = useState<Map<number, number>>(
    new Map(),
  );
  const [initialized, setInitialized] = useState(false);
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [expandedVotesId, setExpandedVotesId] = useState<number | null>(null);

  if (!initialized && myVotes.length > 0) {
    setAllocations(new Map(savedVoteMap));
    setInitialized(true);
  }

  const bookIds = useMemo(() => new Set(books.map((b) => b.id)), [books]);

  const totalAllocated = useMemo(() => {
    let sum = 0;
    for (const [bookId, credits] of allocations) {
      if (bookIds.has(bookId)) sum += credits;
    }
    return sum;
  }, [allocations, bookIds]);

  const remaining = settings.credit_budget - totalAllocated;

  const hasChanges = useMemo(() => {
    if (allocations.size !== savedVoteMap.size) return true;
    for (const [bookId, credits] of allocations) {
      if (savedVoteMap.get(bookId) !== credits) return true;
    }
    return false;
  }, [allocations, savedVoteMap]);

  const setCredits = useCallback((bookId: number, credits: number) => {
    setAllocations((prev) => {
      const next = new Map(prev);
      if (credits <= 0) {
        next.delete(bookId);
      } else {
        next.set(bookId, credits);
      }
      return next;
    });
  }, []);

  const voteMutation = useMutation({
    mutationFn: async (votes: { book_id: number; credits: number }[]) => {
      const res = await fetch(`${apiBase}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          votes,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save votes");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["votes", participantId] });
    },
  });

  useEffect(() => {
    if (voteMutation.isSuccess) {
      const timer = setTimeout(voteMutation.reset, 3000);
      return () => clearTimeout(timer);
    }
  }, [voteMutation.isSuccess, voteMutation.reset]);

  const { mutate: castVotes, isPending: votePending } = voteMutation;
  useEffect(() => {
    if (!hasChanges || remaining < 0 || votePending) return;
    const votes: { book_id: number; credits: number }[] = [];
    for (const [bookId, credits] of allocations) {
      if (credits > 0) votes.push({ book_id: bookId, credits });
    }
    const timer = setTimeout(() => castVotes(votes), 1000);
    return () => clearTimeout(timer);
  }, [allocations, hasChanges, remaining, votePending, castVotes]);

  const handleSave = () => {
    const votes: { book_id: number; credits: number }[] = [];
    for (const [bookId, credits] of allocations) {
      if (credits > 0) votes.push({ book_id: bookId, credits });
    }
    voteMutation.mutate(votes);
  };

  const participantMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of participants) map.set(p.id, p.name);
    return map;
  }, [participants]);

  const scoreMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of scores) map.set(s.book_id, s.score);
    return map;
  }, [scores]);

  const sortedBooks = useMemo(() => {
    if (!isRevealed) return books;
    return [...books].sort(
      (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0),
    );
  }, [books, isRevealed, scoreMap]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isRevealed ? "Results" : "Vote"}
        </h2>
        {!isRevealed && (
          <div className="flex items-center gap-3 text-sm">
            <div>
              <span className="text-stone-500">Remaining: </span>
              <span
                className={`font-semibold ${remaining < 0 ? "text-red-600" : "text-stone-900"}`}
                data-testid="remaining-credits"
              >
                {remaining}
              </span>
              <span className="text-stone-400">
                {" "}
                / {settings.credit_budget}
              </span>
            </div>
            {voteMutation.isSuccess && !hasChanges && (
              <span className="text-xs text-green-600">Saved</span>
            )}
            {voteMutation.isPending && (
              <span className="text-xs text-stone-400">Saving...</span>
            )}
          </div>
        )}
      </div>

      <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {sortedBooks.map((book) => {
          const currentCredits = allocations.get(book.id) ?? 0;
          const score = scoreMap.get(book.id);

          const bookVotes: VoteDetail[] = scoreMap.get(book.id)
            ? (scores.find((s) => s.book_id === book.id)?.votes ?? [])
            : [];
          const votesExpanded = expandedVotesId === book.id;

          return (
            <li key={book.id} className="px-4 py-3">
              <BookCard
                book={book}
                expanded={expandedBookId === book.id}
                onToggle={() =>
                  setExpandedBookId(expandedBookId === book.id ? null : book.id)
                }
                meta={
                  <>
                    {book.nominated_by && (
                      <p className="text-xs text-stone-500">
                        Nominated by{" "}
                        {participantMap.get(book.nominated_by) ?? "Unknown"}
                        {book.nominated_by === participantId && (
                          <span className="ml-1">(yours)</span>
                        )}
                      </p>
                    )}
                  </>
                }
                actions={
                  isRevealed ? (
                    <div className="text-right">
                      <span className="text-lg font-semibold">
                        {score?.toFixed(2) ?? "0.00"}
                      </span>
                      <span className="ml-1 text-xs text-stone-400">score</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`credits-${book.id}`}>
                        Credits for {book.title}
                      </label>
                      <input
                        id={`credits-${book.id}`}
                        type="number"
                        min={0}
                        max={settings.credit_budget}
                        value={currentCredits || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setCredits(book.id, Math.max(0, val));
                        }}
                        aria-label={`Credits for ${book.title}`}
                        className="w-20 rounded-md border border-stone-300 px-3 py-2 text-right text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                      />
                      <span className="text-xs text-stone-400">credits</span>
                    </div>
                  )
                }
              />
              {isRevealed && bookVotes.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() =>
                      setExpandedVotesId(votesExpanded ? null : book.id)
                    }
                    className="text-xs text-stone-500 underline hover:text-stone-700"
                  >
                    {votesExpanded ? "hide breakdown" : "breakdown"}
                  </button>
                  {votesExpanded && (
                    <ul className="mt-1 space-y-0.5">
                      {[...bookVotes]
                        .sort((a, b) => b.credits - a.credits)
                        .map((v) => (
                          <li
                            key={v.participant_name}
                            className="flex justify-between text-xs text-stone-500"
                          >
                            <span>{v.participant_name}</span>
                            <span>{v.credits} credits</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!isRevealed && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={remaining < 0 || voteMutation.isPending || !hasChanges}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
          >
            Save Votes
          </button>
          {voteMutation.isError && (
            <p role="alert" className="text-sm text-red-600">
              {voteMutation.error.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
