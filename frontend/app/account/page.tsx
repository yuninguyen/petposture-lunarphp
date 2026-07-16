"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/lib/api';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Package, MapPin, User as UserIcon, LogOut, Trash2, Plus, X, ChevronDown } from 'lucide-react';

type Tab = 'orders' | 'addresses' | 'profile';

interface OrderLine {
    id: number;
    description: string;
    quantity: number;
    unit_price: number;
    sub_total: number;
    image: string | null;
}

interface OrderAddress {
    first_name: string;
    last_name: string;
    line_one: string;
    line_two: string | null;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string | null;
}

interface Order {
    id: string;
    reference: string;
    status_label: string;
    payment_status_label: string;
    payment_label: string | null;
    total: { formatted: string };
    sub_total: number;
    tax_total: number;
    shipping_total: number;
    discount_total: number;
    created_at: string;
    lines: OrderLine[];
    shipping_address: OrderAddress;
    billing_address: OrderAddress;
}

interface Address {
    id: number;
    label: string | null;
    first_name: string;
    last_name: string;
    line_one: string;
    line_two: string | null;
    city: string;
    state: string;
    postcode: string;
    country_code: string;
    phone: string | null;
    is_default: boolean;
}

const emptyAddressForm = {
    first_name: '',
    last_name: '',
    line_one: '',
    line_two: '',
    city: '',
    state: '',
    postcode: '',
    phone: '',
};

