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

export interface AffiliateReportsResponse {
  range: string;
  overview: ReportOverview;
  by_network: NetworkReportItem[];
  by_post: PostReportItem[];
}

export async function fetchAffiliateReports(
  range: '7' | '30' | '90' | 'all' = '30'
): Promise<AffiliateReportsResponse> {
  return fetchJson<AffiliateReportsResponse>(`/admin/affiliate/reports?range=${range}`);
}
