import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { importProducts, previewProductImport, type ProductImportPreview, type ProductImportResult } from './api';

const STATUS_STYLE: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700',
  skipped_duplicate: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
};

export function ProductImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  function close() {
    setFile(null); setPreview(null); setResult(null); setError(''); setBusy(false);
    onClose();
  }

  async function choose(next: File | null) {
    setFile(next); setPreview(null); setResult(null); setError('');
    if (!next) return;
    setBusy(true);
    try { setPreview(await previewProductImport(next)); } catch (e: any) { setError(e.data?.errors?.file?.[0] ?? e.message); } finally { setBusy(false); }
  }

  async function run() {
    if (!file) return;
    setBusy(true); setError('');
    try {
      setResult(await importProducts(file));
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) { setError(e.data?.errors?.file?.[0] ?? e.message); } finally { setBusy(false); }
  }

  const statusLabel = (status: string) => t(`products.import_status_${status}`);

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={close}>
    <div onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-start justify-between">
        <div><h2 className="text-xl font-bold text-slate-900">{t('products.import_title')}</h2><p className="mt-1 text-sm text-slate-500">{t('products.import_help')}</p></div>
        <button type="button" onClick={close} className="text-slate-400 hover:text-slate-700" aria-label={t('common.cancel')}>✕</button>
      </div>

      {!result && <input type="file" accept=".xlsx,.csv" disabled={busy} onChange={(e) => choose(e.target.files?.[0] ?? null)} className="mb-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium" />}
      {busy && <p className="mb-3 text-sm text-slate-500">{t('products.import_working')}</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {preview && <div className="min-h-0 flex-1 overflow-auto">
        <p className="mb-3 text-sm font-medium text-slate-700">{t('products.import_summary_preview', { create: preview.summary.create, skipped: preview.summary.skipped_duplicate, errors: preview.summary.error })}</p>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">{t('products.import_col_row')}</th><th className="px-3 py-2">{t('products.name')}</th><th className="px-3 py-2">{t('products.import_col_price')}</th><th className="px-3 py-2">{t('products.import_col_photos')}</th><th className="px-3 py-2">{t('products.import_col_result')}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{preview.rows.map((row) => <tr key={row.row} className="align-top">
            <td className="px-3 py-2 text-slate-500">{row.row}</td>
            <td className="px-3 py-2 font-medium text-slate-900">{row.name || '—'}{row.variant && <span className="block text-xs font-normal text-slate-500">{row.variant}</span>}</td>
            <td className="px-3 py-2">{row.price}</td>
            <td className="px-3 py-2 text-xs text-slate-600">{row.photos.length === 0 ? '—' : row.photos.map((p) => <span key={p.slot} className="block">{p.slot}. {p.source === 'library' ? t('products.import_photo_library') : t('products.import_photo_url')}</span>)}</td>
            <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}>{statusLabel(row.status)}</span>
              {[...row.reasons, ...row.warnings].map((message, index) => <span key={index} className={`mt-1 block text-xs ${row.reasons.includes(message) ? 'text-red-700' : 'text-slate-500'}`}>{message}</span>)}</td>
          </tr>)}</tbody>
        </table>
      </div>}

      {result && <div className="min-h-0 flex-1 space-y-3 overflow-auto text-sm">
        <p className="font-medium text-slate-900">{t('products.import_summary_done', { created: result.created.length, skipped: result.skipped.length, failed: result.failed.length })}</p>
        {result.created.length > 0 && <div><p className="font-medium text-emerald-700">{t('products.import_created')}</p><ul className="list-disc pl-5 text-slate-700">{result.created.map((c) => <li key={c.id}>{c.name}</li>)}</ul></div>}
        {result.skipped.length > 0 && <div><p className="font-medium text-amber-700">{t('products.import_skipped')}</p><ul className="list-disc pl-5 text-slate-700">{result.skipped.map((s) => <li key={s.row}>{t('products.import_col_row')} {s.row}: {s.name} — {s.reason}</li>)}</ul></div>}
        {result.failed.length > 0 && <div><p className="font-medium text-red-700">{t('products.import_failed')}</p><ul className="list-disc pl-5 text-slate-700">{result.failed.map((f) => <li key={f.row}>{t('products.import_col_row')} {f.row}: {f.name || '—'} — {f.reasons.join(' ')}</li>)}</ul></div>}
        {result.photo_warnings.length > 0 && <div><p className="font-medium text-slate-700">{t('products.import_photo_warnings')}</p><ul className="list-disc pl-5 text-slate-700">{result.photo_warnings.map((w, index) => <li key={index}>{w.name}: {w.message}</li>)}</ul></div>}
      </div>}

      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={close}>{result ? t('products.import_close') : t('common.cancel')}</Button>
        {preview && <Button type="button" variant="primary" disabled={busy || preview.summary.create === 0} onClick={run}>{t('products.import_confirm', { count: preview.summary.create })}</Button>}
      </div>
    </div>
  </div>;
}
