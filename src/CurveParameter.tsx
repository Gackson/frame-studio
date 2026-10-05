import { useState } from "react";

export function CurveParameter({
  label,
  name,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange(value: number): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="curve-parameter">
      <label>
        <span>{label}</span>
        <input
          aria-label={name}
          title={`${min} – ${max}；回车或失焦确认`}
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (
              draft !== null &&
              draft.trim() !== "" &&
              Number.isFinite(Number(draft))
            ) {
              onChange(Math.max(min, Math.min(max, Number(draft))));
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(null);
            }
          }}
        />
      </label>
      <input
        aria-label={`${name}滑杆`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setDraft(null);
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}
