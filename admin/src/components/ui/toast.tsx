import { useEffect, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const toastQueue: Toast[] = [];
const listeners = new Set<(toasts: Toast[]) => void>();

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleUpdate = (updatedToasts: Toast[]) => {
      setToasts(updatedToasts);
    };
    listeners.add(handleUpdate);
    return () => listeners.delete(handleUpdate);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, message, type };
    toastQueue.push(toast);
    notifyListeners();

    setTimeout(() => {
      const index = toastQueue.findIndex((t) => t.id === id);
      if (index > -1) {
        toastQueue.splice(index, 1);
        notifyListeners();
      }
    }, 3000);
  };

  return { toasts, showToast };
}

function notifyListeners() {
  listeners.forEach((listener) => listener([...toastQueue]));
}

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg text-sm font-medium text-white shadow-lg animate-fade-in ${
            toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'error'
                ? 'bg-red-600'
                : 'bg-blue-600'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
