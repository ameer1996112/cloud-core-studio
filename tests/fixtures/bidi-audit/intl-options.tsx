declare function BidiValue(props: { kind: string; children: unknown }): JSX.Element;
declare const dynamicOptions: Intl.DateTimeFormatOptions;

const stamp = new Date(0);

export function IntlOptionsFixture() {
  const noOptions = stamp.toLocaleString();
  const emptyOptions = stamp.toLocaleString("en-US", {});
  const neutralOptions = stamp.toLocaleString("en-US", {
    calendar: "gregory",
    timeZone: "UTC",
    numberingSystem: "latn",
    hour12: false,
    hourCycle: "h23",
  });
  const fractionalCombined = stamp.toLocaleString("en-US", {
    year: "numeric",
    fractionalSecondDigits: 3,
  });
  const dayPeriodCombined = stamp.toLocaleString("en-US", {
    month: "long",
    dayPeriod: "short",
  });
  const timeZoneNameCombined = stamp.toLocaleString("en-US", {
    day: "numeric",
    timeZoneName: "short",
  });
  const unknownOptions = stamp.toLocaleString("en-US", dynamicOptions);
  const dateOnly = stamp.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeOnly = stamp.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStyleOnly = stamp.toLocaleString("en-US", { dateStyle: "long" });
  const eraOnly = stamp.toLocaleString("en-US", { era: "long" });
  const secondsOnly = stamp.toLocaleString("en-US", { second: "2-digit" });
  const fractionalOnly = stamp.toLocaleString("en-US", { fractionalSecondDigits: 3 });
  const dayPeriodOnly = stamp.toLocaleString("en-US", { dayPeriod: "long" });
  const timeZoneNameOnly = stamp.toLocaleString("en-US", { timeZoneName: "long" });
  const timeStyleOnly = stamp.toLocaleString("en-US", { timeStyle: "long" });

  return (
    <main>
      <BidiValue kind="localized-date">{noOptions}</BidiValue>
      <BidiValue kind="localized-date">{emptyOptions}</BidiValue>
      <BidiValue kind="localized-date">{neutralOptions}</BidiValue>
      <BidiValue kind="localized-date">{fractionalCombined}</BidiValue>
      <BidiValue kind="localized-date">{dayPeriodCombined}</BidiValue>
      <BidiValue kind="localized-date">{timeZoneNameCombined}</BidiValue>
      <BidiValue kind="localized-date">{unknownOptions}</BidiValue>
      <BidiValue kind="localized-date">{dateOnly}</BidiValue>
      <BidiValue kind="time-range">{timeOnly}</BidiValue>
      <BidiValue kind="localized-date">{dateStyleOnly}</BidiValue>
      <BidiValue kind="localized-date">{eraOnly}</BidiValue>
      <BidiValue kind="time-range">{secondsOnly}</BidiValue>
      <BidiValue kind="time-range">{fractionalOnly}</BidiValue>
      <BidiValue kind="time-range">{dayPeriodOnly}</BidiValue>
      <BidiValue kind="time-range">{timeZoneNameOnly}</BidiValue>
      <BidiValue kind="time-range">{timeStyleOnly}</BidiValue>
    </main>
  );
}
