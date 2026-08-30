declare const condition: boolean;
declare const lang: "en" | "he" | "ar";

const baseArray = [
  { body: "Array phone 055-101-0001." },
  { body: "Array email spread-base@example.com." },
];
const nestedArray = [...baseArray, { body: "Array URL https://example.com/nested." }];
const conditionalArray = condition
  ? nestedArray
  : [{ body: "Conditional array phone 055-202-0002." }];
const languageArrays = {
  en: [{ body: "English array phone 055-303-0003." }],
  he: [{ body: "מערך spread-he@example.com." }],
  ar: [{ body: "مصفوفة https://example.com/ar." }],
};
const visibleArray = [...conditionalArray, ...languageArrays[lang]];

const selfArray = [...selfArray];
const mutualArrayA = [...mutualArrayB];
const mutualArrayB = [...mutualArrayA];
const cycleSafeArray = [
  ...selfArray,
  ...mutualArrayA,
  { body: "Cycle-safe array cycle-safe@example.com." },
];

const baseObject = {
  primaryBody: "Object phone 055-505-0005.",
  body: "Stale stale-object@example.com.",
};
const nestedObject = { ...baseObject, body: "Nested nested-object@example.com." };
const conditionalObject = condition
  ? { conditionalBody: "Conditional object phone 055-606-0006." }
  : { conditionalBody: "Conditional object email conditional-object@example.com." };
const languageObjects = {
  en: { languageBody: "English object https://example.com/object/en." },
  he: { languageBody: "אובייקט 055-707-0007." },
  ar: { languageBody: "كائن spread-ar@example.com." },
};
const overrideObject = { body: "Final override https://example.com/object/final." };
const mergedObject = {
  ...nestedObject,
  ...conditionalObject,
  ...languageObjects[lang],
  ...overrideObject,
  finalBody: "Final object final-object@example.com.",
};

const selfObject = { ...selfObject };
const mutualObjectA = { ...mutualObjectB };
const mutualObjectB = { ...mutualObjectA };
const cycleSafeObject = {
  ...selfObject,
  ...mutualObjectA,
  cycleBody: "Cycle-safe object https://example.com/object/cycle.",
};

export function SpreadStaticFixture() {
  return (
    <main>
      {[...visibleArray, ...cycleSafeArray].map((item) => (
        <p key={item.body}>{item.body}</p>
      ))}
      {[mergedObject, cycleSafeObject].map((item) => (
        <section key={item.body}>
          <p>{item.primaryBody}</p>
          <p>{item.body}</p>
          <p>{item.conditionalBody}</p>
          <p>{item.languageBody}</p>
          <p>{item.finalBody}</p>
          <p>{item.cycleBody}</p>
        </section>
      ))}
    </main>
  );
}
