"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/i18n-context";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { inputClass } from "@/lib/styles";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  approved: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const t = useT();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("VIEWER");
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      setError(t("settings.usersLoadError"));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName || null,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("settings.createError"));
      } else {
        setShowForm(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("VIEWER");
        await loadUsers();
      }
    } catch {
      setError(t("common.serverError"));
    }
    setSaving(false);
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role } : u)),
        );
      }
    } catch {
      setError(t("settings.roleChangeError"));
    }
  }

  async function handleApprove(userId: string) {
    if (!confirm(t("settings.approveConfirm"))) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, approved: true } : u)),
        );
      }
    } catch {
      setError(t("settings.roleChangeError"));
    }
  }

  async function handleReject(userId: string) {
    if (!confirm(t("settings.rejectConfirm"))) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch {
      setError(t("common.serverError"));
    }
  }

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

  const pendingUsers = users.filter((u) => !u.approved);
  const approvedUsers = users.filter((u) => u.approved);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title={t("settings.users")}
        subtitle={t("settings.usersDesc")}
        accent="blue"
        right={
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? t("common.cancel") : t("settings.addUser")}
          </button>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <p className="mb-4 font-medium">{t("settings.newUser")}</p>
          <form
            onSubmit={handleCreateUser}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                {t("common.name")}
              </label>
              <input
                className={inputClass}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Hong Gildong"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                {t("settings.email")} *
              </label>
              <input
                type="email"
                required
                className={inputClass}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@dcim.local"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                {t("settings.password")} *
              </label>
              <input
                type="password"
                required
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                {t("settings.role")}
              </label>
              <select
                className={inputClass}
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="VIEWER">Viewer</option>
                <option value="OPERATOR">Operator</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex justify-end md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? t("settings.creating") : t("settings.createUser")}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Pending Approval Section */}
      {pendingUsers.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-medium">{t("settings.pendingApproval")}</h2>
            <Badge variant="warning">{pendingUsers.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">{t("common.name")}</th>
                  <th className="px-3 py-2">{t("settings.email")}</th>
                  <th className="px-3 py-2">{t("settings.role")}</th>
                  <th className="px-3 py-2">{t("settings.createdAt")}</th>
                  <th className="px-3 py-2">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2 font-medium">
                      {user.name || "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-300">{user.email}</td>
                    <td className="px-3 py-2">
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          {t("settings.approve")}
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                        >
                          {t("settings.reject")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Approved Users */}
      <Card>
        {loading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">{t("common.name")}</th>
                  <th className="px-3 py-2">{t("settings.email")}</th>
                  <th className="px-3 py-2">{t("settings.role")}</th>
                  <th className="px-3 py-2">{t("common.status")}</th>
                  <th className="px-3 py-2">{t("settings.createdAt")}</th>
                  <th className="px-3 py-2">{t("settings.changeRole")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {approvedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2 font-medium">
                      {user.name || "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-300">{user.email}</td>
                    <td className="px-3 py-2">
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="active">
                        {t("settings.approved")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="OPERATOR">Operator</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
