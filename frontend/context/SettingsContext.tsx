"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

interface ShopSettings {
    shop_name: string;
    shop_logo: string | null;
    description: string | null;
}

const defaults: ShopSettings = {
    shop_name: "PetPosture",
    shop_logo: null,
    description:
        "At PetPosture, we believe pets deserve comfort built for them. We provide ergonomic essentials designed to support your pet's unique posture and improve their health.",
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
                    description: d.description || defaults.description,
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
