import { ToastType } from "@/types/admin";

export function ToastMessage({ type, message }: { type: ToastType; message: string }) {
  const style =
    type === "success"
      ? "border-accent/30 bg-accent/10 text-accent"
      : "border-danger/30 bg-danger/10 text-danger";

  return <div className={`fixed right-4 top-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${style}`}>{message}</div>;
}
