const ASANA_BASE = "https://app.asana.com/api/1.0";

function headers() {
  const token = process.env.ASANA_PAT;
  if (!token) throw new Error("ASANA_PAT not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

interface AsanaProjectResponse {
  gid: string;
  name: string;
  archived: boolean;
}

interface AsanaTaskResponse {
  gid: string;
  name: string;
  completed: boolean;
}

export async function fetchProjects(): Promise<AsanaProjectResponse[]> {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID;
  if (!workspaceGid) throw new Error("ASANA_WORKSPACE_GID not configured");

  const res = await fetch(
    `${ASANA_BASE}/workspaces/${workspaceGid}/projects?opt_fields=name,archived&limit=100`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Asana API error: ${res.status}`);

  const json = await res.json();
  return (json.data as AsanaProjectResponse[]).filter((p) => !p.archived);
}

export async function fetchTasks(
  projectGid: string
): Promise<AsanaTaskResponse[]> {
  const res = await fetch(
    `${ASANA_BASE}/projects/${projectGid}/tasks?opt_fields=name,completed&limit=100`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Asana API error: ${res.status}`);

  const json = await res.json();
  return json.data as AsanaTaskResponse[];
}
