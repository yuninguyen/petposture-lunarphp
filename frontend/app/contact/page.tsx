import ContactPage from "@/components/ContactPage";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact Us | PetPosture",
    description: "Get in touch with the PetPosture pack for ergonomic pet essentials, order support, and expert posture advice.",
};

export default function Contact() {
    return <ContactPage />;
}
