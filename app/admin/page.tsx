import { redirect } from "next/navigation";

export default function AdminPage() {
  // There is no authentication provider yet, so never expose a dashboard placeholder.
  redirect("/admin/login");
}
