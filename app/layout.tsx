import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Untangle | Make sense of complex questions",
  description: "A clear starting point for writing and routing your query.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="site-header">
            <Link className="brand" href="/" aria-label="Untangle home">
              <span className="brand-mark" aria-hidden="true">U</span>
              <span className="brand-name">Untangle</span>
            </Link>
            <Link className="header-link" href="/admin/login">Admin sign-in</Link>
          </header>
          <main className="main">{children}</main>
          <footer className="site-footer">Untangle is a focused starting point for clearer questions.</footer>
        </div>
      </body>
    </html>
  );
}
