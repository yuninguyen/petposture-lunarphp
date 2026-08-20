import OurMissionPage from "@/components/OurMissionPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Mission",
  description: "PetPosture helps dog owners choose products that fit their breed, body type and everyday habits — not a one-size-fits-all catalog.",
  alternates: { canonical: '/our-mission' },
  openGraph: {
    description: "Dogs aren't one-size-fits-all. See why PetPosture organizes products around breed, body type and everyday use.",
  },
};

export default function Mission() {
    return <OurMissionPage />;
}
