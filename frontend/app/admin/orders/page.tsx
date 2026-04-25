"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, DollarSign, ExternalLink, MapPin, Package, Truck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/api";

interface OrderAddress {
    first_name: string | null;
    last_name: string | null;
    line_one: string | null;
    line_two: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    country: string | null;
}

interface OrderLine {
    id: number;
    type?: string;
    quantity: number;
}

interface Order {
    id: string;
    reference: string;
    status: string;
    status_label: string;
    customer_email: string;
    payment_method: string | null;
    shipping_method: string | null;
    shipping_address: OrderAddress;
    total: {
        decimal: number;
        formatted: string;
    };
    lines: OrderLine[];
    created_at: string;
}

interface OrdersResponse {
    data: Order[];
}

function formatMethodLabel(value: string | null, fallback: string) {
    return (value || fallback)
        .replace(/[_-]/g, " ")
        .replace(/\bcod\b/i, "Cash on delivery")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAddress(address: OrderAddress) {
    return [
        [address.first_name, address.last_name].filter(Boolean).join(" ").trim(),
        address.line_one,
        address.line_two,
        [address.city, address.state, address.postcode].filter(Boolean).join(", ").trim(),
        address.country,
    ].filter(Boolean).join(", ");
}

function normalizeStatus(status: string) {
    return status.toUpperCase();
}

function countProductLines(order: Order) {
    return order.lines.filter((line) => line.type !== "shipping").length;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const apiBase = getApiBaseUrl();
                const res = await fetch(`${apiBase}/api/orders`, {
                    credentials: "include",
                });

                if (res.ok) {
                    const data: OrdersResponse = await res.json();
                    setOrders(data.data || []);
                }
            } catch (err) {
                console.error("Fetch orders failed", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const totalRevenue = orders.reduce((sum, order) => sum + order.total.decimal, 0);
    const pendingOrders = orders.filter((order) =>
        ["AWAITING-PAYMENT", "PAYMENT-OFFLINE", "PENDING"].includes(normalizeStatus(order.status))
    ).length;

    const StatusBadge = ({ status }: { status: string }) => {
        switch (normalizeStatus(status)) {
            case "AWAITING-PAYMENT":
            case "PENDING":
                return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Awaiting payment</span>;
            case "PAYMENT-RECEIVED":
            case "PAID":
                return <span className="px-3 py-1 bg-green-100 text-green-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Paid</span>;
            case "PROCESSING":
                return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Processing</span>;
            case "SHIPPED":
                return <span className="px-3 py-1 bg-sky-100 text-sky-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Shipped</span>;
            default:
                return <span className="px-3 py-1 bg-zinc-100 text-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">{status}</span>;
        }
    };

    return (
        <main className="min-h-screen bg-[#f4f6f8] font-hanken flex flex-col">
            <Header />

            <div className="flex-1 w-full max-w-[1200px] mx-auto p-4 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-[28px] font-bold text-[#3e4c57] leading-tight">Order Management</h1>
                        <p className="text-zinc-500 text-[14px]">Overview of all store transactions and fulfillments.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-[#df8448] transition-colors">
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Revenue</p>
                            <h3 className="text-[32px] font-black text-[#3e4c57]">${totalRevenue.toFixed(2)}</h3>
                        </div>
                        <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center text-[#df8448] group-hover:scale-110 transition-transform">
                            <DollarSign size={24} strokeWidth={2.5} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-blue-400 transition-colors">
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Orders</p>
                            <h3 className="text-[32px] font-black text-[#3e4c57]">{orders.length}</h3>
                        </div>
                        <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                            <Package size={24} strokeWidth={2.5} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-yellow-400 transition-colors">
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pending Fulfill</p>
                            <h3 className="text-[32px] font-black text-[#3e4c57]">{pendingOrders}</h3>
                        </div>
                        <div className="w-14 h-14 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                            <Truck size={24} strokeWidth={2.5} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                        <h2 className="text-[16px] font-bold text-[#3e4c57]">Recent Orders</h2>
                        <button className="text-[12px] font-bold text-[#df8448] uppercase tracking-widest hover:underline flex items-center gap-1">
                            Export CSV <ExternalLink size={14} />
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-50 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                                    <th className="px-6 py-4">Order ID</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Customer Details</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">Loading orders...</td>
                                    </tr>
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">No orders found.</td>
                                    </tr>
                                ) : (
                                    orders.map((order) => (
                                        <tr key={order.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="text-[14px] font-bold text-[#3e4c57]">#{order.reference}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-zinc-500 text-[13px]">
                                                    <Calendar size={14} />
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-2 max-w-[260px]">
                                                    <MapPin size={16} className="text-zinc-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="block text-[13px] font-medium text-[#3e4c57] truncate">{formatAddress(order.shipping_address)}</span>
                                                        <span className="block text-[11px] text-zinc-400 uppercase tracking-wider">
                                                            {formatMethodLabel(order.payment_method, "Card")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={order.status_label || order.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-[14px] font-black text-[#df8448]">${order.total.decimal.toFixed(2)}</span>
                                                <span className="block text-[11px] text-zinc-400">{countProductLines(order)} items</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/admin/orders/${order.id}`} className="p-2 text-zinc-300 hover:text-[#3e4c57] hover:bg-zinc-100 rounded-full transition-colors inline-flex">
                                                    <ChevronRight size={18} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}
