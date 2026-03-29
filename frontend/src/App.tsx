import { getApiBase, getAdminApiBase, getPathSegments } from "./api";
import { AdminPage } from "./pages/AdminPage";
import { UserPage } from "./pages/UserPage";

const { adminSecret } = getPathSegments();

function App() {
  if (adminSecret !== null) {
    return <AdminPage apiBase={getAdminApiBase()} />;
  }

  return <UserPage apiBase={getApiBase()} />;
}

export default App;
