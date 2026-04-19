import OurMissionPage from "@/components/OurMissionPage";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Our Mission | PetPosture",
    description: "Learn about PetPosture's mission to provide specialized ergonomic solutions for unique breeds like Pugs, Frenchies, and Dachshunds.",
};

export default function Mission() {
    return <OurMissionPage />;
}
