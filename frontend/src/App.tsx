import { getApiBase, getAdminApiBase, getPathSegments } from "./api";
import { AdminPage } from "./pages/AdminPage";
import { UserPage } from "./pages/UserPage";

const { clubSecret, adminSecret } = getPathSegments();

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
    return <AdminPage apiBase={getAdminApiBase()} />;
  }

  return <UserPage apiBase={getApiBase()} />;
}

export default App;
