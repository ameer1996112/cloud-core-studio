export function nextLanguageMenuIndex(
  key: string,
  focusedIndex: number,
  selectedIndex: number,
  itemCount: number,
): number | null {
  if (itemCount < 1) return null;

  const startIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex;
  if (key === "ArrowDown") return (startIndex + 1) % itemCount;
  if (key === "ArrowUp") return (startIndex - 1 + itemCount) % itemCount;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  return null;
}
