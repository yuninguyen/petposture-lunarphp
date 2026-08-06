"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

interface ShopSocialLinks {
    facebook: string | null;
    instagram: string | null;
    twitter: string | null;
    tiktok: string | null;
    pinterest: string | null;
    youtube: string | null;
}

interface ShopSettings {
    shop_name: string;
    shop_logo: string | null;
    shop_favicon: string | null;
    description: string | null;
    social: ShopSocialLinks;
}

const defaults: ShopSettings = {
    shop_name: "PetPosture",
    shop_logo: null,
    shop_favicon: null,
    description:
        "At PetPosture, we believe pets deserve comfort built for them. We provide ergonomic essentials designed to support your pet's unique posture and improve their health.",
    social: {
        facebook: null,
        instagram: null,
        twitter: null,
        tiktok: null,
        pinterest: null,
        youtube: null,
    },
};

const SettingsContext = createContext<ShopSettings>(defaults);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<ShopSettings>(defaults);

    useEffect(() => {
        fetch(`${getApiBaseUrl()}/api/settings`)
            .then((r) => r.json())
            .then((json) => {
                const d = json?.data ?? {};
                setSettings({
                    shop_name: d.shop_name || defaults.shop_name,
                    shop_logo: d.shop_logo || null,
                    shop_favicon: d.shop_favicon || null,
                    description: d.description || defaults.description,
                    social: {
                        facebook: d.social?.facebook || null,
                        instagram: d.social?.instagram || null,
                        twitter: d.social?.twitter || null,
                        tiktok: d.social?.tiktok || null,
                        pinterest: d.social?.pinterest || null,
                        youtube: d.social?.youtube || null,
                    },
                });
            })
            .catch(() => {
                // silently fall back to defaults
            });
    }, []);

    return (
        <SettingsContext.Provider value={settings}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
