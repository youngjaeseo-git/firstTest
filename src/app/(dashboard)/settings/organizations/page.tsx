"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";
import { inputClass } from "@/lib/styles";
import {
  Building2,
  Users,
  Server,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  X,
  UserPlus,
  Search,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────── */

interface OrgSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { members: number; equipment: number };
}

interface MemberRow {
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string; role: string };
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

/* ── Component ──────────────────────────────────────────── */

export default function OrganizationsPage() {
  const t = useT();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  // ── State ──
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Expanded org (members section)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberRole, setMemberRole] = useState("VIEWER");

  /* ── Data loading ─────────────────────────────────────── */

  const loadOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (res.status === 403) {
        setError(t("org.forbidden"));
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.items ?? []);
      } else {
        setError(t("org.loadError"));
      }
    } catch {
      setError(t("common.serverError"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (userRole !== "ADMIN") return;
    loadOrgs();
  }, [sessionStatus, userRole, loadOrgs]);

  const loadMembers = useCallback(
    async (orgId: string) => {
      setMembersLoading(true);
      try {
        const res = await fetch(`/api/organizations/${orgId}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.items ?? []);
        }
      } catch {
        setError(t("common.serverError"));
      }
      setMembersLoading(false);
    },
    [t],
  );

  const loadUsers = useCallback(async () => {
    if (usersLoaded) return;
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setAllUsers(await res.json());
        setUsersLoaded(true);
      }
    } catch {
      /* ignore */
    }
  }, [usersLoaded]);

  /* ── Handlers ─────────────────────────────────────────── */

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("org.createError"));
      } else {
        setShowCreate(false);
        setNewName("");
        setNewDesc("");
        await loadOrgs();
      }
    } catch {
      setError(t("common.serverError"));
    }
    setCreating(false);
  }

  async function handleUpdate(orgId: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDesc || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("org.updateError"));
      } else {
        setEditingId(null);
        await loadOrgs();
      }
    } catch {
      setError(t("common.serverError"));
    }
    setSaving(false);
  }

  async function handleDelete(orgId: string) {
    if (!confirm(t("org.deleteConfirm"))) return;
    setError("");
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("org.deleteError"));
      } else {
        if (expandedId === orgId) setExpandedId(null);
        await loadOrgs();
      }
    } catch {
      setError(t("common.serverError"));
    }
  }

  function handleToggleExpand(orgId: string) {
    if (expandedId === orgId) {
      setExpandedId(null);
      setShowAddMember(false);
    } else {
      setExpandedId(orgId);
      setShowAddMember(false);
      loadMembers(orgId);
    }
  }

  function handleStartEdit(org: OrgSummary) {
    setEditingId(org.id);
    setEditName(org.name);
    setEditDesc(org.description ?? "");
  }

  async function handleAddMember(userId: string) {
    if (!expandedId) return;
    setAddingMember(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${expandedId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: memberRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("org.addMemberError"));
      } else {
        setShowAddMember(false);
        setUserSearch("");
        setMemberRole("VIEWER");
        await loadMembers(expandedId);
        await loadOrgs();
      }
    } catch {
      setError(t("common.serverError"));
    }
    setAddingMember(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!expandedId) return;
    if (!confirm(t("org.removeMemberConfirm"))) return;
    setError("");
    try {
      const res = await fetch(
        `/api/organizations/${expandedId}/members?userId=${userId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await loadMembers(expandedId);
        await loadOrgs();
      } else {
        const data = await res.json();
        setError(data.error || t("org.removeMemberError"));
      }
    } catch {
      setError(t("common.serverError"));
    }
  }

  /* ── Access guard ─────────────────────────────────────── */

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  if (userRole !== "ADMIN") {
    return (
      <div className="space-y-6">
        <PageHeader icon={Building2} title={t("org.title")} accent="blue" />
        <Card>
          <p className="text-center text-red-400">{t("org.forbidden")}</p>
        </Card>
      </div>
    );
  }

  /* ── Filtered user list for add-member ────────────────── */

  const memberUserIds = new Set(members.map((m) => m.userId));
  const filteredUsers = allUsers.filter(
    (u) =>
      !memberUserIds.has(u.id) &&
      (u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase())),
  );

  /* ── Render ──────────────────────────────────────────── */

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "critical" as const;
      case "OPERATOR":
        return "warning" as const;
      default:
        return "info" as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title={t("org.title")}
        subtitle={t("org.subtitle")}
        accent="blue"
        right={
          <Button
            variant={showCreate ? "secondary" : "default"}
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? t("common.cancel") : t("org.addOrg")}
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Create form ── */}
      {showCreate && (
        <Card>
          <p className="mb-4 font-medium">{t("org.newOrg")}</p>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-300">
                  {t("common.name")} *
                </label>
                <input
                  required
                  className={inputClass}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("org.namePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">
                  {t("common.description")}
                </label>
                <input
                  className={inputClass}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t("org.descPlaceholder")}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 shadow-green-600/20"
              >
                {creating ? t("common.saving") : t("org.createOrg")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Organization list ── */}
      {loading ? (
        <Card>
          <p className="text-center text-gray-400">{t("common.loading")}</p>
        </Card>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("org.empty")}
          description={t("org.emptyDesc")}
        />
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => {
            const isExpanded = expandedId === org.id;
            const isEditing = editingId === org.id;

            return (
              <Card key={org.id} className="overflow-hidden">
                {/* ── Org header ── */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleExpand(org.id)}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </Button>

                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => handleToggleExpand(org.id)}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          className={cn(inputClass, "max-w-xs")}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input
                          className={cn(inputClass, "max-w-sm")}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder={t("common.description")}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdate(org.id);
                          }}
                          disabled={saving}
                          className="bg-green-600 hover:bg-green-500 shadow-green-600/20"
                        >
                          {saving ? t("common.saving") : t("common.save")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-semibold text-gray-100">
                          {org.name}
                        </h3>
                        {org.description && (
                          <p className="mt-0.5 text-sm text-gray-400">
                            {org.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats badges */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Users className="h-4 w-4" />
                      <span>{org._count.members}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Server className="h-4 w-4" />
                      <span>{org._count.equipment}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action buttons */}
                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(org);
                        }}
                        className="h-8 w-8 hover:text-blue-400"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(org.id);
                        }}
                        className="h-8 w-8 hover:text-red-400"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Expanded: Members + Equipment ── */}
                {isExpanded && (
                  <div className="mt-4 border-t border-gray-800 pt-4">
                    {/* Members section */}
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        <Users className="h-4 w-4 text-blue-400" />
                        {t("org.members")} ({members.length})
                      </h4>
                      <Button
                        variant={showAddMember ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => {
                          setShowAddMember(!showAddMember);
                          if (!usersLoaded) loadUsers();
                        }}
                      >
                        {showAddMember ? (
                          <>
                            <X className="mr-1 h-3.5 w-3.5" />
                            {t("common.cancel")}
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-1 h-3.5 w-3.5" />
                            {t("org.addMember")}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Add member form */}
                    {showAddMember && (
                      <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <input
                              className={cn(inputClass, "pl-9")}
                              placeholder={t("org.searchUserPlaceholder")}
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                            />
                          </div>
                          <select
                            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
                            value={memberRole}
                            onChange={(e) => setMemberRole(e.target.value)}
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="OPERATOR">Operator</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                        {filteredUsers.length === 0 ? (
                          <p className="py-2 text-center text-xs text-gray-500">
                            {t("org.noUsersFound")}
                          </p>
                        ) : (
                          <div className="max-h-40 space-y-1 overflow-y-auto">
                            {filteredUsers.slice(0, 10).map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center justify-between rounded px-3 py-1.5 text-sm hover:bg-gray-700/50"
                              >
                                <div>
                                  <span className="text-gray-200">
                                    {u.name || u.email}
                                  </span>
                                  {u.name && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      {u.email}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  size="icon"
                                  onClick={() => handleAddMember(u.id)}
                                  disabled={addingMember}
                                  className="h-7 w-7"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Members table */}
                    {membersLoading ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        {t("common.loading")}
                      </p>
                    ) : members.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-500">
                        {t("org.noMembers")}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                              <th className="px-3 py-2">{t("common.name")}</th>
                              <th className="px-3 py-2">
                                {t("settings.email")}
                              </th>
                              <th className="px-3 py-2">
                                {t("org.orgRole")}
                              </th>
                              <th className="px-3 py-2">
                                {t("org.joinedAt")}
                              </th>
                              <th className="px-3 py-2">
                                {t("common.actions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {members.map((m) => (
                              <tr key={m.userId}>
                                <td className="px-3 py-2 font-medium text-gray-200">
                                  {m.user.name || "-"}
                                </td>
                                <td className="px-3 py-2 text-gray-300">
                                  {m.user.email}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant={roleBadgeVariant(m.role)}>
                                    {m.role}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-400">
                                  {new Date(m.joinedAt).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveMember(m.userId)
                                    }
                                  >
                                    {t("common.remove")}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Equipment count */}
                    <div className="mt-4 border-t border-gray-800 pt-3">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Server className="h-4 w-4 text-green-400" />
                        <span>
                          {t("org.equipmentCount")}: {org._count.equipment}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
