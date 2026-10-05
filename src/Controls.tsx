import { useId } from "react";
import { ChevronDown, RotateCcw, Check, Plus } from "lucide-react";
import type { ReactNode } from "react";
export function CustomColorSlot({
  label,
  color,
  selected,
  onSelect,
}: {
  label: string;
  color: string | null;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      className={`custom-color-slot ${selected ? "chosen" : ""}`}
      aria-label={label}
      aria-pressed={selected}
      title={color ? label : "使用取色器设置自定义颜色后，将保留在这里"}
      disabled={!color}
      style={{ background: color ?? "var(--soft)" }}
      onClick={onSelect}
    >
      {!color ? (
        <Plus size={12} />
      ) : selected ? (
        <Check size={12} />
      ) : (
        <span>自</span>
      )}
    </button>
  );
}
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
  continuous = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
  disabled?: boolean;
  continuous?: boolean;
}) {
  const id = useId();
  // Keep the track fixed while numeric input and model dragging retain full turns.
  const rangeValue = Math.max(min, Math.min(max, value));
  return (
    <div className={`slider-field ${disabled ? "disabled" : ""}`}>
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <span className="number-field">
          <input
            aria-label={`${label}数值`}
            type="number"
            min={continuous ? undefined : min}
            max={continuous ? undefined : max}
            value={Math.round(value * 100) / 100}
            disabled={disabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v))
                onChange(continuous ? v : Math.max(min, Math.min(max, v)));
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
        value={Math.round(rangeValue * 100) / 100}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--fill": `${((rangeValue - min) / (max - min)) * 100}%`,
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
export function ResetButton({
  onClick,
  label = "重置角度",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
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
