"use client";

import React, { useEffect, useState } from 'react';
import { Package, DollarSign, ExternalLink, Calendar, MapPin, Truck, ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Product } from '@/types/shop';

interface OrderItem {
    id: number;
    quantity: number;
    price_at_purchase: string;
    product: Product;
}

interface Order {
    id: number;
    total_amount: string;
    status: string;
    payment_method: string;
    shipping_address: string;
    created_at: string;
    orderItems: OrderItem[];
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/api/orders');
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data);
                }
            } catch (err) {
                console.error("Fetch orders failed", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
    const pendingOrders = orders.filter(o => o.status === 'PENDING').length;

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'PENDING':
                return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Pending</span>;
            case 'PAID':
                return <span className="px-3 py-1 bg-green-100 text-green-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Paid</span>;
            case 'SHIPPED':
                return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">Shipped</span>;
            default:
                return <span className="px-3 py-1 bg-zinc-100 text-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">{status}</span>;
        }
    };

    return (
        <main className="min-h-screen bg-[#f4f6f8] font-hanken flex flex-col">
            <Header />

            <div className="flex-1 w-full max-w-[1200px] mx-auto p-4 md:p-8">

                {/* Dashboard Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-[28px] font-bold text-[#3e4c57] leading-tight">Order Management</h1>
                        <p className="text-zinc-500 text-[14px]">Overview of all store transactions and fulfillments.</p>
                    </div>
                </div>

                {/* Metrics Cards */}
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

                {/* Orders Data Table */}
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
                                    orders.map(order => (
                                        <tr key={order.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="text-[14px] font-bold text-[#3e4c57]">#{order.id}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-zinc-500 text-[13px]">
                                                    <Calendar size={14} />
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-2 max-w-[200px]">
                                                    <MapPin size={16} className="text-zinc-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="block text-[13px] font-medium text-[#3e4c57] truncate">{order.shipping_address}</span>
                                                        <span className="block text-[11px] text-zinc-400 uppercase tracking-wider">{order.payment_method}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-[14px] font-black text-[#df8448]">${parseFloat(order.total_amount).toFixed(2)}</span>
                                                <span className="block text-[11px] text-zinc-400">{order.orderItems?.length || 0} items</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 text-zinc-300 hover:text-[#3e4c57] hover:bg-zinc-100 rounded-full transition-colors">
                                                    <ChevronRight size={18} />
                                                </button>
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
