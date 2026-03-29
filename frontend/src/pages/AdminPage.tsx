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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Book Club Admin</h1>

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
    </div>
  );
}
