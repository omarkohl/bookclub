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
    return <p>Loading...</p>;
  }

  if (participants.length === 0) {
    return (
      <div>
        <h1>Book Club</h1>
        <p>No participants have been added yet. Ask your admin to set up.</p>
      </div>
    );
  }

  if (!selectedParticipant) {
    return (
      <div>
        <h1>Book Club</h1>
        <h2>Who are you?</h2>
        <ul>
          {participants.map((p) => (
            <li key={p.id}>
              <button onClick={() => handleSelect(p.id)}>{p.name}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h1>Book Club</h1>
      <p>
        Welcome, {selectedParticipant.name}!{" "}
        <button onClick={handleSwitch}>Switch user</button>
      </p>
    </div>
  );
}
