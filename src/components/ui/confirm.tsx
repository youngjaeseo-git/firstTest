"use client";

import {
  useState,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const isDanger = options?.variant === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {options && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              className={cn(
                "w-full max-w-md rounded-xl border bg-gray-900 p-6 shadow-2xl",
                isDanger ? "border-red-500/30" : "border-gray-700",
              )}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                {isDanger && (
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3
                    className={cn(
                      "text-lg font-semibold",
                      isDanger ? "text-red-400" : "text-gray-100",
                    )}
                  >
                    {options.title}
                  </h3>
                  {options.message && (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-gray-400">
                      {options.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => close(false)}>
                  {options.cancelLabel || "취소"}
                </Button>
                <Button
                  variant={isDanger ? "destructive" : "default"}
                  onClick={() => close(true)}
                  autoFocus
                >
                  {options.confirmLabel || "확인"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
