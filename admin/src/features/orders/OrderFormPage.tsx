import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import { fetchOrderProductVariants, useCreateOrder, useOrderProductPicker, type CreateOrderPayload, type OrderAddress, type OrderProductPickerItem, type OrderVariantPickerItem } from './api';

type AddressField = keyof OrderAddress;
type FormAddress = Record<AddressField, string>;

const emptyAddress = (): FormAddress => ({ first_name: '', last_name: '', line_one: '', line_two: '', city: '', state: '', postcode: '', country: 'US', phone: '' });

function omitBlankAddress(address: FormAddress): OrderAddress {
  return Object.fromEntries(Object.entries(address).filter(([, value]) => value.trim())) as OrderAddress;
}

export function OrderFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateOrder();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<OrderProductPickerItem | null>(null);
  const [availableVariants, setAvailableVariants] = useState<OrderVariantPickerItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<number, OrderVariantPickerItem>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [email, setEmail] = useState('');
  const [shipping, setShipping] = useState<FormAddress>(emptyAddress);
  const [billing, setBilling] = useState<FormAddress>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card'>('cod');
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [couponCode, setCouponCode] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const productsQuery = useOrderProductPicker(search);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const selectedIdsForProduct = useMemo(() => availableVariants.filter((variant) => selectedVariants[variant.id]).map((variant) => variant.id), [availableVariants, selectedVariants]);
  const selectedRows = Object.values(selectedVariants);

  async function selectProduct(product: OrderProductPickerItem) {
    setSelectedProduct(product);
    setAvailableVariants([]);
    try {
      setAvailableVariants(await fetchOrderProductVariants(product.id));
    } catch (error) {
      toast.error((error as Error).message || t('orders.error_occurred'));
    }
  }

  function changeSelectedVariants(ids: number[]) {
    setSelectedVariants((current) => {
      const next = { ...current };
      for (const variant of availableVariants) {
        if (ids.includes(variant.id)) {
          next[variant.id] = variant;
        } else {
          delete next[variant.id];
        }
      }
      return next;
    });
    setQuantities((current) => {
      const next = { ...current };
      for (const id of ids) next[id] ??= '1';
      for (const variant of availableVariants) if (!ids.includes(variant.id)) delete next[variant.id];
      return next;
    });
  }

  function updateAddress(kind: 'shipping' | 'billing', field: AddressField, value: string) {
    const update = kind === 'shipping' ? setShipping : setBilling;
    update((address) => ({ ...address, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    const items = selectedRows.map((variant) => ({ variant_id: variant.id, quantity: Number(quantities[variant.id]) }));
    if (!items.length || items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0) || !email.trim() || !shipping.first_name.trim() || !shipping.line_one.trim() || !shipping.city.trim()) {
      setErrorMessage(t('orders.validation_required'));
      return;
    }
    const payload: CreateOrderPayload = {
      items,
      email: email.trim(),
      shipping: omitBlankAddress(shipping),
      billing_same_as_shipping: billingSameAsShipping,
      ...(billingSameAsShipping ? {} : { billing: omitBlankAddress(billing) }),
      payment_method: paymentMethod,
      shipping_method: shippingMethod,
      ...(couponCode.trim() ? { coupon_code: couponCode.trim() } : {}),
      ...(customerNote.trim() ? { customer_note: customerNote.trim() } : {}),
      ...(internalNote.trim() ? { internal_note: internalNote.trim() } : {}),
      ...(shippingFee.trim() ? { shipping_fee_override: Number(shippingFee) } : {}),
    };
    try {
      const order = await createMutation.mutateAsync(payload);
      navigate(`/orders/${order.id}`);
    } catch (error) {
      const response = error as Error & { status?: number; data?: { errors?: Record<string, string[]> } };
      if (response.status === 422) {
        setErrorMessage(Object.values(response.data?.errors ?? {}).flat().join(' ') || response.message);
      } else {
        toast.error(response.message || t('orders.error_occurred'));
      }
    }
  }

  return <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-900">{t('orders.create_title')}</h1><p className="mt-1 text-sm text-slate-500">{t('orders.create_subtitle')}</p></div><Button type="button" variant="secondary" onClick={() => navigate('/orders')}>{t('orders.back')}</Button></div>
    {errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}
    <Section title={t('orders.customer')}><Field label={t('orders.email')}><Input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field></Section>
    <Section title={t('orders.items')}>
      <Field label={t('orders.search_products')}><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('orders.search_products')} /></Field>
      <div className="mt-2 space-y-1">{(productsQuery.data ?? []).map((product) => <button key={product.id} type="button" onClick={() => selectProduct(product)} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">{product.name}</button>)}</div>
      {selectedProduct && <div className="mt-4"><p className="mb-2 text-sm font-medium">{t('orders.select_variants')}</p><SearchableMultiSelect options={availableVariants.map((variant) => ({ id: variant.id, label: variant.label }))} value={selectedIdsForProduct} onChange={changeSelectedVariants} placeholder={t('orders.search_variants')} noResultsText={t('orders.no_variants')} selectedCountText={(count) => t('orders.variants_selected', { count })} clearAllText={t('orders.clear_variants')} /></div>}
      {selectedRows.length > 0 && <div className="mt-4 space-y-2">{selectedRows.map((variant) => <div key={variant.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><span className="flex-1 text-sm">{variant.label}</span><label className="text-sm">{t('orders.qty')}<Input name={`quantity.${variant.id}`} type="number" min="1" step="1" value={quantities[variant.id] ?? '1'} onChange={(event) => setQuantities((current) => ({ ...current, [variant.id]: event.target.value }))} className="ml-2 inline-block w-20" /></label></div>)}</div>}
    </Section>
    <Section title={t('orders.shipping_address')}><AddressFields kind="shipping" address={shipping} onChange={updateAddress} t={t} /></Section>
    <Section title={t('orders.billing_address')}><label className="flex items-center gap-2 text-sm"><input name="billing_same_as_shipping" type="checkbox" checked={billingSameAsShipping} onChange={(event) => setBillingSameAsShipping(event.target.checked)} />{t('orders.billing_same_as_shipping')}</label>{!billingSameAsShipping && <div className="mt-4"><AddressFields kind="billing" address={billing} onChange={updateAddress} t={t} /></div>}</Section>
    <Section title={t('orders.settings')}><div className="grid gap-4 sm:grid-cols-2"><Field label={t('orders.payment_method')}><select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'cod' | 'card')} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="cod">{t('orders.payment_cod')}</option><option value="card">{t('orders.payment_card')}</option></select></Field><Field label={t('orders.shipping_method')}><select name="shipping_method" value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value as 'standard' | 'express')} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="standard">{t('orders.shipping_standard')}</option><option value="express">{t('orders.shipping_express')}</option></select></Field><Field label={t('orders.coupon_code')}><Input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} /></Field><Field label={t('orders.shipping_fee_override')}><Input name="shipping_fee_override" type="number" min="0" step="0.01" value={shippingFee} onChange={(event) => setShippingFee(event.target.value)} /><p className="mt-1 text-xs text-slate-500">{t('orders.shipping_fee_help')}</p></Field></div></Section>
    <Section title={t('orders.notes')}><Field label={t('orders.customer_note')}><textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm" /></Field><Field label={t('orders.internal_note')}><textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm" /></Field></Section>
    <Button type="submit" variant="primary" disabled={createMutation.isPending}>{createMutation.isPending ? t('orders.saving') : t('orders.create')}</Button>
  </form>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mb-4 block text-sm font-medium text-slate-700"><span className="mb-1 block">{label}</span>{children}</label>; }
function AddressFields({ kind, address, onChange, t }: { kind: 'shipping' | 'billing'; address: FormAddress; onChange: (kind: 'shipping' | 'billing', field: AddressField, value: string) => void; t: (key: string) => string }) {
  const fields: Array<[AddressField, string]> = [['first_name', 'orders.first_name'], ['last_name', 'orders.last_name'], ['line_one', 'orders.line_one'], ['line_two', 'orders.line_two'], ['city', 'orders.city'], ['state', 'orders.state'], ['postcode', 'orders.postcode'], ['phone', 'orders.phone']];
  return <div className="grid gap-4 sm:grid-cols-2">{fields.map(([field, label]) => <Field key={field} label={t(label)}><Input name={`${kind}.${field}`} value={address[field]} onChange={(event) => onChange(kind, field, event.target.value)} /></Field>)}<Field label={t('orders.country')}><select name={`${kind}.country`} value={address.country} onChange={(event) => onChange(kind, 'country', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="US">{t('orders.country_us')}</option></select></Field></div>;
}
