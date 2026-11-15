import FaqsPage from "@/components/FaqsPage";
import { FAQ_ITEMS } from "@/lib/faq-data";
import { SITE_URL } from "@/lib/site";
import { headers } from "next/headers";

export const metadata = {
    title: "Frequently Asked Questions",
    // SHOP-HIDDEN: this read "...about PetPosture products, shipping, and returns." Revert the "hide the shop
    // chrome" commits to restore it.
    description: "Find answers to common questions about PetPosture products.",
    alternates: { canonical: '/faqs' },
};

export default async function Page() {
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        url: `${SITE_URL}/faqs`,
        mainEntity: FAQ_ITEMS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };

    return (
        <>
            <script
                nonce={nonce}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <FaqsPage />
        </>
    );
}
