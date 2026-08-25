import type { KeyboardEvent } from "react";

type Segment<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
};

export function MemberSegmentedControl<Value extends string>({
  label,
  value,
  items,
  onChange,
  dir,
}: {
  label: string;
  value: Value;
  items: Segment<Value>[];
  onChange: (value: Value) => void;
  dir: "rtl" | "ltr";
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const visualDelta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const delta = dir === "rtl" ? -visualDelta : visualDelta;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + delta + items.length) % items.length;

    if (delta !== 0 || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onChange(items[nextIndex].value);
      const next =
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[
          nextIndex
        ];
      next?.focus();
      next?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  return (
    <div
      className="member-segmented-control no-scrollbar"
      role="tablist"
      aria-label={label}
      dir={dir}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="member-segmented-control__tab"
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => move(event, index)}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span aria-label={`${item.count}`}> · {item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
