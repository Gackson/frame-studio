import { useId } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
export function Section({
  title,
  children,
  action,
  initialOpen = true,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  initialOpen?: boolean;
}) {
  return (
    <details className="section" open={initialOpen}>
      <summary>
        <span>{title}</span>
        <span className="section-actions">
          {action}
          <ChevronDown size={14} />
        </span>
      </summary>
      <div className="section-content">{children}</div>
    </details>
  );
}
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  unit = "°",
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`slider-field ${disabled ? "disabled" : ""}`}>
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <span className="number-field">
          <input
            aria-label={`${label}数值`}
            type="number"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
          />
          <span>{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className="toggle-row"
      role="switch"
      aria-checked={value}
      onClick={onChange}
    >
      <span>{label}</span>
      <span className={`toggle ${value ? "on" : ""}`}>
        <i />
      </span>
    </button>
  );
}
export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      title="重置角度"
      aria-label="重置角度"
      className="icon-button tiny"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <RotateCcw size={13} />
    </button>
  );
}
