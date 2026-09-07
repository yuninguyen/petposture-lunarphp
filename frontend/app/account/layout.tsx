import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "My Account",
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return <>{children}</>;
}
