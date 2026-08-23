import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';

export interface SeoSocialSettings {
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_tiktok: string;
  social_pinterest: string;
  social_youtube: string;
  business_phone: string;
  business_address: string;
}

export function useSeoSocialSettings() {
  return useQuery({
    queryKey: ['seo-social'],
    queryFn: async () => {
      const response = await fetchApi('/admin/seo-social');
      if (!response.ok) {
        throw new Error('Failed to fetch SEO & Social settings');
      }
      return (await response.json()) as SeoSocialSettings;
    },
  });
}

export function useUpdateSeoSocialSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SeoSocialSettings) => {
      const response = await fetchApi('/admin/seo-social', {
        method: 'POST',
        body: data as unknown as Record<string, unknown>,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update SEO & Social settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-social'] });
    },
  });
}
