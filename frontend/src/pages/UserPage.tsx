import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface Participant {
  id: number;
  name: string;
}

const STORAGE_KEY = "bookclub_participant_id";

export function UserPage({ apiBase }: { apiBase: string }) {
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
    </div>
  );
}
