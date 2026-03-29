import { useState, useMemo } from "react";
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

  // Derive the selected participant. If the stored ID no longer exists
  // in the participant list, treat as unselected.
  const selectedParticipant = useMemo(() => {
    if (selectedId === null || participants.length === 0) return null;
    const found = participants.find((p) => p.id === selectedId);
    if (!found) {
      // Clean up stale localStorage (side effect in memo is fine for
      // localStorage — it's idempotent and not React state).
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

      <NominationSection
        apiBase={apiBase}
        participantId={selectedParticipant.id}
        myNomination={myNomination}
        queryClient={queryClient}
      />

      <BookList
        books={books}
        participants={participants}
        myParticipantId={selectedParticipant.id}
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
      setTitle("");
      setAuthors("");
      setDescription("");
      setLink("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
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

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Your Nomination</h2>
      {myNomination ? (
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
            <button
              onClick={() => deleteMutation.mutate(myNomination.id)}
              disabled={deleteMutation.isPending}
              className="rounded-md px-2.5 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-stone-500">
            You haven&apos;t nominated a book yet.
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
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
            >
              Nominate
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function BookList({
  books,
  participants,
  myParticipantId,
}: {
  books: Book[];
  participants: Participant[];
  myParticipantId: number;
}) {
  const participantMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of participants) {
      map.set(p.id, p.name);
    }
    return map;
  }, [participants]);

  if (books.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Nominated Books</h2>
      <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {books.map((book) => (
          <li key={book.id} className="px-4 py-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {book.title}
                  {book.nominated_by === myParticipantId && (
                    <span className="ml-2 text-xs text-stone-400">(yours)</span>
                  )}
                </p>
                <p className="text-sm text-stone-500">{book.authors}</p>
              </div>
              {book.nominated_by && (
                <span className="text-xs text-stone-400">
                  {participantMap.get(book.nominated_by) ?? "Unknown"}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
