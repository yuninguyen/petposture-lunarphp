import { fetchJson } from '@/lib/api';

export interface ReportOverview {
  clicks_7d: number;
  clicks_30d: number;
  clicks_all_time: number;
  top_network_30d: {
    name: string;
    clicks: number;
  } | null;
  conversions_synced: number | null;
  commission_amount_synced: number | null;
  has_synced_data: boolean;
}

export interface NetworkReportItem {
  network_id: number | null;
  network_name: string;
  network_slug: string | null;
  clicks: number;
  is_configured: boolean;
  last_synced_at: string | null;
  synced_conversions: number | null;
  synced_commission: number | null;
}

export interface PostReportItem {
  post_id: number;
  post_title: string;
  clicks: number;
}

/** Clicks on a Pick (an affiliate product page), as opposed to a link inside a blog post. */
export interface ProductReportItem {
  product_id: number;
  product_name: string;
  clicks: number;
}

export interface AffiliateReportsResponse {
  range: string;
  date_from?: string | null;
  date_to?: string | null;
  overview: ReportOverview;
  by_network: NetworkReportItem[];
  by_post: PostReportItem[];
  /** Absent on an API that predates Pick tracking, so the page treats it as empty. */
  by_product?: ProductReportItem[];
}

export interface FetchAffiliateReportsParams {
  range?: string | null;
  date_from?: string | null;
  date_to?: string | null;
}

export async function fetchAffiliateReports(
  params: FetchAffiliateReportsParams | string = '30'
): Promise<AffiliateReportsResponse> {
  const normalized: FetchAffiliateReportsParams =
    typeof params === 'string' ? { range: params } : params;

  const query = new URLSearchParams();

  if (normalized.range && normalized.range.trim() !== '') {
    query.set('range', normalized.range.trim());
  }

  if (normalized.date_from && normalized.date_from.trim() !== '') {
    query.set('date_from', normalized.date_from.trim());
  }

  if (normalized.date_to && normalized.date_to.trim() !== '') {
    query.set('date_to', normalized.date_to.trim());
  }

  const qs = query.toString();
  return fetchJson<AffiliateReportsResponse>(`/admin/affiliate/reports${qs ? `?${qs}` : ''}`);
}
