import BlogPage from "@/components/BlogPage";

export const metadata = {
    title: "Blog - Practical Pet Care Guides & Stories",
    description: "Explore practical pet care guidance, breed-focused research, and collection previews from PetPosture.",
    alternates: { canonical: '/blog' },
};

export default function Page() {
    return <BlogPage />;
}
