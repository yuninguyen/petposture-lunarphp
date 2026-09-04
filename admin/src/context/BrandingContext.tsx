import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AdminBranding, DEFAULT_ADMIN_BRANDING, loadAdminBranding } from '@/lib/branding';

export const BrandingContext = createContext<AdminBranding>(DEFAULT_ADMIN_BRANDING);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState(DEFAULT_ADMIN_BRANDING);

  useEffect(() => {
    let active = true;
    loadAdminBranding().then((loaded) => {
      if (active) setBranding(loaded);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const link = document.getElementById('admin-favicon') as HTMLLinkElement | null;
    if (link) link.href = branding.faviconUrl;
  }, [branding.faviconUrl]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
