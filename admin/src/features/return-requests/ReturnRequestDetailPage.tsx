import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { previewReturnRequest, ReturnRequestPreview, useAddReturnTracking, useApproveLowValueWaiver, useApproveReturnRequest, useCompleteReturnRequest, useRejectReturnRequest, useReturnRequest } from './api';

type Action = 'approve' | 'reject' | 'complete' | 'tracking' | 'waiver' | null;

export function ReturnRequestDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const query = useReturnRequest(id);
  const approveMutation = useApproveReturnRequest();
  const rejectMutation = useRejectReturnRequest();
  const completeMutation = useCompleteReturnRequest();
  const trackingMutation = useAddReturnTracking();
  const waiverMutation = useApproveLowValueWaiver();
  const [action, setAction] = useState<Action>(null);
  const [rmaAddress, setRmaAddress] = useState('');
  const [feeWaived, setFeeWaived] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState<'manual' | 'ups' | 'usps' | 'fedex' | 'dhl'>('manual');
  const [preview, setPreview] = useState<ReturnRequestPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const request = query.data;
  const close = () => setAction(null);

  useEffect(() => {
    if (action !== 'approve' || !request) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(false);
    previewReturnRequest(request.id, { fee_waived: feeWaived }).then(
      (value) => { if (!cancelled) setPreview(value); },
      () => { if (!cancelled) setPreviewError(true); },
    );
    return () => { cancelled = true; };
  }, [action, feeWaived, request?.id]);

  async function submit() {
    if (!request || !action) return;
    if (action === 'approve' && !rmaAddress.trim()) { toast.error(t('return_requests.rma_address_required')); return; }
    if (action === 'tracking' && !trackingNumber.trim()) { toast.error(t('return_requests.tracking_number_required')); return; }
    const amount = refundAmount.trim() === '' ? undefined : Number(refundAmount);
    if (action === 'approve' && amount !== undefined && (!(amount >= 0) || Number.isNaN(amount))) { toast.error(t('return_requests.refund_amount_invalid')); return; }
    try {
      if (action === 'approve') await approveMutation.mutateAsync({ id: request.id, payload: { rma_address: rmaAddress.trim(), fee_waived: feeWaived || undefined, refund_amount: amount, admin_note: adminNote.trim() || undefined } });
      if (action === 'reject') await rejectMutation.mutateAsync({ id: request.id, payload: { admin_note: adminNote.trim() || undefined } });
      if (action === 'complete') await completeMutation.mutateAsync({ id: request.id });
      if (action === 'tracking') await trackingMutation.mutateAsync({ id: request.id, payload: { tracking_number: trackingNumber.trim(), carrier } });
      if (action === 'waiver') await waiverMutation.mutateAsync({ id: request.id, payload: { admin_note: adminNote.trim() || undefined } });
      toast.success(t(`return_requests.${action}_success`));
      close();
    } catch (error: any) { toast.error(error.message || t('common.error_occurred')); }
  }

  if (query.isLoading) return <PageState text={t('common.loading')} />;
  if (query.isError || !request) return <PageState text={query.isError ? (query.error as Error).message : t('return_requests.not_found')} error />;
  const loading = approveMutation.isPending || rejectMutation.isPending || completeMutation.isPending || trackingMutation.isPending || waiverMutation.isPending;
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <Button variant="secondary" onClick={() => navigate('/return-requests')}>← {t('return_requests.back')}</Button>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">{request.order_reference ?? request.id}</h1><p className="mt-1 text-sm text-slate-500">{t(`return_requests.status_${request.status}`)}</p></div><div className="flex gap-2">{request.status === 'requested' && <><Button onClick={() => setAction('approve')}>{t('return_requests.approve')}</Button><Button variant="danger" onClick={() => setAction('reject')}>{t('return_requests.reject')}</Button>{request.low_value_auto_waive_eligible === true && <Button onClick={() => setAction('waiver')}>{t('return_requests.refund_no_return_required')}</Button>}</>}{request.status === 'approved' && <><Button onClick={() => setAction('complete')}>{t('return_requests.complete')}</Button>{!request.return_tracking_number && <Button variant="secondary" onClick={() => setAction('tracking')}>{t('return_requests.add_tracking')}</Button>}</>}</div></div>
    <section className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"><Detail label={t('return_requests.reason')} value={request.reason}/><Detail label={t('return_requests.status')} value={t(`return_requests.status_${request.status}`)}/><Detail label={t('return_requests.customer_note')} value={request.customer_note}/><Detail label={t('return_requests.admin_note')} value={request.admin_note}/><Detail label={t('return_requests.rma_address')} value={request.rma_address}/><Detail label={t('return_requests.refund_amount')} value={displayMoney(request.refund_amount)}/><Detail label={t('return_requests.restocking_fee')} value={displayMoney(request.restocking_fee)}/><Detail label={t('return_requests.fee_waived')} value={t(request.fee_waived ? 'return_requests.yes' : 'return_requests.no')}/><Detail label={t('return_requests.requested_at')} value={dateValue(request.requested_at)}/><Detail label={t('return_requests.approved_at')} value={dateValue(request.approved_at)}/><Detail label={t('return_requests.rejected_at')} value={dateValue(request.rejected_at)}/><Detail label={t('return_requests.completed_at')} value={dateValue(request.completed_at)}/></section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">{t('return_requests.items')}</h2><div className="mt-4 divide-y">{request.items.map((item) => <div key={item.order_line_id} className="flex items-center justify-between py-3 text-sm"><span>{item.description ?? '—'}{item.option ? ` (${item.option})` : ''}</span><span>{item.quantity}</span></div>)}</div></section>
    <ConfirmModal open={action !== null} title={action ? t(`return_requests.${action}`) : ''} onClose={close} onConfirm={submit} loading={loading}>{action === 'approve' && <><label className="block text-sm font-medium text-slate-700">{t('return_requests.rma_address')}<textarea value={rmaAddress} onChange={(event) => setRmaAddress(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={feeWaived} onChange={(event) => setFeeWaived(event.target.checked)} />{t('return_requests.fee_waived')}</label><label className="mt-3 block text-sm font-medium text-slate-700">{t('return_requests.refund_amount')}<input type="number" min="0" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>{preview && <div className="mt-3 text-sm text-slate-600"><p>{t('return_requests.item_value')}: {displayMoney(preview.item_subtotal)}</p><p>{t('return_requests.restocking_fee')}: {displayMoney(preview.restocking_fee)}</p><p>{t('return_requests.estimated_refund')}: {displayMoney(preview.estimated_refund)}</p></div>}{previewError && <p className="mt-3 text-xs text-slate-500">{t('return_requests.preview_error')}</p>}</>}{action === 'tracking' && <><label className="block text-sm font-medium text-slate-700">{t('return_requests.tracking_number')}<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="mt-3 block text-sm font-medium text-slate-700">{t('return_requests.carrier')}<select value={carrier} onChange={(event) => setCarrier(event.target.value as typeof carrier)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2">{(['manual', 'ups', 'usps', 'fedex', 'dhl'] as const).map((value) => <option key={value} value={value}>{t(`return_requests.carrier_${value}`)}</option>)}</select></label></>}{(action === 'approve' || action === 'reject' || action === 'waiver') && <label className="mt-3 block text-sm font-medium text-slate-700">{t('return_requests.admin_note')}<textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>}<p className="mt-3 text-sm text-slate-500">{action && t(`return_requests.confirm_${action}`)}</p></ConfirmModal>
  </div>;
}
function displayMoney(value: number | null) { return value == null ? '—' : `$${value.toFixed(2)}`; }
function dateValue(value: string | null) { return value ? new Date(value).toLocaleString() : '—'; }
function PageState({ text, error = false }: { text: string; error?: boolean }) { return <div className={`p-8 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</div>; }
function Detail({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value ?? '—'}</dd></div>; }
function ConfirmModal({ open, title, onClose, onConfirm, loading, children }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void; loading: boolean; children: React.ReactNode }) { const { t } = useTranslation(); if (!open) return null; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold text-slate-900">{title}</h2><div className="mt-4">{children}</div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={loading} onClick={onClose}>{t('common.cancel')}</Button><Button disabled={loading} onClick={onConfirm}>{t('common.confirm')}</Button></div></div></div>; }
