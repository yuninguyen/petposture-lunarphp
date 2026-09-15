import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Link2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchAffiliateNetworks,
  createAffiliateNetwork,
  updateAffiliateNetwork,
  deleteAffiliateNetwork,
  syncAffiliateNetwork,
  type AffiliateNetworkItem,
  type CreateAffiliateNetworkPayload,
  type UpdateAffiliateNetworkPayload,
} from './api';

export function AffiliateNetworksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<AffiliateNetworkItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AffiliateNetworkItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [active, setActive] = useState(true);
  const [provider, setProvider] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [commissionRate, setCommissionRate] = useState<string>('');
  const [cookieDays, setCookieDays] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  // Fetch networks
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'affiliate-networks'],
    queryFn: fetchAffiliateNetworks,
  });

  const networks = data?.data ?? [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateAffiliateNetworkPayload) => createAffiliateNetwork(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'affiliate-networks'] });
      toast.success(t('affiliate_networks.save_success', 'Affiliate network saved successfully'));
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.data?.message || t('affiliate_networks.save_failed', 'Failed to save affiliate network'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateAffiliateNetworkPayload }) =>
      updateAffiliateNetwork(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'affiliate-networks'] });
      toast.success(t('affiliate_networks.save_success', 'Affiliate network saved successfully'));
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.data?.message || t('affiliate_networks.save_failed', 'Failed to save affiliate network'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAffiliateNetwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'affiliate-networks'] });
      toast.success(t('affiliate_networks.delete_success', 'Affiliate network deleted'));
      setDeleteCandidate(null);
    },
    onError: (err: any) => {
      toast.error(err?.data?.message || t('affiliate_networks.delete_failed', 'Failed to delete affiliate network'));
    },
  });

  // Sync mutation
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const syncMutation = useMutation({
    mutationFn: (id: number) => syncAffiliateNetwork(id),
    onMutate: (id) => setSyncingId(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'affiliate-networks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'affiliate-reports'] });
      toast.success(res?.message || t('affiliate_networks.sync_success', 'Sync triggered successfully'));
    },
    onError: (err: any) => {
      toast.error(err?.data?.message || t('affiliate_networks.sync_failed', 'Failed to trigger sync'));
    },
    onSettled: () => {
      setSyncingId(null);
    },
  });

  function openCreateModal() {
    setEditingNetwork(null);
    setName('');
    setSlug('');
    setLogo('');
    setActive(true);
    setProvider('');
    setMerchantId('');
    setCommissionRate('');
    setCookieDays('');
    setApiKey('');
    setApiSecret('');
    setIsModalOpen(true);
  }

  function openEditModal(item: AffiliateNetworkItem) {
    setEditingNetwork(item);
    setName(item.name);
    setSlug(item.slug);
    setLogo(item.logo || '');
    setActive(item.active);
    setProvider(item.provider || '');
    setMerchantId(item.merchant_id || '');
    setCommissionRate(item.commission_rate_default !== null ? String(item.commission_rate_default) : '');
    setCookieDays(item.cookie_days !== null ? String(item.cookie_days) : '');
    setApiKey('');
    setApiSecret('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingNetwork(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsedRate = commissionRate ? parseFloat(commissionRate) : null;
    const parsedDays = cookieDays ? parseInt(cookieDays, 10) : null;

    if (editingNetwork) {
      const payload: UpdateAffiliateNetworkPayload = {
        name,
        slug: slug || undefined,
        logo: logo || null,
        active,
        provider: provider || null,
        merchant_id: merchantId || null,
        commission_rate_default: parsedRate,
        cookie_days: parsedDays,
      };

      // Omit secret fields if left blank to keep existing encrypted value
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      if (apiSecret.trim()) {
        payload.api_secret = apiSecret.trim();
      }

      updateMutation.mutate({ id: editingNetwork.id, payload });
    } else {
      const payload: CreateAffiliateNetworkPayload = {
        name,
        slug: slug || undefined,
        logo: logo || null,
        active,
        provider: provider || null,
        merchant_id: merchantId || null,
        commission_rate_default: parsedRate,
        cookie_days: parsedDays,
        api_key: apiKey.trim() || null,
        api_secret: apiSecret.trim() || null,
      };

      createMutation.mutate(payload);
    }
  }

  function formatDateTime(isoString: string | null): string {
    if (!isoString) return t('affiliate_networks.never_synced', 'Never');
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('affiliate_networks.title', 'Affiliate Networks')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t(
              'affiliate_networks.subtitle',
              'Manage partner networks, providers, credentials and tracking settings'
            )}
          </p>
        </div>

        <Button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('affiliate_networks.new_network', 'New Network')}
        </Button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading && (
          <div className="p-12 text-center text-sm text-slate-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-primary mb-2" />
            <p>{t('affiliate_networks.loading', 'Loading affiliate networks...')}</p>
          </div>
        )}

        {isError && (
          <div className="p-8 text-center text-sm text-red-500">
            <p>{t('affiliate_networks.error_loading', 'Failed to load affiliate networks.')}</p>
          </div>
        )}

        {!isLoading && !isError && networks.length === 0 && (
          <div className="p-12 text-center">
            <Link2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">
              {t('affiliate_networks.empty', 'No affiliate networks found.')}
            </p>
          </div>
        )}

        {!isLoading && !isError && networks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    {t('affiliate_networks.column_logo', 'Logo')}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t('affiliate_networks.column_name', 'Name & Slug')}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t('affiliate_networks.column_provider', 'Provider')}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t('affiliate_networks.column_status', 'Status')}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t('affiliate_networks.column_configured', 'API Integration')}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t('affiliate_networks.column_synced', 'Last Synced')}
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    {t('affiliate_networks.column_actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {networks.map((item) => {
                  const isSyncing = syncingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Logo */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt={item.name}
                            className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 p-1"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                            <Link2 className="w-4 h-4" />
                          </div>
                        )}
                      </td>

                      {/* Name & Slug */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.slug}</div>
                      </td>

                      {/* Provider */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {item.provider || '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('affiliate_networks.status_active', 'Active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3.5 h-3.5" />
                            {t('affiliate_networks.status_inactive', 'Inactive')}
                          </span>
                        )}
                      </td>

                      {/* Configured badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.is_configured ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {t('affiliate_networks.configured_yes', 'Configured')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {t('affiliate_networks.configured_no', 'Unconfigured')}
                          </span>
                        )}
                      </td>

                      {/* Last Synced */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {formatDateTime(item.last_synced_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                        {/* Sync Now button */}
                        <button
                          type="button"
                          disabled={!item.is_configured || isSyncing}
                          onClick={() => syncMutation.mutate(item.id)}
                          title={
                            !item.is_configured
                              ? t('affiliate_networks.configured_no', 'Unconfigured')
                              : t('affiliate_networks.sync_now', 'Sync Now')
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">
                            {isSyncing
                              ? t('affiliate_networks.syncing', 'Syncing...')
                              : t('affiliate_networks.sync_now', 'Sync Now')}
                          </span>
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('affiliate_networks.edit', 'Edit')}</span>
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('affiliate_networks.delete', 'Delete')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal Dialog */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingNetwork
                    ? t('affiliate_networks.modal_edit_title', 'Edit Affiliate Network')
                    : t('affiliate_networks.modal_create_title', 'Create Affiliate Network')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(
                    'affiliate_networks.modal_subtitle',
                    'Configure partner metadata and provider API credentials'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <span className="sr-only">Close</span>
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_name', 'Network Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('affiliate_networks.field_name_placeholder', 'e.g. Impact, CJ, Chewy')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_slug', 'Slug')}
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder={t('affiliate_networks.field_slug_placeholder', 'e.g. impact-radius')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-[11px] text-slate-400">
                    {t('affiliate_networks.field_slug_help', 'Leave blank to auto-generate from name')}
                  </p>
                </div>

                {/* Provider Identifier */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_provider', 'Provider Identifier')}
                  </label>
                  <input
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="e.g. impact, cj, amazon"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Logo URL */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_logo', 'Logo URL')}
                  </label>
                  <input
                    type="url"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Merchant ID */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_merchant_id', 'Merchant / Program ID')}
                  </label>
                  <input
                    type="text"
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="e.g. 12345"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Commission Rate Default */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_commission_rate', 'Default Commission Rate (%)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder="e.g. 8.5"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Cookie Days */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {t('affiliate_networks.field_cookie_days', 'Cookie Duration (Days)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cookieDays}
                    onChange={(e) => setCookieDays(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Active Checkbox */}
                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="network-active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary/20"
                  />
                  <label htmlFor="network-active" className="text-xs font-medium text-slate-700 cursor-pointer">
                    {t('affiliate_networks.field_active', 'Active (available for selection in articles)')}
                  </label>
                </div>
              </div>

              {/* Credentials Section */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t('affiliate_networks.credentials_section', 'API & Credentials (Encrypted)')}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* API Key */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      {t('affiliate_networks.field_api_key', 'API Key')}
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        editingNetwork
                          ? t('affiliate_networks.field_api_key_help', 'Leave blank to keep existing encrypted key')
                          : 'API Key'
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                  </div>

                  {/* API Secret */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      {t('affiliate_networks.field_api_secret', 'API Secret / Token')}
                    </label>
                    <input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder={
                        editingNetwork
                          ? t('affiliate_networks.field_api_secret_help', 'Leave blank to keep existing encrypted secret')
                          : 'API Secret'
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                >
                  {t('affiliate_networks.cancel', 'Cancel')}
                </button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? t('affiliate_networks.saving', 'Saving...')
                    : t('affiliate_networks.save', 'Save Network')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-slate-900">
                {t('affiliate_networks.delete', 'Delete')} {deleteCandidate.name}
              </h3>
            </div>

            <p className="text-sm text-slate-600">
              {t('affiliate_networks.delete_confirm', {
                name: deleteCandidate.name,
                defaultValue: `Are you sure you want to delete "${deleteCandidate.name}"? This action cannot be undone.`,
              })}
            </p>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
              >
                {t('affiliate_networks.cancel', 'Cancel')}
              </button>
              <Button
                type="button"
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteCandidate.id)}
                aria-label={`${t('affiliate_networks.delete', 'Delete')} ${deleteCandidate.name}`}
              >
                {deleteMutation.isPending
                  ? t('common.deleting', 'Deleting...')
                  : t('affiliate_networks.delete', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
