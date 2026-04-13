"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WorkType {
  id: string;
  name: string;
  active: boolean;
}

interface Activity {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
}

interface AsanaProject {
  id: string;
  gid: string;
  name: string;
  active: boolean;
  lastSynced: string | null;
}

export default function AdminPage() {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [asanaProjects, setAsanaProjects] = useState<AsanaProject[]>([]);
  const [newWorkType, setNewWorkType] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newActivityCat, setNewActivityCat] = useState("");
  const [customCatMode, setCustomCatMode] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"types" | "activities" | "team" | "asana">("types");

  const fetchAll = useCallback(async () => {
    const [wt, act, usr, ap] = await Promise.all([
      fetch("/api/admin/work-types").then((r) => r.json()),
      fetch("/api/admin/activities").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/asana-projects").then((r) => r.json()),
    ]);
    setWorkTypes(wt);
    setActivities(act);
    setUsers(usr);
    setAsanaProjects(ap);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Derive categories dynamically from DB
  const categories = [...new Set(activities.map((a) => a.category))].sort();

  // Set default category when activities load
  useEffect(() => {
    if (categories.length > 0 && !newActivityCat) {
      setNewActivityCat(categories[0]);
    }
  }, [categories, newActivityCat]);

  // ─── Work Types ───────────────────────────────────────────────

  async function addWorkType() {
    if (!newWorkType.trim()) return;
    await fetch("/api/admin/work-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWorkType.trim() }),
    });
    setNewWorkType("");
    fetchAll();
  }

  async function toggleWorkType(id: string, active: boolean) {
    await fetch("/api/admin/work-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchAll();
  }

  async function deleteWorkType(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/work-types", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    fetchAll();
  }

  // ─── Activities ───────────────────────────────────────────────

  async function addActivity() {
    if (!newActivity.trim() || !newActivityCat.trim()) return;
    await fetch("/api/admin/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newActivity.trim(), category: newActivityCat.trim().toUpperCase() }),
    });
    setNewActivity("");
    setCustomCatMode(false);
    fetchAll();
  }

  async function toggleActivity(id: string, active: boolean) {
    await fetch("/api/admin/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchAll();
  }

  async function deleteActivity(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/activities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    fetchAll();
  }

  async function deleteCategory(category: string) {
    const count = activities.filter((a) => a.category === category).length;
    if (!confirm(`Delete category "${category}" and all ${count} activities in it? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/activities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    setNewActivityCat("");
    fetchAll();
  }

  // ─── Users ────────────────────────────────────────────────────

  async function addUser() {
    if (!newUserEmail.trim()) return;
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newUserEmail.trim(), name: newUserName.trim() || null }),
    });
    setNewUserEmail("");
    setNewUserName("");
    fetchAll();
  }

  async function updateUserRole(id: string, role: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    fetchAll();
  }

  async function toggleUser(id: string, active: boolean) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchAll();
  }

  async function deleteUser(id: string, name: string | null, email: string) {
    const label = name || email;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAll();
  }

  // ─── Asana ────────────────────────────────────────────────────

  async function toggleAsanaProject(id: string, active: boolean) {
    await fetch("/api/admin/asana-projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchAll();
  }

  async function deleteAsanaProject(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the list permanently?`)) return;
    await fetch("/api/admin/asana-projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAll();
  }

  async function purgeInactiveProjects() {
    const count = asanaProjects.filter((p) => !p.active).length;
    if (!confirm(`Permanently remove ${count} inactive projects from the list?`)) return;
    await fetch("/api/admin/asana-projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purgeInactive: true }),
    });
    fetchAll();
  }

  async function syncAsana() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/asana/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncError(data.error || `Sync failed (${res.status})`);
      } else {
        fetchAll();
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSyncing(false);
    }
  }

  const tabs = [
    { id: "types" as const, label: "Work Types" },
    { id: "activities" as const, label: "Activities" },
    { id: "team" as const, label: "Team" },
    { id: "asana" as const, label: "Asana" },
  ];

  const inactiveAsanaCount = asanaProjects.filter((p) => !p.active).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
              activeTab === tab.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Work Types */}
      {activeTab === "types" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Available work types for Client Work (Animation, Editing, Design, etc.)
          </p>
          <div className="flex gap-2">
            <Input
              value={newWorkType}
              onChange={(e) => setNewWorkType(e.target.value)}
              placeholder="New type..."
              className="bg-zinc-900 border-zinc-800"
              onKeyDown={(e) => e.key === "Enter" && addWorkType()}
            />
            <Button onClick={addWorkType} size="sm" className="bg-lime-400 text-zinc-900 hover:bg-lime-300">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {workTypes.map((wt) => (
              <div
                key={wt.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <span className={cn("text-sm", !wt.active && "text-zinc-500 line-through")}>
                  {wt.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleWorkType(wt.id, wt.active)}
                    className={cn(
                      "rounded-md p-1.5 transition",
                      wt.active
                        ? "text-lime-400 hover:bg-lime-400/10"
                        : "text-zinc-500 hover:bg-zinc-800"
                    )}
                  >
                    {wt.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => deleteWorkType(wt.id, wt.name)}
                    className="rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {activeTab === "activities" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Predefined activities for non-client time entries. Categories are dynamic — type any name.
          </p>
          <div className="flex gap-2">
            {/* Category: select existing or type new */}
            {customCatMode ? (
              <Input
                value={newActivityCat}
                onChange={(e) => setNewActivityCat(e.target.value)}
                placeholder="New category name..."
                className="w-48 bg-zinc-900 border-zinc-800"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setCustomCatMode(false); setNewActivityCat(categories[0] ?? ""); }
                }}
              />
            ) : (
              <Select
                value={newActivityCat}
                onValueChange={(v) => {
                  if (!v) return;
                  if (v === "__new__") { setCustomCatMode(true); setNewActivityCat(""); }
                  else setNewActivityCat(v);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New category</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              placeholder="New activity..."
              className="bg-zinc-900 border-zinc-800"
              onKeyDown={(e) => e.key === "Enter" && addActivity()}
            />
            <Button onClick={addActivity} size="sm" className="bg-lime-400 text-zinc-900 hover:bg-lime-300">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {categories.map((cat) => {
            const catActivities = activities.filter((a) => a.category === cat);
            return (
              <div key={cat}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {cat}
                  </h3>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                    title={`Delete category ${cat}`}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete category
                  </button>
                </div>
                <div className="space-y-2">
                  {catActivities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                    >
                      <span className={cn("text-sm", !a.active && "text-zinc-500 line-through")}>
                        {a.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleActivity(a.id, a.active)}
                          className={cn(
                            "rounded-md p-1.5 transition",
                            a.active
                              ? "text-lime-400 hover:bg-lime-400/10"
                              : "text-zinc-500 hover:bg-zinc-800"
                          )}
                        >
                          {a.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteActivity(a.id, a.name)}
                          className="rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Only users added here can sign in
          </p>
          <div className="flex gap-2">
            <Input
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Name..."
              className="w-36 bg-zinc-900 border-zinc-800"
            />
            <Input
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Email..."
              className="bg-zinc-900 border-zinc-800"
              onKeyDown={(e) => e.key === "Enter" && addUser()}
            />
            <Button onClick={addUser} size="sm" className="bg-lime-400 text-zinc-900 hover:bg-lime-300">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", !u.active && "text-zinc-500")}>
                    {u.name || u.email}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={(role) => role && updateUserRole(u.id, role)}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge
                    variant={u.active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleUser(u.id, u.active)}
                  >
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                  <button
                    onClick={() => deleteUser(u.id, u.name, u.email)}
                    className="rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                    title="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asana */}
      {activeTab === "asana" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Sync projects and tasks from Asana
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={syncAsana}
              disabled={syncing}
              className="bg-lime-400 text-zinc-900 hover:bg-lime-300"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
            {inactiveAsanaCount > 0 && (
              <Button
                onClick={purgeInactiveProjects}
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Purge {inactiveAsanaCount} inactive
              </Button>
            )}
            <p className="text-xs text-zinc-500">
              Also runs automatically every 6 hours.
            </p>
          </div>

          {syncError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              ⚠️ {syncError}
            </div>
          )}

          {asanaProjects.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Projects
                </h3>
                <span className="text-xs text-zinc-500">
                  {asanaProjects.filter((p) => p.active).length} of {asanaProjects.length} visible
                </span>
              </div>
              <div className="space-y-2">
                {asanaProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                  >
                    <span className={cn("text-sm", !p.active && "text-zinc-500 line-through")}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleAsanaProject(p.id, p.active)}
                        className={cn(
                          "rounded-md p-1.5 transition",
                          p.active
                            ? "text-lime-400 hover:bg-lime-400/10"
                            : "text-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        {p.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => deleteAsanaProject(p.id, p.name)}
                        className="rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                        title="Remove from list"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
