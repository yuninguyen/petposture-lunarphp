import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCustomers } from './api';

export function CustomersListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{ search: string; status: 'active' | 'inactive' | ''; page: number }>({ search: '', status: '', page: 1 });

  const query = useCustomers({ search: filters.search, status: filters.status || undefined, page: filters.page });
  const customers = query.data?.data ?? [];

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">{t('customers.title')}</h1><p className="mt-1 text-sm text-slate-500">{t('customers.subtitle')}</p></div>
    <div className="flex gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-white p-4">
      <input aria-label={t('customers.search')} value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} placeholder={t('customers.search')} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
      <select aria-label={t('customers.status')} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' | '', page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">{t('customers.all_statuses')}</option><option value="active">{t('customers.status_active')}</option><option value="inactive">{t('customers.status_inactive')}</option></select>
    </div>
    <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full"><thead className="border-b bg-slate-50"><tr>{['name', 'email', 'total_orders', 'total_spent', 'joined', 'status'].map((key) => <th key={key} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`customers.column_${key}`)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
      {query.isLoading ? <StateRow text={t('customers.loading')} /> : query.isError ? <StateRow text={(query.error as Error).message} error /> : !customers.length ? <StateRow text={t('customers.empty')} /> : customers.map((customer) => <tr key={customer.id} className="hover:bg-slate-50"><td className="px-6 py-4"><button onClick={() => navigate(`/customers/${customer.id}`)} className="font-semibold text-slate-900 hover:text-primary">{customer.name}</button></td><td className="px-6 py-4 text-sm">{customer.email ?? t('customers.guest')}</td><td className="px-6 py-4 text-sm">{customer.orders_count}</td><td className="px-6 py-4 text-sm font-medium">${((customer.orders_sum_total ?? 0) / 100).toFixed(2)}</td><td className="px-6 py-4 text-sm text-slate-500">{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '—'}</td><td className="px-6 py-4 text-sm"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${customer.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{t(`customers.status_${customer.status}`)}</span></td></tr>)}
    </tbody></table></div>{query.data && query.data.meta.last_page > 1 && <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4"><span className="text-sm text-slate-500">{t('customers.page_of', { current: query.data.meta.current_page, last: query.data.meta.last_page })}</span><div className="flex gap-2"><Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>{t('customers.previous')}</Button><Button variant="secondary" disabled={filters.page >= query.data.meta.last_page} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>{t('customers.next')}</Button></div></div>}</div>
  </div>;
}

function StateRow({ text, error = false }: { text: string; error?: boolean }) { return <tr><td colSpan={6} className={`px-6 py-12 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</td></tr>; }
