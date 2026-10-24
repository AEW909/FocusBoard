"use client";

import { useActionState, useState } from "react";
import { createDisplayTokenAction, type CreateTokenState } from "@/app/clients/display/actions";

const initialState: CreateTokenState = {};

export function DisplayTokenForm({ groups }: { groups: string[] }) {
  const [state, formAction, pending] = useActionState(createDisplayTokenAction, initialState);
  const [copied, setCopied] = useState(false);
  const url = state.path ? `${window.location.origin}${state.path}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={formAction} className="focus-control-form">
      <div className="focus-control-two-up">
        <label className="field">
          <span>Display group</span>
          <input defaultValue={groups[0] ?? ""} list="display-groups" name="displayGroup" required />
          <datalist id="display-groups">
            {groups.map((group) => (
              <option key={group} value={group} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Label (for example Kitchen Echo)</span>
          <input maxLength={60} name="label" />
        </label>
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Creating..." : "Create display link"}
      </button>

      {url ? (
        <div className="focus-control-form">
          <p className="form-success">
            Copy this link now. It is shown once and cannot be recovered; revoke it and create a new
            one if it is lost.
          </p>
          <label className="field">
            <span>Display link</span>
            <input onFocus={(event) => event.currentTarget.select()} readOnly value={url} />
          </label>
          <button className="button" onClick={copy} type="button">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
