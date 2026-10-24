import { Fragment } from "react";
import { TEMPLATE_VARIABLES } from "../lib/messaging";

/** Template wording with {{fields}} shown as readable tokens ("First name") instead of raw braces. */
export function TemplateText({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*[a-z_]+\s*\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const key = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(p)?.[1];
        if (!key) return <Fragment key={i}>{p}</Fragment>;
        const label = TEMPLATE_VARIABLES.find((v) => v.key === key)?.label.replace(/^Contact /, "");
        return (
          <span key={i} className="mx-0.5 inline-flex rounded bg-brand-50 px-1.5 text-[0.8em] font-medium whitespace-nowrap text-brand-800" title={`Filled in for each person: {{${key}}}`}>
            {label ? label.charAt(0).toUpperCase() + label.slice(1) : key}
          </span>
        );
      })}
    </>
  );
}
