"use client";

import { useActionState, useState, useTransition } from "react";

import type { ActionState } from "./configuration-actions";

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubcategoryRecord = CategoryRecord & {
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
};

export type PriorityRecord = CategoryRecord & { severity: number };

type SaveAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;
type ToggleAction = (id: string, isActive: boolean) => Promise<ActionState>;

type Props = {
  title: string;
  description: string;
  records: CategoryRecord[] | SubcategoryRecord[] | PriorityRecord[];
  saveAction: SaveAction;
  toggleAction: ToggleAction;
  kind: "category" | "subcategory" | "priority";
  categories?: CategoryRecord[];
};

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString();
}

function ToggleButton({
  record,
  toggleAction,
}: {
  record: CategoryRecord;
  toggleAction: ToggleAction;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const nextStatus = !record.isActive;

  function handleClick() {
    if (!window.confirm(`${nextStatus ? "Activate" : "Deactivate"} ${record.name}?`)) return;
    startTransition(async () => {
      const result = await toggleAction(record.id, nextStatus);
      setMessage(result.error ?? result.success ?? "");
      if (!result.error) window.location.reload();
    });
  }

  return (
    <span className="action-stack">
      <button className="text-button" type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? "Saving..." : nextStatus ? "Activate" : "Deactivate"}
      </button>
      {message ? <span className="inline-error" role="alert">{message}</span> : null}
    </span>
  );
}

function ConfigurationForm({
  record,
  saveAction,
  kind,
  categories,
  onDone,
}: {
  record: CategoryRecord | SubcategoryRecord | PriorityRecord | null;
  saveAction: SaveAction;
  kind: Props["kind"];
  categories?: CategoryRecord[];
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveAction, {});
  const subcategory = kind === "subcategory" && record ? record as SubcategoryRecord : null;
  const priority = kind === "priority" && record ? record as PriorityRecord : null;

  return (
    <form className="config-form" action={formAction} aria-label={record ? `Edit ${kind}` : `Create ${kind}`}>
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      <div className="config-form-grid">
        <div>
          <label className="field-label" htmlFor={`${kind}-name`}>Name</label>
          <input className="auth-input" id={`${kind}-name`} name="name" defaultValue={record?.name ?? ""} maxLength={100} required />
        </div>
        <div>
          <label className="field-label" htmlFor={`${kind}-slug`}>Slug</label>
          <input className="auth-input" id={`${kind}-slug`} name="slug" defaultValue={record?.slug ?? ""} maxLength={100} placeholder="Generated from name if blank" />
        </div>
        {kind === "subcategory" ? (
          <div>
            <label className="field-label" htmlFor="subcategory-category">Parent category</label>
            <select className="auth-input" id="subcategory-category" name="categoryId" defaultValue={subcategory?.categoryId ?? ""} required>
              <option value="">Select a category</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {kind === "priority" ? (
          <div>
            <label className="field-label" htmlFor="priority-severity">Severity / order</label>
            <input className="auth-input" id="priority-severity" name="severity" type="number" min="0" max="1000" step="1" defaultValue={priority?.severity ?? 0} required />
          </div>
        ) : null}
        <div className="config-description">
          <label className="field-label" htmlFor={`${kind}-description`}>Description</label>
          <textarea className="auth-input config-textarea" id={`${kind}-description`} name="description" maxLength={1000} defaultValue={record?.description ?? ""} />
        </div>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : record ? "Save changes" : `Add ${kind}`}
        </button>
        {record ? <button className="secondary-button" type="button" onClick={onDone}>Cancel</button> : null}
      </div>
      {state.error ? <p className="error-message" role="alert">{state.error}</p> : null}
      {state.success ? <p className="pending-message" role="status">{state.success}</p> : null}
    </form>
  );
}

export default function ConfigurationSection({
  title,
  description,
  records,
  saveAction,
  toggleAction,
  kind,
  categories,
}: Props) {
  const [editing, setEditing] = useState<CategoryRecord | SubcategoryRecord | PriorityRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="admin-section" aria-labelledby={`${kind}-title`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1 id={`${kind}-title`}>{title}</h1>
          <p className="lead">{description}</p>
        </div>
        <button className="primary-button" type="button" onClick={() => { setEditing(null); setShowForm(true); }}>
          Add {kind}
        </button>
      </div>
      {showForm ? (
        <ConfigurationForm
          record={editing}
          saveAction={saveAction}
          kind={kind}
          categories={categories}
          onDone={() => { setEditing(null); setShowForm(false); }}
        />
      ) : null}
      {records.length === 0 ? (
        <div className="empty-state"><h2>No {kind}s yet</h2><p>Use “Add {kind}” to create the first configuration record.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="config-table">
            <caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Slug</th>{kind === "subcategory" ? <th scope="col">Parent</th> : null}{kind === "priority" ? <th scope="col">Severity</th> : null}<th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {records.map((record) => {
                const subcategory = kind === "subcategory" ? record as SubcategoryRecord : null;
                const priority = kind === "priority" ? record as PriorityRecord : null;
                return (
                  <tr key={record.id}>
                    <th scope="row"><strong>{record.name}</strong>{record.description ? <span className="table-detail">{record.description}</span> : null}</th>
                    <td><code>{record.slug}</code></td>
                    {subcategory ? <td>{subcategory.categoryName}{subcategory.categoryIsActive ? "" : <span className="inactive-note"> (inactive)</span>}</td> : null}
                    {priority ? <td>{priority.severity}</td> : null}
                    <td><span className={record.isActive ? "status-badge active" : "status-badge"}>{record.isActive ? "Active" : "Inactive"}</span></td>
                    <td>{dateLabel(record.updatedAt)}</td>
                    <td><div className="row-actions"><button className="text-button" type="button" onClick={() => { setEditing(record); setShowForm(true); }}>Edit</button><ToggleButton record={record} toggleAction={toggleAction} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
