import { useToastStore } from "@/stores/toast-store";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const styleMap = {
  error: {
    container: "border-(--color-error) bg-(--color-error)/15",
    icon: "text-(--color-error)",
    text: "text-(--color-error)",
    close: "hover:bg-(--color-error)/20 text-(--color-error)",
  },
  warning: {
    container: "border-(--color-warning) bg-(--color-warning)/15",
    icon: "text-(--color-warning)",
    text: "text-(--color-warning)",
    close: "hover:bg-(--color-warning)/20 text-(--color-warning)",
  },
  info: {
    container: "border-(--color-accent) bg-(--color-accent)/15",
    icon: "text-(--color-accent)",
    text: "text-(--color-accent)",
    close: "hover:bg-(--color-accent)/20 text-(--color-accent)",
  },
  success: {
    container: "border-(--color-success) bg-(--color-success)/15",
    icon: "text-(--color-success)",
    text: "text-(--color-success)",
    close: "hover:bg-(--color-success)/20 text-(--color-success)",
  },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3" role="log" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        const styles = styleMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-lg border-l-4 px-4 py-3.5 shadow-2xl backdrop-blur-sm ${styles.container} min-w-[320px] max-w-[440px] animate-[slideIn_0.2s_ease-out]`}
            role="alert"
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
            <p className={`flex-1 text-sm font-medium ${styles.text}`}>{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className={`shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100 ${styles.close}`}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
