"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Power,
  PowerOff,
  RotateCw,
  Zap,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type PowerState = "On" | "Off" | "PoweringOn" | "PoweringOff" | "Unknown";

type ResetType =
  | "On"
  | "ForceOff"
  | "GracefulShutdown"
  | "GracefulRestart"
  | "ForceRestart";

interface PowerActionDef {
  type: ResetType;
  label: string;
  Icon: typeof Power;
  variant: "neutral" | "warning" | "danger";
  description: string;
}

const ACTIONS: PowerActionDef[] = [
  {
    type: "GracefulRestart",
    label: "Graceful Restart",
    Icon: RotateCw,
    variant: "neutral",
    description: "Asks the OS to reboot cleanly. Safest option.",
  },
  {
    type: "ForceRestart",
    label: "Force Restart",
    Icon: Zap,
    variant: "warning",
    description: "Hard reset via BMC. May lose unsaved state.",
  },
  {
    type: "GracefulShutdown",
    label: "Graceful Shutdown",
    Icon: PowerOff,
    variant: "warning",
    description: "Asks the OS to power off cleanly.",
  },
  {
    type: "ForceOff",
    label: "Force Off",
    Icon: PowerOff,
    variant: "danger",
    description: "Cuts power immediately. Use only when unresponsive.",
  },
  {
    type: "On",
    label: "Power On",
    Icon: Power,
    variant: "neutral",
    description: "Turns the system on.",
  },
];

interface Props {
  equipmentId: string;
  bmcHost: string | null;
  hostname: string | null;
  /** Whether the current viewer can issue power actions (role check). */
  canControl: boolean;
}

export function PowerConsoleCard({
  equipmentId,
  bmcHost,
  hostname,
  canControl,
}: Props) {
  const { toast } = useToast();
  const [state, setState] = useState<PowerState>("Unknown");
  const [stateError, setStateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<PowerActionDef | null>(null);

  const refresh = async () => {
    if (!bmcHost) {
      setStateError("No BMC IP configured");
      setState("Unknown");
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/power`);
      const json = await res.json();
      setState(json.state || "Unknown");
      setStateError(json.error || null);
    } catch {
      setStateError("Failed to query BMC");
      setState("Unknown");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, bmcHost]);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Power & Console</CardTitle>
        <button
          onClick={refresh}
          disabled={refreshing || !bmcHost}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800/80 hover:text-gray-200 disabled:opacity-40"
          title="Refresh power state"
          aria-label="Refresh power state"
        >
          <Loader2
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
        </button>
      </div>

      {!bmcHost ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-400">
          BMC IP is not configured for this equipment. Set it on the edit page
          to enable power control.
        </div>
      ) : (
        <>
          {/* Current state */}
          <div className="mt-4 flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                state === "On"
                  ? "bg-green-500/15 text-green-400 ring-green-500/30"
                  : state === "Off"
                    ? "bg-gray-700/40 text-gray-400 ring-gray-600/40"
                    : "bg-amber-500/15 text-amber-400 ring-amber-500/30",
              )}
            >
              <Power className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-100">{state}</p>
              <p className="text-xs text-gray-500">
                BMC: <span className="font-mono">{bmcHost}</span>
              </p>
            </div>
          </div>

          {stateError && (
            <p className="mt-2 text-xs text-amber-400">{stateError}</p>
          )}

          {/* Action grid */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACTIONS.map((action) => {
              const Icon = action.Icon;
              const colors =
                action.variant === "danger"
                  ? "border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/10 hover:border-red-500/50"
                  : action.variant === "warning"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/50"
                    : "border-gray-700/60 bg-gray-800/40 text-gray-300 hover:bg-gray-800/80 hover:border-gray-600";
              return (
                <button
                  key={action.type}
                  onClick={() => setConfirming(action)}
                  disabled={!canControl}
                  title={
                    canControl
                      ? action.description
                      : "Requires ADMIN or OPERATOR role"
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
                    colors,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-left">{action.label}</span>
                </button>
              );
            })}
          </div>

          {/* BMC Console link */}
          <div className="mt-4 border-t border-gray-800 pt-4">
            <a
              href={`https://${bmcHost}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/10 hover:border-blue-500/50"
            >
              <ExternalLink className="h-4 w-4" />
              Open BMC Console (KVM)
            </a>
            <p className="mt-1.5 text-[11px] text-gray-500">
              Opens the vendor BMC web UI in a new tab — full HTML5 KVM,
              virtual media, and serial-over-LAN.
            </p>
          </div>
        </>
      )}

      {/* Confirmation modal */}
      <ConfirmModal
        action={confirming}
        hostname={hostname}
        equipmentId={equipmentId}
        onClose={() => setConfirming(null)}
        onSuccess={() => {
          toast({
            type: "success",
            title: "Power action sent",
            message: `${confirming?.label} → ${hostname || "equipment"}`,
          });
          setConfirming(null);
          // Allow BMC a moment, then refresh
          setTimeout(refresh, 2_000);
        }}
        onError={(message) => {
          toast({ type: "error", title: "Power action failed", message });
        }}
      />
    </Card>
  );
}

interface ConfirmModalProps {
  action: PowerActionDef | null;
  hostname: string | null;
  equipmentId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function ConfirmModal({
  action,
  hostname,
  equipmentId,
  onClose,
  onSuccess,
  onError,
}: ConfirmModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (action) {
      setConfirmText("");
      setReason("");
      setTicketRef("");
    }
  }, [action]);

  const expectedConfirm = hostname || "CONFIRM";
  const canSubmit =
    confirmText === expectedConfirm && reason.trim().length >= 3;

  const submit = async () => {
    if (!action || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action.type,
          reason: reason.trim(),
          ticketRef: ticketRef.trim() || null,
        }),
      });
      const json = await res.json();
      console.log("[BMC Power Response]", JSON.stringify(json, null, 2));
      if (!res.ok) {
        onError(json.error || "Request failed");
        return;
      }
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={action !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
          {action && (
            <>
              <div className="mb-4 flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1",
                    action.variant === "danger"
                      ? "bg-red-500/15 text-red-400 ring-red-500/30"
                      : action.variant === "warning"
                        ? "bg-amber-500/15 text-amber-400 ring-amber-500/30"
                        : "bg-blue-500/15 text-blue-400 ring-blue-500/30",
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-semibold text-gray-100">
                    Confirm: {action.label}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-gray-400">
                    {action.description}
                  </Dialog.Description>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">
                    Type{" "}
                    <span className="font-mono text-amber-400">
                      {expectedConfirm}
                    </span>{" "}
                    to confirm
                  </span>
                  <input
                    autoFocus
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono text-gray-100 focus:border-blue-500 focus:outline-none"
                    placeholder={expectedConfirm}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-gray-400">
                    Reason <span className="text-red-400">*</span>
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Kernel patch reboot, scheduled OPS-1234"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-gray-400">
                    Ticket reference (optional)
                  </span>
                  <input
                    type="text"
                    value={ticketRef}
                    onChange={(e) => setTicketRef(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono text-gray-100 focus:border-blue-500 focus:outline-none"
                    placeholder="OPS-1234"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={!canSubmit || submitting}
                  className={cn(
                    action.variant === "danger" &&
                      "bg-red-600 hover:bg-red-700",
                    action.variant === "warning" &&
                      "bg-amber-600 hover:bg-amber-700",
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    `Confirm ${action.label}`
                  )}
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
