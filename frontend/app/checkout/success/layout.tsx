import type { Metadata } from "next";

// NOTE: page.tsx uses `await connection()` (Next 15+'s force-dynamic
// replacement) on an async component, which — unlike the sync
// `dynamic = 'force-dynamic'` pattern used elsewhere — does not compose
// with the root layout's title.template. Hardcoding the full title here
// works around it; a plain `title: "Order Confirmed"` renders as a bare
// "Order Confirmed" tab title with no "| PetPosture" suffix.
export const metadata: Metadata = {
  title: "Order Confirmed | PetPosture",
};

export default function CheckoutSuccessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
