import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-slate-900/5 p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-5 ring-4 ring-red-50">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-[280px]">
            {message}
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 w-full">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isLoading}
            className="w-full sm:w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button 
            type="button" 
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 border border-red-600 hover:bg-red-700 shadow-sm transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading && (
              <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {t('common.delete', { defaultValue: 'Delete' })}
          </button>
        </div>
      </div>
    </div>
  );
}
