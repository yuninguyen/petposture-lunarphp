import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useOrders } from './api';

export function OrdersListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status]);
  const query = useOrders({ status, page });
  const orders = query.data?.data ?? [];
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">{t('orders.title')}</h1><p className="mt-1 text-sm text-slate-500">{t('orders.subtitle')}</p></div>
    <div className="rounded-t-xl border border-b-0 border-slate-200 bg-white p-4"><select aria-label={t('orders.status')} value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">{t('orders.all_statuses')}</option><option value="awaiting-payment">{t('orders.status_awaiting_payment')}</option><option value="payment-offline">{t('orders.status_payment_offline')}</option><option value="payment-received">{t('orders.status_payment_received')}</option><option value="processing">{t('orders.status_processing')}</option><option value="shipped">{t('orders.status_shipped')}</option><option value="delivered">{t('orders.status_delivered')}</option><option value="cancelled">{t('orders.status_cancelled')}</option></select></div>
    <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full"><thead className="border-b bg-slate-50"><tr>{['reference', 'customer', 'total', 'status', 'payment_status', 'fulfillment_status', 'created_at'].map((key) => <th key={key} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`orders.column_${key}`)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
      {query.isLoading ? <StateRow text={t('common.loading')} /> : query.isError ? <StateRow text={(query.error as Error).message} error /> : !orders.length ? <StateRow text={t('orders.empty')} /> : orders.map((order) => <tr key={order.id} className="hover:bg-slate-50"><td className="px-6 py-4"><button onClick={() => navigate(`/orders/${order.id}`)} className="font-semibold text-slate-900 hover:text-primary">{order.reference}</button></td><td className="px-6 py-4 text-sm">{order.customer_email ?? '—'}</td><td className="px-6 py-4 text-sm font-medium">{order.total.formatted}</td><td className="px-6 py-4 text-sm">{order.status_label ?? order.status}</td><td className="px-6 py-4 text-sm">{order.payment_status_label ?? order.payment_status}</td><td className="px-6 py-4 text-sm">{order.fulfillment_status_label ?? order.fulfillment_status}</td><td className="px-6 py-4 text-sm text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</td></tr>)}
    </tbody></table></div>{query.data && query.data.meta.last_page > 1 && <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4"><span className="text-sm text-slate-500">{t('orders.page_of', { current: query.data.meta.current_page, last: query.data.meta.last_page })}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('common.previous')}</Button><Button variant="secondary" disabled={page >= query.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>{t('common.next')}</Button></div></div>}</div>
  </div>;
}
function StateRow({ text, error = false }: { text: string; error?: boolean }) { return <tr><td colSpan={7} className={`px-6 py-12 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</td></tr>; }
