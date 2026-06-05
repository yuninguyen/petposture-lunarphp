import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog Management",
};

export default function AdminBlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
