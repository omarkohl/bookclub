import { useQuery } from "@tanstack/react-query";
import { getApiBase, getAdminApiBase, getPathSegments } from "./api";
import { AdminPage } from "./pages/AdminPage";
import { UserPage } from "./pages/UserPage";

const { clubSecret, adminSecret } = getPathSegments();

const REPO_URL = "https://github.com/omarkohl/bookclub";

function Footer() {
  const { data } = useQuery<{ version: string; date: string }>({
    queryKey: ["version"],
    queryFn: async () => {
      const res = await fetch("/api/version");
      if (!res.ok) throw new Error("failed to fetch version");
      return res.json();
    },
    staleTime: Infinity,
  });

  return (
    <footer className="mt-12 border-t border-stone-200 py-4 text-center text-xs text-stone-400">
      {data && (
        <span>
          {data.version} &middot; {data.date} &middot;{" "}
        </span>
      )}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-stone-600"
      >
        source
      </a>
    </footer>
  );
}

function App() {
  if (!clubSecret) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Book Club</h1>
        <p className="mt-4 text-stone-500">
          This URL is incomplete. You need a club link to access this app.
        </p>
      </div>
    );
  }

  if (adminSecret !== null) {
    return (
      <>
        <AdminPage apiBase={getAdminApiBase()} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <UserPage apiBase={getApiBase()} />
      <Footer />
    </>
  );
}

export default App;
