import Link from "next/link";

import { logoutAdmin } from "./actions";

export default function ConfigurationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="admin-nav" aria-label="Admin workspace">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/policies">Policy document</Link>
        <form action={logoutAdmin}><button className="text-button" type="submit">Sign out</button></form>
      </nav>
      {children}
    </>
  );
}
