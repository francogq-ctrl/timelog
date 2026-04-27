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
  return fetchAllPages<AsanaTaskResponse>(
    `${ASANA_BASE}/projects/${projectGid}/tasks?opt_fields=name,completed&limit=100`
  );
}

export async function updateTaskName(
  taskGid: string,
  name: string
): Promise<void> {
  const res = await fetch(`${ASANA_BASE}/tasks/${taskGid}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ data: { name } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API error ${res.status}: ${body}`);
  }
}

// ── Audit-specific functions ──

async function fetchAllPages<T>(initialUrl: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, { headers: headers() });
    if (!response.ok) throw new Error(`Asana API error: ${response.status}`);
    const json = await response.json();
    results.push(...(json.data as T[]));
    nextUrl = json.next_page?.uri ?? null;
  }

  return results;
}

export interface AsanaSectionResponse {
  gid: string;
  name: string;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  display_value: string | null;
  type: string;
}

export interface AsanaTaskDetailed {
  gid: string;
  name: string;
  completed: boolean;
  assignee: { name: string } | null;
  created_by: { name: string } | null;
  due_on: string | null;
  custom_fields: AsanaCustomField[];
  memberships: { section: { gid: string; name: string } }[];
  modified_at: string;
  created_at: string;
}

export async function fetchSections(
  projectGid: string
): Promise<AsanaSectionResponse[]> {
  const res = await fetch(
    `${ASANA_BASE}/projects/${projectGid}/sections?opt_fields=name`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Asana API error: ${res.status}`);

  const json = await res.json();
  return json.data as AsanaSectionResponse[];
}

export async function fetchTasksDetailed(
  projectGid: string
): Promise<AsanaTaskDetailed[]> {
  return fetchAllPages<AsanaTaskDetailed>(
    `${ASANA_BASE}/projects/${projectGid}/tasks?opt_fields=name,completed,assignee.name,created_by.name,due_on,custom_fields,memberships.section.name,modified_at,created_at&limit=100`
  );
}
