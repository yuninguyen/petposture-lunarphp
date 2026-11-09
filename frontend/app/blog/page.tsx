import BlogPage from "@/components/BlogPage";
import { fetchBlogIndex } from "@/lib/storefront-content";

export const metadata = {
    title: "Blog - Practical Pet Care Guides & Stories",
    description: "Explore practical pet care guidance, breed-focused research, and collection previews from PetPosture.",
    alternates: { canonical: '/blog' },
};

export default async function Page() {
    return <BlogPage initialData={await fetchBlogIndex()} />;
}
