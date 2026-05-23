/**
 * Compatibility shim: maps the shadcn `useToast()` API onto sonner.
 * Keeps `toast({ title, description, variant })` and `useToast().toast(...)`
 * working without editing every call site.
 */
import { toast as sonnerToast } from "sonner";
import type { ReactNode } from "react";

type Variant = "default" | "destructive" | string;

interface ToastInput {
  title?: ReactNode;
  description?: ReactNode;
  variant?: Variant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

function reactNodeToString(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  // For ReactElements / arrays we let sonner render via the `description` slot
  return String(node);
}

function toast(input: ToastInput | string) {
  if (typeof input === "string") {
    return { id: String(sonnerToast(input)), dismiss: () => {}, update: () => {} };
  }
  const { title, description, variant, duration, action } = input;
  const opts: Record<string, unknown> = {};
  if (description != null) opts.description = description as ReactNode;
  if (duration != null) opts.duration = duration;
  if (action) opts.action = { label: action.label, onClick: action.onClick };

  const message = (title as ReactNode) ?? (description as ReactNode) ?? "";
  let id: string | number;
  if (variant === "destructive") {
    id = sonnerToast.error(message as string, opts);
  } else {
    id = sonnerToast(message as string, opts);
  }
  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {},
  };
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    toasts: [] as never[],
  };
}

export { useToast, toast };
