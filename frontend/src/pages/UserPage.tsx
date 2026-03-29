import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle className="text-xl">Book Club</CardTitle>
            <CardDescription>
              No participants have been added yet. Ask your admin to set up.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!selectedParticipant) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Book Club</CardTitle>
            <CardDescription>Who are you?</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {participants.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="lg"
                className="w-full justify-start"
                onClick={() => handleSelect(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl font-semibold">Book Club</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selectedParticipant.name}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSwitch}>
            Switch
          </Button>
        </div>
      </div>
    </div>
  );
}
