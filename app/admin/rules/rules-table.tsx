"use client";

import { useState, useTransition } from "react";
import type { RuleActionState } from "./actions";
import RuleForm from "./rule-form";

type RuleRecord = { id: string; name: string; description: string | null; conditionMode: "ALL" | "ANY"; conditions: unknown; actions: unknown; precedence: number; isActive: boolean; effectiveFrom: string | null; effectiveUntil: string | null; updatedAt: string };
type ToggleAction = (id: string, active: boolean) => Promise<RuleActionState>;

export function getRuleEffectiveState(record: Pick<RuleRecord, "isActive" | "effectiveFrom" | "effectiveUntil">, now = new Date()): "inactive" | "scheduled" | "active" | "expired" {
  if (!record.isActive) return "inactive";
  if (record.effectiveFrom && new Date(record.effectiveFrom) > now) return "scheduled";
  if (record.effectiveUntil && new Date(record.effectiveUntil) <= now) return "expired";
  return "active";
}

export default function RulesTable({ records, saveAction, toggleAction }: { records: RuleRecord[]; saveAction: (state: RuleActionState, data: FormData) => Promise<RuleActionState>; toggleAction: ToggleAction; form: React.ReactNode }) {
  const [editing, setEditing] = useState<RuleRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [pending, startTransition] = useTransition();
  const visible = records.filter((record) => record.name.toLowerCase().includes(query.toLowerCase()) && (status === "all" || (status === "active" ? record.isActive : !record.isActive)));
  return <section className="admin-section"><div className="section-heading"><div><p className="eyebrow">Configuration</p><h1>Business rules</h1><p className="lead">Manage validated rule configurations. Rules are stored only; they are not executed here.</p></div><button className="primary-button" type="button" onClick={() => { setEditing(null); setShowForm(true); }}>Add rule</button></div>
    {showForm ? <RuleForm record={editing} saveAction={saveAction} onDone={() => setShowForm(false)} /> : null}
    <div className="filter-row"><input className="auth-input" aria-label="Search rules" placeholder="Search by name" value={query} onChange={(event) => setQuery(event.target.value)} /><select className="auth-input" aria-label="Filter rules" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    {visible.length === 0 ? <div className="empty-state"><h2>No matching rules</h2><p>Create a rule or adjust the search and status filter.</p></div> : <div className="table-wrap"><table className="config-table"><caption className="sr-only">Business rules</caption><thead><tr><th>Name</th><th>Precedence</th><th>Effective range</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{visible.map((record) => { const effectiveState = getRuleEffectiveState(record); return <tr key={record.id}><th scope="row"><strong>{record.name}</strong>{record.description ? <span className="table-detail">{record.description}</span> : null}</th><td>{record.precedence}</td><td>{record.effectiveFrom ? new Date(record.effectiveFrom).toLocaleString() : "Immediately"} – {record.effectiveUntil ? new Date(record.effectiveUntil).toLocaleString() : "No end"}</td><td><span className={effectiveState === "active" ? "status-badge active" : "status-badge"}>{effectiveState === "scheduled" ? "Scheduled" : effectiveState === "expired" ? "Expired" : effectiveState === "active" ? "Active" : "Inactive"}</span></td><td>{new Date(record.updatedAt).toLocaleDateString()}</td><td><div className="row-actions"><button className="text-button" type="button" onClick={() => { setEditing(record); setShowForm(true); }}>Edit</button><button className="text-button" type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await toggleAction(record.id, !record.isActive); if (result.error) window.alert(result.error); else window.location.reload(); })}>{record.isActive ? "Deactivate" : "Activate"}</button></div></td></tr>; })}</tbody></table></div>}
  </section>;
}
