import FaqsPage from "@/components/FaqsPage";

export const metadata = {
    title: "Frequently Asked Questions",
    description: "Find answers to common questions about PetPosture ergonomic products, shipping, and returns.",
    alternates: { canonical: '/faqs' },
};

export default function Page() {
    return <FaqsPage />;
}
