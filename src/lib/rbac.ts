import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; email: string; name: string; role: Role };
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export function canEdit(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

export function canDelete(role: Role): boolean {
  return role === "ADMIN";
}

export function canChangeStatus(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

export function canAcknowledgeAlert(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * Power control (Redfish reset, power on/off) is destructive — restrict
 * to ADMIN and OPERATOR. VIEWERs can still see current power state.
 */
export function canControlPower(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}
