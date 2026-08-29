import ContactPage from "@/components/ContactPage";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact Us",
    description: "Get in touch with the PetPosture team for product questions, order support, and breed-focused guidance.",
    alternates: { canonical: '/contact' },
};

export default function Contact() {
    return <ContactPage />;
}
