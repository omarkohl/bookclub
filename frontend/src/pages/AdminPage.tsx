import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Participant {
  id: number;
  name: string;
  created_at: string;
}

export function AdminPage({ apiBase }: { apiBase: string }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const { data: participants = [], isLoading } = useQuery<Participant[]>({
    queryKey: ["admin", "participants"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
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
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  return (
    <div>
      <h1>Book Club Admin</h1>

      <h2>Participants</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Participant name"
          maxLength={100}
          aria-label="Participant name"
        />
        <button type="submit" disabled={createMutation.isPending}>
          Add
        </button>
      </form>
      {error && <p role="alert">{error}</p>}

      {isLoading && <p>Loading...</p>}

      {participants.length === 0 && !isLoading ? (
        <p>No participants yet. Add some above.</p>
      ) : (
        <ul>
          {participants.map((p) => (
            <li key={p.id}>
              {p.name}
              <button
                onClick={() => deleteMutation.mutate(p.id)}
                disabled={deleteMutation.isPending}
                aria-label={`Remove ${p.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