export default function AccountPage() {
    const { user, token, logout } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [addressForm, setAddressForm] = useState(emptyAddressForm);
    const [savingAddress, setSavingAddress] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    const authHeaders = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : null;

    useEffect(() => {
        if (!token) {
            router.push('/sign-in');
            return;
        }

        const base = getApiBaseUrl();
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

        setLoading(true);
        Promise.all([
            fetch(`${base}/api/orders`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
            fetch(`${base}/api/me/addresses`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
        ])
            .then(([ordersRes, addressesRes]) => {
                setOrders(ordersRes.data ?? []);
                setAddresses(addressesRes.data ?? []);
            })
            .catch(() => setError('Could not load your account data. Please try again.'))
            .finally(() => setLoading(false));
    }, [token, router]);

    const handleAddAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authHeaders) return;
        setSavingAddress(true);

        try {
            const res = await fetch(`${getApiBaseUrl()}/api/me/addresses`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(addressForm),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save address.');
            setAddresses((prev) => [...prev, data.data]);
            setAddressForm(emptyAddressForm);
            setShowAddressForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save address.');
        } finally {
            setSavingAddress(false);
        }
    };

    const handleDeleteAddress = async (id: number) => {
        if (!authHeaders) return;
        try {
            const res = await fetch(`${getApiBaseUrl()}/api/me/addresses/${id}`, {
                method: 'DELETE',
                headers: authHeaders,
            });
            if (!res.ok && res.status !== 204) throw new Error('Failed to delete address.');
            setAddresses((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete address.');
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    if (!user) {
        return null;
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'orders', label: 'Orders', icon: <Package size={16} /> },
        { id: 'addresses', label: 'Addresses', icon: <MapPin size={16} /> },
        { id: 'profile', label: 'Account Info', icon: <UserIcon size={16} /> },
    ];

    return (
        <main className="min-h-screen bg-[#f4f6f8] font-hanken flex flex-col">
            <Header />

            <section className="flex-1 px-4 md:px-8 py-12">
                <div className="mx-auto max-w-[1000px]">
                    <h1 className="text-[28px] font-bold text-[#3e4c57] mb-2">My Account</h1>
                    <p className="text-zinc-500 text-[14px] mb-8">Welcome back, {user.name}.</p>

                    <div className="flex flex-col md:flex-row gap-8">
                        <aside className="md:w-56 flex-shrink-0">
                            <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
                                {tabs.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTab(t.id)}
                                        className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wide transition-colors ${tab === t.id ? 'bg-[#df8448] text-white' : 'bg-white text-[#3e4c57] hover:bg-zinc-50'}`}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 whitespace-nowrap px-4 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wide text-red-500 bg-white hover:bg-red-50 transition-colors"
                                >
                                    <LogOut size={16} /> Log Out
                                </button>
                            </nav>
                        </aside>

                        <div className="flex-1 bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 md:p-8">
                            {error && (
                                <div className="mb-6 text-red-500 text-[12px] font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}

                            {loading ? (
                                <p className="text-zinc-400 text-[14px]">Loading...</p>
                            ) : tab === 'orders' ? (
                                orders.length === 0 ? (
                                    <p className="text-zinc-400 text-[14px]">You haven&apos;t placed any orders yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {orders.map((order) => {
                                            const isExpanded = expandedOrderId === order.id;
                                            return (
                                                <div key={order.id} className="border border-zinc-100 rounded-xl overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                                        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 transition-colors"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-[#3e4c57] text-[14px]">#{order.reference}</p>
                                                            <p className="text-zinc-400 text-[12px]">{new Date(order.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <p className="text-[12px] font-bold uppercase tracking-wide text-[#df8448]">{order.status_label}</p>
                                                                <p className="text-[14px] font-bold text-[#3e4c57]">{order.total.formatted}</p>
                                                            </div>
                                                            <ChevronDown size={18} className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="border-t border-zinc-100 bg-[#fafbfc] p-4 space-y-4">
                                                            <div className="space-y-2">
                                                                {order.lines.map((line) => (
                                                                    <div key={line.id} className="flex items-center justify-between text-[13px]">
                                                                        <span className="text-[#3e4c57]">{line.description} <span className="text-zinc-400">&times;{line.quantity}</span></span>
                                                                        <span className="font-medium text-[#3e4c57]">${line.sub_total.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
                                                                <div>
                                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Shipping Address</p>
                                                                    <p className="text-[13px] text-zinc-600 leading-relaxed">
                                                                        {order.shipping_address.first_name} {order.shipping_address.last_name}<br />
                                                                        {order.shipping_address.line_one}{order.shipping_address.line_two ? `, ${order.shipping_address.line_two}` : ''}<br />
                                                                        {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postcode}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment</p>
                                                                    <p className="text-[13px] text-zinc-600 leading-relaxed">
                                                                        {order.payment_label || 'N/A'}<br />
                                                                        {order.payment_status_label}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="pt-3 border-t border-zinc-100 space-y-1 text-[13px]">
                                                                <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>${order.sub_total.toFixed(2)}</span></div>
                                                                {order.discount_total > 0 && (
                                                                    <div className="flex justify-between text-zinc-500"><span>Discount</span><span>-${order.discount_total.toFixed(2)}</span></div>
                                                                )}
                                                                <div className="flex justify-between text-zinc-500"><span>Shipping</span><span>{order.shipping_total === 0 ? 'Free' : `$${order.shipping_total.toFixed(2)}`}</span></div>
                                                                <div className="flex justify-between text-zinc-500"><span>Tax</span><span>${order.tax_total.toFixed(2)}</span></div>
                                                                <div className="flex justify-between font-bold text-[#3e4c57] pt-1"><span>Total</span><span>{order.total.formatted}</span></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            ) : tab === 'addresses' ? (
                                <div className="space-y-4">
                                    {addresses.map((addr) => (
                                        <div key={addr.id} className="flex items-start justify-between border border-zinc-100 rounded-xl p-4">
                                            <div className="text-[13px] text-[#3e4c57]">
                                                <p className="font-bold">
                                                    {addr.first_name} {addr.last_name}{' '}
                                                    {addr.is_default && <span className="text-[10px] uppercase text-[#df8448] font-bold ml-2">Default</span>}
                                                </p>
                                                <p className="text-zinc-500">{addr.line_one}{addr.line_two ? `, ${addr.line_two}` : ''}</p>
                                                <p className="text-zinc-500">{addr.city}, {addr.state} {addr.postcode}</p>
                                                {addr.phone && <p className="text-zinc-500">{addr.phone}</p>}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteAddress(addr.id)}
                                                className="text-zinc-400 hover:text-red-500 transition-colors"
                                                title="Delete address"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    {showAddressForm ? (
                                        <form onSubmit={handleAddAddress} className="border border-zinc-100 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-[13px] text-[#3e4c57] uppercase tracking-wide">New Address</p>
                                                <button type="button" onClick={() => setShowAddressForm(false)} className="text-zinc-400 hover:text-[#3e4c57]">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input required placeholder="First name" value={addressForm.first_name} onChange={(e) => setAddressForm((f) => ({ ...f, first_name: e.target.value }))} className="px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                                <input required placeholder="Last name" value={addressForm.last_name} onChange={(e) => setAddressForm((f) => ({ ...f, last_name: e.target.value }))} className="px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                            </div>
                                            <input required placeholder="Address line 1" value={addressForm.line_one} onChange={(e) => setAddressForm((f) => ({ ...f, line_one: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                            <input placeholder="Address line 2 (optional)" value={addressForm.line_two} onChange={(e) => setAddressForm((f) => ({ ...f, line_two: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                            <div className="grid grid-cols-3 gap-3">
                                                <input required placeholder="City" value={addressForm.city} onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} className="px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                                <input required placeholder="State" value={addressForm.state} onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))} className="px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                                <input required placeholder="Postcode" value={addressForm.postcode} onChange={(e) => setAddressForm((f) => ({ ...f, postcode: e.target.value }))} className="px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                            </div>
                                            <input placeholder="Phone (optional)" value={addressForm.phone} onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg bg-[#f8f9fa] text-[13px] outline-none focus:ring-2 focus:ring-[#df8448]" />
                                            <button
                                                type="submit"
                                                disabled={savingAddress}
                                                className="bg-[#df8448] text-white px-6 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wide hover:bg-[#c9713a] disabled:opacity-50 transition-colors"
                                            >
                                                {savingAddress ? 'Saving...' : 'Save Address'}
                                            </button>
                                        </form>
                                    ) : (
                                        <button
                                            onClick={() => setShowAddressForm(true)}
                                            className="flex items-center gap-2 text-[13px] font-bold text-[#df8448] hover:text-[#c9713a] transition-colors"
                                        >
                                            <Plus size={16} /> Add New Address
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid sm:grid-cols-2 gap-6 text-[14px] text-[#3e4c57]">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Full Name</p>
                                        <p className="font-medium">{user.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Email Address</p>
                                        <p className="font-medium">{user.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Member Since</p>
                                        <p className="font-medium">
                                            {user.created_at
                                                ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                                                : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Orders Placed</p>
                                        <p className="font-medium">{orders.length}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
