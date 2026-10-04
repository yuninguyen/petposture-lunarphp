import type { Metadata } from 'next';
import AirwallexWalletSpike from './AirwallexWalletSpike';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Airwallex Google Pay spike', robots: { index: false, follow: false } };

// THROWAWAY spike: delete this folder with the backend AirwallexWalletSpikeController and its two routes.
export default function Page() {
  return <AirwallexWalletSpike />;
}
