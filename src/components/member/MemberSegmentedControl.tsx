import type { KeyboardEvent } from "react";

type Segment<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
};

// eslint-disable-next-line react-refresh/only-export-components -- Consumers share these reciprocal IDs.
export function memberSegmentIds(baseId: string, value: string) {
  return {
    tabId: `${baseId}-tab-${value}`,
    panelId: `${baseId}-panel-${value}`,
  };
}

export function MemberSegmentedControl<Value extends string>({
  baseId,
  label,
  value,
  items,
  onChange,
  dir,
}: {
  baseId: string;
  label: string;
  value: Value;
  items: readonly [Segment<Value>, ...Segment<Value>[]];
  onChange: (value: Value) => void;
  dir: "rtl" | "ltr";
}) {
  const selectedValue = items.some((item) => item.value === value) ? value : items[0].value;

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
    <div className="member-segmented-control-frame" dir={dir}>
      <div
        className="member-segmented-control no-scrollbar"
        role="tablist"
        aria-label={label}
        dir={dir}
      >
        {items.map((item, index) => {
          const selected = item.value === selectedValue;
          const { tabId, panelId } = memberSegmentIds(baseId, item.value);
          return (
            <button
              key={item.value}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
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
    </div>
  );
}
