import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Participant {
  id: number;
  name: string;
}

interface Book {
  id: number;
  title: string;
  authors: string;
  description?: string;
  link?: string;
  nominated_by: number | null;
  status: string;
  created_at: string;
}

interface Settings {
  credit_budget: number;
  voting_state: string;
  pins_enabled: boolean;
}

interface Vote {
  participant_id: number;
  book_id: number;
  credits: number;
}

interface BookScore {
  book_id: number;
  score: number;
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
function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline h-4 w-4"
    >
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

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

  const handleSwitch = () => {
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
            onClick={handleSwitch}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
          >
            Switch
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
          <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{myNomination.title}</p>
                <p className="text-sm text-stone-500">{myNomination.authors}</p>
                {myNomination.description && (
                  <p className="mt-2 text-sm text-stone-600">
                    {myNomination.description}
                  </p>
                )}
              </div>
              <div className="ml-4 flex gap-1">
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Edit nomination"
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                >
                  <PencilIcon /> Edit
                </button>
                <button
                  onClick={() => moveToBacklogMutation.mutate(myNomination.id)}
                  disabled={moveToBacklogMutation.isPending}
                  aria-label="Move to backlog"
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  <ArchiveIcon /> Backlog
                </button>
                <button
                  onClick={() => handleDelete(myNomination.id)}
                  disabled={deleteMutation.isPending}
                  aria-label="Delete nomination"
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <p className="mt-2 text-sm text-stone-500">
          You haven&apos;t nominated a book yet.
        </p>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-medium text-stone-700">
          {myNomination ? "Nominate a different book" : "Nominate a book"}
        </h3>
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
              <li
                key={book.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{book.title}</p>
                  <p className="text-xs text-stone-500">{book.authors}</p>
                  {book.description && (
                    <p className="mt-1 text-xs text-stone-400 line-clamp-2">
                      {book.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex gap-1">
                  <button
                    onClick={() => setEditingId(book.id)}
                    aria-label={`Edit ${book.title}`}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                  >
                    <PencilIcon /> Edit
                  </button>
                  {!isRevealed && (
                    <button
                      onClick={() => nominateMutation.mutate(book.id)}
                      disabled={nominateMutation.isPending}
                      aria-label={`Nominate ${book.title}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <StarIcon /> Nominate
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(book.id)}
                    disabled={deleteMutation.isPending}
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

  if (!initialized && myVotes.length > 0) {
    setAllocations(new Map(savedVoteMap));
    setInitialized(true);
  }

  const totalAllocated = useMemo(() => {
    let sum = 0;
    for (const v of allocations.values()) sum += v;
    return sum;
  }, [allocations]);

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
          <div className="text-sm">
            <span className="text-stone-500">Remaining: </span>
            <span
              className={`font-semibold ${remaining < 0 ? "text-red-600" : "text-stone-900"}`}
              data-testid="remaining-credits"
            >
              {remaining}
            </span>
            <span className="text-stone-400"> / {settings.credit_budget}</span>
          </div>
        )}
      </div>

      <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {sortedBooks.map((book) => {
          const currentCredits = allocations.get(book.id) ?? 0;
          const score = scoreMap.get(book.id);

          const isExpanded = expandedBookId === book.id;
          const hasDetails = !!book.description || !!book.link;

          return (
            <li key={book.id} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div
                  className={`min-w-0 flex-1${hasDetails ? " cursor-pointer" : ""}`}
                  onClick={() =>
                    hasDetails && setExpandedBookId(isExpanded ? null : book.id)
                  }
                >
                  <p className="font-medium">
                    {book.title}
                    {book.nominated_by === participantId && (
                      <span className="ml-2 text-xs text-stone-400">
                        (yours)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-stone-500">{book.authors}</p>
                  {book.nominated_by && (
                    <p className="text-xs text-stone-400">
                      Nominated by{" "}
                      {participantMap.get(book.nominated_by) ?? "Unknown"}
                    </p>
                  )}
                  {isExpanded && (
                    <div className="mt-2 space-y-1">
                      {book.description && (
                        <p className="text-sm text-stone-600">
                          {book.description}
                        </p>
                      )}
                      {book.link && (
                        <a
                          href={book.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 underline hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {book.link}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-3">
                  {isRevealed ? (
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {score?.toFixed(2) ?? "0.00"}
                      </p>
                      <p className="text-xs text-stone-400">score</p>
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
                        className="w-20 rounded-md border border-stone-300 px-2 py-1 text-right text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                      />
                      <span className="text-xs text-stone-400">credits</span>
                    </div>
                  )}
                </div>
              </div>
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
            {voteMutation.isPending ? "Saving..." : "Save Votes"}
          </button>
          {voteMutation.isError && (
            <p role="alert" className="text-sm text-red-600">
              {voteMutation.error.message}
            </p>
          )}
          {voteMutation.isSuccess && !hasChanges && (
            <p className="text-sm text-green-600">Votes saved!</p>
          )}
        </div>
      )}
    </section>
  );
}
