"use client";

import { useState, useEffect, useCallback } from "react";
import { startOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, addDays, differenceInDays, parseISO, format as dateFmt } from "date-fns";
import { Plus, RefreshCw, Check, X, Trash2, Copy, Link2, Play } from "lucide-react";
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
import { AdminPtoForm } from "@/components/admin-pto-form";

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
  slackUserId: string | null;
  weeklyContractHours: number;
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
  const [activeTab, setActiveTab] = useState<"types" | "activities" | "team" | "pto" | "asana" | "hub">("types");

  // ─── Hub state ────────────────────────────────────────────────
  interface HubSnapshot { id: string; type: string; source: string; label: string; periodFrom: string; periodTo: string; generatedAt: string; }
  const [hubToken, setHubToken] = useState<string | null>(null);
  const [hubSnapshots, setHubSnapshots] = useState<HubSnapshot[]>([]);
  const [hubCopied, setHubCopied] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [hubIncludeHidden, setHubIncludeHidden] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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

  async function updateUserSlackId(id: string, slackUserId: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, slackUserId: slackUserId.trim() }),
    });
    fetchAll();
  }

  async function updateUserContractHours(id: string, hours: number) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, weeklyContractHours: hours }),
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

  // ─── Hub functions ────────────────────────────────────────────

  const fetchHub = useCallback(async () => {
    const [cfg, snaps] = await Promise.all([
      fetch("/api/admin/hub").then((r) => r.json()),
      fetch("/api/admin/hub/snapshots").then((r) => r.json()),
    ]);
    if (cfg.token) setHubToken(cfg.token);
    if (Array.isArray(snaps)) setHubSnapshots(snaps);
  }, []);

  useEffect(() => {
    if (activeTab === "hub") fetchHub();
  }, [activeTab, fetchHub]);

  async function deleteSnapshot(id: string, label: string) {
    if (!confirm(`Delete report "${label}"?`)) return;
    await fetch("/api/admin/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", snapshotId: id }),
    });
    fetchHub();
  }

  async function generateSnapshot(key: string, type: "WEEKLY" | "MONTHLY", from: Date, to: Date, label: string) {
    setGenerating(key);
    try {
      // Subtle suffix when the snapshot includes hidden users — only the
      // admin who toggled it knows what the trailing dash means.
      const finalLabel = hubIncludeHidden ? `${label} -` : label;
      await fetch("/api/admin/hub/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          from: dateFmt(from, "yyyy-MM-dd"),
          to: dateFmt(to, "yyyy-MM-dd"),
          label: finalLabel,
          includeHidden: hubIncludeHidden,
        }),
      });
      fetchHub();
    } finally {
      setGenerating(null);
    }
  }

  function handleGenerate(key: string) {
    const today = new Date();
    if (key === "this-week") {
      const from = startOfWeek(today, { weekStartsOn: 1 });
      const label = `Week ${dateFmt(from, "MMM d")}–${dateFmt(today, "MMM d, yyyy")}`;
      generateSnapshot(key, "WEEKLY", from, today, label);
    } else if (key === "last-week") {
      const from = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      const to = addDays(from, 4);
      const label = `Week ${dateFmt(from, "MMM d")}–${dateFmt(to, "MMM d, yyyy")}`;
      generateSnapshot(key, "WEEKLY", from, to, label);
    } else if (key === "this-month") {
      const from = startOfMonth(today);
      const label = `${dateFmt(today, "MMMM yyyy")} (partial)`;
      generateSnapshot(key, "MONTHLY", from, today, label);
    } else if (key === "last-month") {
      const lastMonth = subMonths(today, 1);
      const from = startOfMonth(lastMonth);
      const to = endOfMonth(lastMonth);
      const label = dateFmt(from, "MMMM yyyy");
      generateSnapshot(key, "MONTHLY", from, to, label);
    } else if (key === "custom") {
      if (!customFrom || !customTo) return;
      const from = parseISO(customFrom);
      const to = parseISO(customTo);
      if (from > to) return;
      const span = differenceInDays(to, from);
      const type: "WEEKLY" | "MONTHLY" = span <= 7 ? "WEEKLY" : "MONTHLY";
      const sameYear = dateFmt(from, "yyyy") === dateFmt(to, "yyyy");
      const label = sameYear
        ? `${dateFmt(from, "MMM d")}–${dateFmt(to, "MMM d, yyyy")}`
        : `${dateFmt(from, "MMM d, yyyy")}–${dateFmt(to, "MMM d, yyyy")}`;
      generateSnapshot(key, type, from, to, label);
    }
  }

  function copyHubLink() {
    if (!hubToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/hub/${hubToken}`);
    setHubCopied(true);
    setTimeout(() => setHubCopied(false), 2000);
  }

  const tabs = [
    { id: "types" as const, label: "Work Types" },
    { id: "activities" as const, label: "Activities" },
    { id: "team" as const, label: "Team" },
    { id: "pto" as const, label: "PTO" },
    { id: "asana" as const, label: "Asana" },
    { id: "hub" as const, label: "Report Hub" },
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
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div className="flex items-center justify-between">
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
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    defaultValue={u.slackUserId ?? ""}
                    placeholder="Slack ID (e.g. U0XXXXXXX)"
                    className="h-7 text-xs bg-zinc-900 border-zinc-800 flex-1"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (u.slackUserId ?? "")) updateUserSlackId(u.id, v);
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={80}
                      step={1}
                      defaultValue={u.weeklyContractHours}
                      className="h-7 text-xs bg-zinc-900 border-zinc-800 w-16"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v !== u.weeklyContractHours) {
                          updateUserContractHours(u.id, v);
                        }
                      }}
                    />
                    <span className="text-xs text-zinc-500">h/wk</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PTO */}
      {activeTab === "pto" && (
        <AdminPtoForm users={users} />
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
              Also runs automatically daily at 5:30 PM ET (21:30 UTC).
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

      {/* Report Hub */}
      {activeTab === "hub" && (
        <div className="space-y-6">
          <p className="text-sm text-zinc-400">
            Manage the public report hub link and view auto-generated snapshots.
          </p>

          {/* Shareable link */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Link2 className="h-3.5 w-3.5" />
              Shareable Link
            </div>
            {hubToken ? (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-zinc-800 px-3 py-2 text-[12px] text-zinc-300 font-mono">
                    {typeof window !== "undefined" ? `${window.location.origin}/hub/${hubToken}` : `/hub/${hubToken}`}
                  </code>
                  <button
                    onClick={copyHubLink}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-[12px] text-zinc-400 transition hover:border-lime-400/30 hover:text-lime-400"
                  >
                    {hubCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {hubCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600">
                  This link is permanent — Michael can bookmark it and it will always work.
                </p>
              </>
            ) : (
              <p className="text-[12px] text-zinc-600">Loading…</p>
            )}
          </div>

          {/* Manual generation */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Generate Report Now</p>
            <p className="text-[12px] text-zinc-500">
              Weekly runs automatically every Friday at 10pm EST. Monthly runs on the last day of each month. Use these to generate on demand.
            </p>

            {/* Include hidden users toggle (admin contractor view) */}
            <label className="flex items-center gap-2 cursor-pointer select-none w-fit rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 hover:border-amber-400/30 transition">
              <input
                type="checkbox"
                checked={hubIncludeHidden}
                onChange={(e) => setHubIncludeHidden(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              <span className={cn("text-[12px]", hubIncludeHidden ? "text-amber-400" : "text-zinc-400")}>
                Include hidden users (e.g. contractors)
              </span>
              {hubIncludeHidden && (
                <span className="text-[10px] uppercase tracking-wider text-amber-400/80 font-mono">
                  ON
                </span>
              )}
            </label>

            <div className="flex flex-wrap gap-2">
              {([
                { key: "this-week", label: "This week", color: "hover:border-violet-400/30 hover:text-violet-400" },
                { key: "last-week", label: "Last week", color: "hover:border-violet-400/30 hover:text-violet-400" },
                { key: "this-month", label: "This month", color: "hover:border-lime-400/30 hover:text-lime-400" },
                { key: "last-month", label: "Last month", color: "hover:border-lime-400/30 hover:text-lime-400" },
              ] as const).map(({ key, label, color }) => (
                <Button
                  key={key}
                  onClick={() => handleGenerate(key)}
                  disabled={generating !== null}
                  size="sm"
                  variant="outline"
                  className={cn("border-zinc-700 text-zinc-400", color)}
                >
                  <Play className={cn("mr-2 h-3.5 w-3.5", generating === key && "animate-pulse")} />
                  {generating === key ? "Generating…" : label}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600">
              Snapshots are frozen — once generated, you can&apos;t toggle hidden users for the same snapshot. Generate a new one with the checkbox flipped.
            </p>

            {/* Custom date range */}
            <div className="mt-4 pt-4 border-t border-zinc-800/70 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Custom date range</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-[160px] bg-zinc-900/60 text-[12px]"
                  aria-label="From"
                />
                <span className="text-[12px] text-zinc-600">→</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-[160px] bg-zinc-900/60 text-[12px]"
                  aria-label="To"
                />
                <Button
                  onClick={() => handleGenerate("custom")}
                  disabled={generating !== null || !customFrom || !customTo || customFrom > customTo}
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-400 hover:border-sky-400/30 hover:text-sky-400"
                >
                  <Play className={cn("mr-2 h-3.5 w-3.5", generating === "custom" && "animate-pulse")} />
                  {generating === "custom" ? "Generating…" : "Generate"}
                </Button>
              </div>
              <p className="text-[11px] text-zinc-600">
                Type is auto-set: ≤ 7 days → Weekly, otherwise Monthly.
              </p>
            </div>
          </div>

          {/* Snapshots list */}
          {hubSnapshots.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-zinc-600">No reports yet. Generate one above or wait for the automatic cron.</p>
          ) : (
            <div className="space-y-6">
              {(["AUTO", "MANUAL"] as const).map((src) => {
                const group = hubSnapshots.filter((s) => s.source === src);
                if (group.length === 0) return null;
                return (
                  <div key={src} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {src === "AUTO" ? "Automated Reports" : "Custom Reports"} ({group.length})
                    </p>
                    {group.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                            s.type === "WEEKLY" ? "bg-violet-400/10 text-violet-400" : "bg-lime-400/10 text-lime-400"
                          )}>
                            {s.type === "WEEKLY" ? "Weekly" : "Monthly"}
                          </span>
                          <span className="text-[13px] text-zinc-300">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-zinc-600">
                            {new Date(s.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <button
                            onClick={() => deleteSnapshot(s.id, s.label)}
                            className="rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
