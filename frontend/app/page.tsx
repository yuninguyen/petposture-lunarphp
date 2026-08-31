import type { Metadata } from 'next';
import HomePage from "@/components/HomePage";
import { getApiBaseUrl } from "@/lib/api";

export const metadata: Metadata = {
    alternates: { canonical: '/' },
};

async function fetchHeroImage(): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/site-media?collection=banner`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items: { title: string | null; url: string }[] = json?.data ?? [];
    return items.find((item) => item.title === "hero")?.url ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const heroImage = await fetchHeroImage();
  return <HomePage heroImage={heroImage} />;
}
