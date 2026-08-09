import OurMissionPage from "@/components/OurMissionPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Mission",
  alternates: { canonical: '/our-mission' },
};

export default function Mission() {
    return <OurMissionPage />;
}
