import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "./api";

function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/health`);
      if (!res.ok) throw new Error("API error");
      return res.json();
    },
  });

  return (
    <div>
      <h1>Book Club</h1>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error connecting to API</p>}
      {data && <p>API status: {data.status}</p>}
    </div>
  );
}

export default App;
