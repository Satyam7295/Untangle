import { requireAdmin } from "../../src/lib/admin-auth";
import { logoutAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <section className="auth-page" aria-labelledby="admin-title">
      <p className="eyebrow">Admin mode</p>
      <h1 id="admin-title">Admin tools</h1>
      <p className="lead">You are signed in as the administrator.</p>
      <form action={logoutAdmin}>
        <button className="primary-button" type="submit">Sign out</button>
      </form>
    </section>
  );
}
