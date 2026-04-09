"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New user form
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
      setError("사용자 목록을 불러올 수 없습니다.");
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
        setError(data.error || "생성에 실패했습니다.");
      } else {
        setShowForm(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("VIEWER");
        await loadUsers();
      }
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
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
          prev.map((u) => (u.id === userId ? { ...u, role } : u))
        );
      }
    } catch {
      setError("역할 변경에 실패했습니다.");
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

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">사용자 관리</h1>
          <p className="mt-1 text-sm text-gray-400">
            시스템 사용자 계정 및 역할을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "취소" : "+ 사용자 추가"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* New User Form */}
      {showForm && (
        <Card>
          <p className="mb-4 font-medium">새 사용자 등록</p>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-300">이름</label>
              <input
                className={inputClass}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">이메일 *</label>
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
              <label className="mb-1 block text-sm text-gray-300">비밀번호 *</label>
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
              <label className="mb-1 block text-sm text-gray-300">역할</label>
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
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "생성 중..." : "사용자 생성"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* User List */}
      <Card>
        {loading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">이메일</th>
                  <th className="px-3 py-2">역할</th>
                  <th className="px-3 py-2">생성일</th>
                  <th className="px-3 py-2">역할 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
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
                      {new Date(user.createdAt).toLocaleDateString("ko-KR")}
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
