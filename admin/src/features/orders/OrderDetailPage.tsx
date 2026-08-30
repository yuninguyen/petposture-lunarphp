import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useOrder, useRefundOrder, useReturnOrder, type Order, type OrderAddress } from './api';

export function OrderDetailPage({ canRefund = true }: { canRefund?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const query = useOrder(id);
  const refundMutation = useRefundOrder();
  const returnMutation = useReturnOrder();
  const [refundOpen, setRefundOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const order = query.data;
  async function refund() { const numericAmount = amount.trim() === '' ? undefined : Number(amount); if (numericAmount !== undefined && (!(numericAmount > 0) || Number.isNaN(numericAmount))) { toast.error(t('orders.refund_amount_invalid')); return; } try { await refundMutation.mutateAsync({ id: order!.id, amount: numericAmount }); toast.success(t('orders.refund_success')); setRefundOpen(false); setAmount(''); } catch (error: any) { toast.error(error.message || t('common.error_occurred')); } }
  async function markReturned() { try { await returnMutation.mutateAsync({ id: order!.id }); toast.success(t('orders.return_success')); setReturnOpen(false); } catch (error: any) { toast.error(error.message || t('common.error_occurred')); } }
  if (query.isLoading) return <PageState text={t('common.loading')} />;
  if (query.isError || !order) return <PageState text={query.isError ? (query.error as Error).message : t('orders.not_found')} error />;
  const events = [...(order.order_events ?? [])].sort((left, right) => new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime());
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <Button variant="secondary" onClick={() => navigate('/orders')}>← {t('orders.back')}</Button>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">{order.reference}</h1><p className="mt-1 text-sm text-slate-500">{order.customer_email}</p></div><div className="flex gap-2">{canRefund && <Button variant="danger" onClick={() => setRefundOpen(true)}>{t('orders.refund')}</Button>}<Button variant="secondary" onClick={() => setReturnOpen(true)}>{t('orders.mark_returned')}</Button></div></div>
    <section className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"><Detail label={t('orders.total')} value={order.total.formatted}/><Detail label={t('orders.status')} value={order.status_label ?? order.status}/><Detail label={t('orders.payment_status')} value={order.payment_status_label ?? order.payment_status}/><Detail label={t('orders.fulfillment_status')} value={order.fulfillment_status_label ?? order.fulfillment_status}/><Detail label={t('orders.refund_status')} value={order.refund_status ?? '—'}/><Detail label={t('orders.refund_amount')} value={order.refund_amount == null ? '—' : String(order.refund_amount)}/>{order.coupon_code && <Detail label={t('orders.coupon')} value={order.coupon_code}/>}</section>
    <Section title={t('orders.items')}><div className="divide-y">{(order.lines ?? []).map((line) => <div key={line.id} className="flex items-center justify-between py-3 text-sm"><span>{line.description} × {line.quantity}</span><span>{line.total.toFixed(2)}</span></div>)}</div></Section>
    <div className="grid gap-6 md:grid-cols-2"><Section title={t('orders.shipping_address')}><Address address={order.shipping_address}/></Section><Section title={t('orders.billing_address')}><Address address={order.billing_address}/></Section></div>
    <Section title={t('orders.timeline')}><ol className="space-y-4">{events.map((event, index) => <li key={`${event.type}-${event.created_at}-${index}`} className="border-l-2 border-slate-200 pl-4"><p className="font-medium text-slate-900">{event.title}</p>{event.detail && <p className="text-sm text-slate-500">{event.detail}</p>}<p className="text-xs text-slate-400">{event.created_at ? new Date(event.created_at).toLocaleString() : '—'}</p></li>)}</ol></Section>
    <ConfirmModal open={refundOpen} title={t('orders.refund')} onClose={() => setRefundOpen(false)} onConfirm={refund} loading={refundMutation.isPending}><label className="block text-sm font-medium text-slate-700">{t('orders.refund_amount')}<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><p className="mt-2 text-sm text-slate-500">{t('orders.refund_full_amount_hint')}</p></ConfirmModal>
    <ConfirmModal open={returnOpen} title={t('orders.mark_returned')} onClose={() => setReturnOpen(false)} onConfirm={markReturned} loading={returnMutation.isPending}><p className="text-sm text-slate-500">{t('orders.return_confirm')}</p></ConfirmModal>
  </div>;
}
function PageState({ text, error = false }: { text: string; error?: boolean }) { return <div className={`p-8 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">{title}</h2><div className="mt-4">{children}</div></section>; }
function Address({ address }: { address?: OrderAddress }) { if (!address) return <span className="text-sm text-slate-500">—</span>; return <div className="text-sm text-slate-600"><p>{[address.first_name, address.last_name].filter(Boolean).join(' ')}</p><p>{address.line_one}</p>{address.line_two && <p>{address.line_two}</p>}<p>{[address.city, address.state, address.postcode].filter(Boolean).join(', ')}</p><p>{address.country}</p><p>{address.phone}</p></div>; }
function ConfirmModal({ open, title, onClose, onConfirm, loading, children }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void; loading: boolean; children: React.ReactNode }) { const { t } = useTranslation(); if (!open) return null; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold text-slate-900">{title}</h2><div className="mt-4">{children}</div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={loading} onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" disabled={loading} onClick={onConfirm}>{t('common.confirm')}</Button></div></div></div>; }
