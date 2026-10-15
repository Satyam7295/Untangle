import Link from "next/link";

import { logoutAdmin } from "./actions";

export default function ConfigurationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="admin-nav" aria-label="Admin configuration">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/subcategories">Subcategories</Link>
        <Link href="/admin/priorities">Priorities</Link>
        <Link href="/admin/rules">Business rules</Link>
        <form action={logoutAdmin}><button className="text-button" type="submit">Sign out</button></form>
      </nav>
      {children}
    </>
  );
}
