import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCustomer, useCustomerAddresses, useCustomerLoginAccounts, useCustomerOrders } from './api';

type Tab = 'orders' | 'addresses' | 'accounts';

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [tab, setTab] = useState<Tab>('orders');
  const [ordersPage, setOrdersPage] = useState(1);
  const customerQuery = useCustomer(id);
  const ordersQuery = useCustomerOrders(id, ordersPage, tab === 'orders');
  const addressesQuery = useCustomerAddresses(id, tab === 'addresses');
  const accountsQuery = useCustomerLoginAccounts(id, tab === 'accounts');
  const customer = customerQuery.data;

  if (customerQuery.isLoading) return <PageState text={t('customers.loading')} />;
  if (customerQuery.isError || !customer) return <PageState text={customerQuery.isError ? (customerQuery.error as Error).message : t('customers.not_found')} error />;

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label={t('customers.column_email')} value={customer.email ?? t('customers.guest')} />
        <Detail label={t('customers.column_total_orders')} value={String(customer.orders_count)} />
        <Detail label={t('customers.column_total_spent')} value={`$${((customer.orders_sum_total ?? 0) / 100).toFixed(2)}`} />
        <Detail label={t('customers.column_status')} value={t(`customers.status_${customer.status}`)} />
      </dl>
    </header>

    <div className="mt-6 flex gap-2 border-b border-slate-200" role="tablist">
      <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>{t('customers.orders')}</TabButton>
      <TabButton active={tab === 'addresses'} onClick={() => setTab('addresses')}>{t('customers.address_book')}</TabButton>
      <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>{t('customers.login_accounts')}</TabButton>
    </div>

    <section className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 shadow-sm">
      {tab === 'orders' && <OrdersTab query={ordersQuery} page={ordersPage} onPageChange={setOrdersPage} />}
      {tab === 'addresses' && <AddressesTab query={addressesQuery} />}
      {tab === 'accounts' && <AccountsTab query={accountsQuery} />}
    </section>
  </div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button role="tab" aria-selected={active} onClick={onClick} className={`border-b-2 px-4 py-3 text-sm font-medium ${active ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>{children}</button>;
}

function OrdersTab({ query, page, onPageChange }: { query: ReturnType<typeof useCustomerOrders>; page: number; onPageChange: (page: number) => void }) {
  const { t } = useTranslation();
  if (query.isLoading) return <PageState text={t('customers.loading')} />;
  if (query.isError) return <PageState text={(query.error as Error).message} error />;
  const orders = query.data?.data ?? [];
  return <><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">{t('customers.order_reference')}</th><th className="px-3 py-3">{t('customers.status')}</th><th className="px-3 py-3">{t('customers.order_total')}</th><th className="px-3 py-3">{t('customers.order_date')}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-slate-100 text-sm"><td className="px-3 py-3"><Link to={`/orders/${order.id}`} className="font-medium text-primary">{order.reference}</Link></td><td className="px-3 py-3">{order.status_label ?? order.status}</td><td className="px-3 py-3">{order.total.formatted}</td><td className="px-3 py-3">{order.created_at ? new Date(order.created_at).toLocaleDateString() : t('customers.not_available')}</td></tr>)}</tbody></table></div>{!orders.length && <PageState text={t('customers.orders_empty')} />}{query.data && query.data.meta.last_page > 1 && <div className="mt-4 flex items-center justify-between"><span className="text-sm text-slate-500">{t('customers.page_of', { current: query.data.meta.current_page, last: query.data.meta.last_page })}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t('customers.previous')}</Button><Button variant="secondary" disabled={page >= query.data.meta.last_page} onClick={() => onPageChange(page + 1)}>{t('customers.next')}</Button></div></div>}</>;
}

function AddressesTab({ query }: { query: ReturnType<typeof useCustomerAddresses> }) {
  const { t } = useTranslation();
  if (query.isLoading) return <PageState text={t('customers.loading')} />;
  if (query.isError) return <PageState text={(query.error as Error).message} error />;
  return <div className="space-y-4">{(query.data ?? []).map((address) => <article key={address.id} className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{address.title ?? t('customers.address')}</h2>{address.shipping_default && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t('customers.shipping_default')}</span>}{address.billing_default && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t('customers.billing_default')}</span>}</div><p className="mt-2">{[address.first_name, address.last_name].filter(Boolean).join(' ')}</p><p>{address.line_one}</p>{address.line_two && <p>{address.line_two}</p>}{address.line_three && <p>{address.line_three}</p>}<p>{[address.city, address.state, address.postcode].filter(Boolean).join(', ')}</p><p>{address.contact_phone}</p><p>{address.contact_email}</p><p className="mt-2 text-slate-500">{t('customers.column_joined')}: {address.created_at ? new Date(address.created_at).toLocaleDateString() : t('customers.not_available')}</p></article>)}{!query.data?.length && <PageState text={t('customers.addresses_empty')} />}</div>;
}

function AccountsTab({ query }: { query: ReturnType<typeof useCustomerLoginAccounts> }) {
  const { t } = useTranslation();
  if (query.isLoading) return <PageState text={t('customers.loading')} />;
  if (query.isError) return <PageState text={(query.error as Error).message} error />;
  return <div className="divide-y divide-slate-100">{(query.data ?? []).map((account) => <p key={account.id} className="py-3 text-sm text-slate-700">{account.email}</p>)}{!query.data?.length && <PageState text={t('customers.login_accounts_empty')} />}</div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>; }
function PageState({ text, error = false }: { text: string; error?: boolean }) { return <p className={`py-8 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</p>; }
