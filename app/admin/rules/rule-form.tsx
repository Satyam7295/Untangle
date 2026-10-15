"use client";

import { useActionState, useState } from "react";

import type { RuleActionState } from "./actions";
import { RULE_ACTION_TYPES, RULE_FIELDS, RULE_OPERATORS, type RuleAction, type RuleCondition } from "../../../src/lib/configuration-validation";

type RuleRecord = {
  id: string;
  name: string;
  description: string | null;
  conditionMode: "ALL" | "ANY";
  conditions: unknown;
  actions: unknown;
  precedence: number;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  updatedAt: string;
};

const blankCondition = (): RuleCondition => ({ field: "categoryId", operator: "EQUALS", value: "" });
const blankAction = (): RuleAction => ({ type: "SET_PRIORITY", value: "" });

export default function RuleForm({ record, saveAction, onDone }: { record: RuleRecord | null; saveAction: (state: RuleActionState, data: FormData) => Promise<RuleActionState>; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveAction, {});
  const [conditions, setConditions] = useState<RuleCondition[]>(record?.conditions as RuleCondition[] ?? [blankCondition()]);
  const [actions, setActions] = useState<RuleAction[]>(record?.actions as RuleAction[] ?? [blankAction()]);
  const [conditionMode, setConditionMode] = useState(record?.conditionMode ?? "ALL");

  function updateCondition(index: number, patch: Partial<RuleCondition>) {
    setConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  return (
    <form className="config-form" action={formAction}>
      {record ? <><input type="hidden" name="id" value={record.id} /><input type="hidden" name="updatedAt" value={record.updatedAt} /></> : null}
      <div className="config-form-grid">
        <div><label className="field-label" htmlFor="rule-name">Name</label><input className="auth-input" id="rule-name" name="name" defaultValue={record?.name ?? ""} maxLength={100} required /></div>
        <div><label className="field-label" htmlFor="rule-precedence">Precedence</label><input className="auth-input" id="rule-precedence" name="precedence" type="number" min="0" max="1000000" defaultValue={record?.precedence ?? 0} required /></div>
        <div className="config-description"><label className="field-label" htmlFor="rule-description">Description</label><textarea className="auth-input config-textarea" id="rule-description" name="description" maxLength={1000} defaultValue={record?.description ?? ""} /></div>
        <div><label className="field-label" htmlFor="rule-start">Effective from</label><input className="auth-input" id="rule-start" name="effectiveFrom" type="datetime-local" defaultValue={record?.effectiveFrom ? record.effectiveFrom.slice(0, 16) : ""} /></div>
        <div><label className="field-label" htmlFor="rule-end">Effective until <span className="inactive-note">(optional)</span></label><input className="auth-input" id="rule-end" name="effectiveUntil" type="datetime-local" defaultValue={record?.effectiveUntil ? record.effectiveUntil.slice(0, 16) : ""} /></div>
      </div>
      <fieldset className="rule-builder"><legend>Conditions</legend><label className="field-label" htmlFor="rule-mode">Match</label><select className="auth-input" id="rule-mode" value={conditionMode} onChange={(event) => setConditionMode(event.target.value as "ALL" | "ANY")} name="conditionMode"><option value="ALL">All conditions</option><option value="ANY">Any condition</option></select>
        {conditions.map((condition, index) => <div className="rule-row" key={index}><select className="auth-input" value={condition.field} onChange={(event) => updateCondition(index, { field: event.target.value as RuleCondition["field"], operator: "EQUALS" })}>{RULE_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}</select><select className="auth-input" value={condition.operator} onChange={(event) => updateCondition(index, { operator: event.target.value as RuleCondition["operator"] })}>{RULE_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select>{condition.operator !== "IS_EMPTY" && condition.operator !== "IS_NOT_EMPTY" ? <input className="auth-input" value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value ?? ""} placeholder={condition.operator === "IN" || condition.operator === "NOT_IN" ? "comma-separated values" : "value"} onChange={(event) => updateCondition(index, { value: condition.operator === "IN" || condition.operator === "NOT_IN" ? event.target.value.split(",").map((item) => item.trim()) : event.target.value })} /> : null}<button className="text-button" type="button" onClick={() => setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}
        <button className="secondary-button" type="button" onClick={() => setConditions((current) => [...current, blankCondition()])}>Add condition</button>
      </fieldset>
      <fieldset className="rule-builder"><legend>Actions</legend>{actions.map((action, index) => <div className="rule-row" key={index}><select className="auth-input" value={action.type} onChange={(event) => setActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as RuleAction["type"] } : item))}>{RULE_ACTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select><input className="auth-input" value={action.value} placeholder="configuration value or ID" onChange={(event) => setActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} /><button className="text-button" type="button" onClick={() => setActions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<button className="secondary-button" type="button" onClick={() => setActions((current) => [...current, blankAction()])}>Add action</button></fieldset>
      <input type="hidden" name="conditions" value={JSON.stringify(conditions)} /><input type="hidden" name="actions" value={JSON.stringify(actions)} /><label className="checkbox-label"><input type="checkbox" name="isActive" value="true" defaultChecked={record?.isActive ?? true} /> Active</label>
      <div className="form-actions"><button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving..." : record ? "Save changes" : "Add rule"}</button>{record ? <button className="secondary-button" type="button" onClick={onDone}>Cancel</button> : null}</div>
      {state.error ? <p className="error-message" role="alert">{state.error}</p> : null}{state.success ? <p className="pending-message" role="status">{state.success}</p> : null}
    </form>
  );
}
