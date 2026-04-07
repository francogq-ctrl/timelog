"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Check, X } from "lucide-react";
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

export default function AdminPage() {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newWorkType, setNewWorkType] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newActivityCat, setNewActivityCat] = useState("INTERNAL");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"types" | "activities" | "team" | "asana">("types");

  const fetchAll = useCallback(async () => {
    const [wt, act, usr] = await Promise.all([
      fetch("/api/admin/work-types").then((r) => r.json()),
      fetch("/api/admin/activities").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);
    setWorkTypes(wt);
    setActivities(act);
    setUsers(usr);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  async function addActivity() {
    if (!newActivity.trim()) return;
    await fetch("/api/admin/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newActivity.trim(), category: newActivityCat }),
    });
    setNewActivity("");
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

  async function syncAsana() {
    setSyncing(true);
    try {
      await fetch("/api/asana/sync", { method: "POST" });
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {activeTab === "activities" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Predefined activities for Internal, Admin and Training
          </p>
          <div className="flex gap-2">
            <Select value={newActivityCat} onValueChange={(v) => setNewActivityCat(v ?? "INTERNAL")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">Internal</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="TRAINING">Training</SelectItem>
              </SelectContent>
            </Select>
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
          {["INTERNAL", "ADMIN", "TRAINING"].map((cat) => {
            const catActivities = activities.filter((a) => a.category === cat);
            if (catActivities.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {cat}
                </h3>
                <div className="space-y-2">
                  {catActivities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                    >
                      <span className={cn("text-sm", !a.active && "text-zinc-500 line-through")}>
                        {a.name}
                      </span>
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
          <Button
            onClick={syncAsana}
            disabled={syncing}
            className="bg-lime-400 text-zinc-900 hover:bg-lime-300"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync now"}
          </Button>
          <p className="text-xs text-zinc-500">
            Sync also runs automatically every 6 hours.
          </p>
        </div>
      )}
    </div>
  );
}
