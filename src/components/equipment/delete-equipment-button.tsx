"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Trash2 } from "lucide-react";

interface DeleteEquipmentButtonProps {
  equipmentId: string;
  equipmentName: string;
}

export function DeleteEquipmentButton({
  equipmentId,
  equipmentName,
}: DeleteEquipmentButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: "삭제 실패",
          message: data.error || "장비를 삭제하지 못했습니다.",
        });
        setDeleting(false);
        return;
      }
      toast({ type: "success", title: `${equipmentName} 삭제됨` });
      router.push("/infrastructure");
      router.refresh();
    } catch {
      toast({
        type: "error",
        title: "삭제 실패",
        message: "서버와 통신 중 오류가 발생했습니다.",
      });
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="mr-1.5 h-4 w-4" />
        삭제
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-gray-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-red-400">장비 삭제 확인</h3>
        <p className="mt-2 text-sm text-gray-300">
          <span className="font-mono font-medium text-white">{equipmentName}</span>
          을(를) 삭제하시겠습니까?
        </p>
        <p className="mt-1 text-xs text-gray-500">
          이 작업은 되돌릴 수 없으며, 관련 CPU/메모리/네트워크 정보도 함께 삭제됩니다.
        </p>

        <div className="mt-4">
          <label className="text-xs font-medium text-gray-400">삭제 사유 (선택)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 폐기 처리, 이전 완료 등"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setReason("");
            }}
            disabled={deleting}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "삭제 중..." : "삭제 확인"}
          </Button>
        </div>
      </div>
    </div>
  );
}
