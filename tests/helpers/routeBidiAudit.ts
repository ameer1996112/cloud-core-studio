import { readFileSync } from "node:fs";
import { basename } from "node:path";
import ts from "typescript";

import { embeddedBidiSegments } from "../../src/lib/bidi-format";
import { typescriptFilesUnder } from "./typescriptDependencyGraph";

export type RouteBidiCategory =
  | "contact"
  | "currency"
  | "identifier"
  | "localized-date"
  | "time-range"
  | "technical-input";

export interface RouteBidiFinding {
  file: string;
  line: number;
  category: RouteBidiCategory;
  snippet: string;
}

export const ROUTE_BIDI_AUDIT_EXCLUSIONS = [
  "authored prose and translation strings containing ordinary counts or illustrative currency copy",
  "non-visible href, metadata, query, storage, and server payload values",
  "plain numeric form controls whose values have no directional text",
] as const;

const DATE_CALLS = new Set([
  "formatDate",
  "formatMessageDate",
  "formatRelative",
  "formatSessionDate",
  "toLocaleDateString",
]);
const COMBINED_DATE_TIME_CALLS = new Set(["formatDateTime"]);
const SHARED_COMBINED_DATE_TIME_CALLS = new Set(["formatBidiDateAndTime", "formatBidiDateTime"]);
const TIME_CALLS = new Set([
  "formatClassTime",
  "formatMessageTime",
  "formatSessionTime",
  "formatTime",
  "toLocaleTimeString",
]);
const CURRENCY_CALLS = new Set(["formatPaymentAmount", "formatPlanPrice", "ils"]);

function jsxTagName(tagName: ts.JsxTagNameExpression): string {
  return tagName.getText();
}

function jsxAttribute(opening: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | null {
  for (const property of opening.attributes.properties) {
    if (ts.isJsxAttribute(property) && property.name.getText() === name) return property;
  }
  return null;
}

function attributeText(attribute: ts.JsxAttribute | null): string {
  return attribute?.initializer?.getText() ?? "";
}

function bidiKindFromOpening(opening: ts.JsxOpeningLikeElement): string | null {
  if (jsxTagName(opening.tagName) !== "BidiValue") return null;
  const kind = jsxAttribute(opening, "kind")?.initializer;
  return kind && ts.isStringLiteral(kind) ? kind.text : null;
}

function enclosingBidiKind(node: ts.Node): string | null {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent)) {
      const kind = bidiKindFromOpening(parent.openingElement);
      if (kind) return kind;
    }
  }
  return null;
}

function callName(call: ts.CallExpression): string {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return "";
}

function stringArgument(call: ts.CallExpression, index: number): string | null {
  const argument = call.arguments[index];
  return argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : null;
}

function enclosingFormatKind(node: ts.Node): string | null {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxExpression(parent)) break;
    if (
      ts.isCallExpression(parent) &&
      callName(parent) === "formatBidiValue" &&
      parent.arguments.some((argument) => argument === node || node.pos >= argument.pos)
    ) {
      return stringArgument(parent, 1);
    }
  }
  return null;
}

function isProtected(node: ts.Node, category: RouteBidiCategory): boolean {
  const kind = enclosingFormatKind(node) ?? enclosingBidiKind(node);
  if (!kind) return false;
  switch (category) {
    case "contact":
      return kind === "email" || kind === "phone" || kind === "url";
    case "currency":
      return kind === "currency";
    case "identifier":
      return kind === "identifier";
    case "localized-date":
      return kind === "localized-date" || kind === "localized-date-range";
    case "time-range":
      return kind === "time-range";
    default:
      return false;
  }
}

const VISIBLE_JSX_ATTRIBUTES = new Set([
  "description",
  "cancellationDeadline",
  "deadline",
  "formatter",
  "helper",
  "meta",
  "prev",
  "right",
  "title",
  "value",
]);

function isRenderedJsxExpressionDescendant(node: ts.Node): boolean {
  let crossedFunctionBoundary = false;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) crossedFunctionBoundary = true;
    if (ts.isJsxExpression(parent)) {
      if (!ts.isJsxAttribute(parent.parent)) return !crossedFunctionBoundary;
      const attributeName = parent.parent.name.getText();
      return (
        VISIBLE_JSX_ATTRIBUTES.has(attributeName) &&
        (!crossedFunctionBoundary || attributeName === "formatter")
      );
    }
    if (ts.isStatement(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

function variableInitializers(source: ts.SourceFile): Map<string, ts.Expression> {
  const initializers = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      initializers.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return initializers;
}

function visibleVariableNames(
  source: ts.SourceFile,
  initializers: ReadonlyMap<string, ts.Expression>,
): Set<string> {
  const visible = new Set<string>();
  const addDirectVisibleIdentifiers = (node: ts.Node) => {
    if (
      ts.isIdentifier(node) &&
      isRenderedJsxExpressionDescendant(node) &&
      !isConditionalGuard(node)
    ) {
      visible.add(node.text);
    }
    ts.forEachChild(node, addDirectVisibleIdentifiers);
  };
  addDirectVisibleIdentifiers(source);

  const expanded = new Set<string>();
  const expand = (name: string) => {
    if (expanded.has(name)) return;
    expanded.add(name);
    const initializer = initializers.get(name);
    if (!initializer) return;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && initializers.has(node.text) && !visible.has(node.text)) {
        visible.add(node.text);
        expand(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(initializer);
  };
  for (const name of [...visible]) expand(name);
  return visible;
}

function directVisibleVariableUses(
  source: ts.SourceFile,
  initializers: ReadonlyMap<string, ts.Expression>,
): Map<string, ts.Identifier[]> {
  const uses = new Map<string, ts.Identifier[]>();
  const visit = (node: ts.Node) => {
    if (
      ts.isIdentifier(node) &&
      initializers.has(node.text) &&
      !isDeclarationName(node) &&
      isRenderedJsxExpressionDescendant(node) &&
      !isConditionalGuard(node)
    ) {
      const nodes = uses.get(node.text) ?? [];
      nodes.push(node);
      uses.set(node.text, nodes);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

function enclosingVisibleVariable(node: ts.Node, visibleVariables: ReadonlySet<string>): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isVariableDeclaration(parent) &&
      ts.isIdentifier(parent.name) &&
      visibleVariables.has(parent.name.text)
    ) {
      return true;
    }
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

function isVisibleValue(node: ts.Node, visibleVariables: ReadonlySet<string>): boolean {
  return (
    isRenderedJsxExpressionDescendant(node) || enclosingVisibleVariable(node, visibleVariables)
  );
}

function isProtectedValue(
  node: ts.Node,
  category: RouteBidiCategory,
  visibleVariableUses: ReadonlyMap<string, readonly ts.Identifier[]>,
): boolean {
  if (isProtected(node, category)) return true;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      const uses = visibleVariableUses.get(parent.name.text) ?? [];
      return uses.length > 0 && uses.every((use) => isProtected(use, category));
    }
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

type StaticValue =
  | { kind: "string"; node: ts.Node; value: string }
  | { kind: "array"; node: ts.ArrayLiteralExpression; items: StaticValue[] }
  | {
      kind: "object";
      node: ts.ObjectLiteralExpression;
      properties: Map<string, StaticValue[]>;
    };
type StaticEnvironment = ReadonlyMap<string, readonly StaticValue[]>;

function staticPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function unwrapStaticExpression(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function staticStringValues(
  values: readonly StaticValue[],
): Extract<StaticValue, { kind: "string" }>[] {
  return values.filter(
    (value): value is Extract<StaticValue, { kind: "string" }> => value.kind === "string",
  );
}

function resolveStaticValues(
  rawNode: ts.Expression,
  initializers: ReadonlyMap<string, ts.Expression>,
  environment: StaticEnvironment = new Map(),
  seen = new Set<string>(),
): StaticValue[] {
  const node = unwrapStaticExpression(rawNode);
  if (ts.isStringLiteralLike(node)) return [{ kind: "string", node, value: node.text }];

  if (ts.isIdentifier(node)) {
    const bound = environment.get(node.text);
    if (bound) return [...bound];
    if (seen.has(node.text)) return [];
    const initializer = initializers.get(node.text);
    if (!initializer) return [];
    return resolveStaticValues(
      initializer,
      initializers,
      environment,
      new Set([...seen, node.text]),
    );
  }

  if (ts.isArrayLiteralExpression(node)) {
    return [
      {
        kind: "array",
        node,
        items: node.elements.flatMap((element) => {
          const values = resolveStaticValues(
            ts.isSpreadElement(element) ? element.expression : element,
            initializers,
            environment,
            seen,
          );
          return ts.isSpreadElement(element)
            ? values.flatMap((value) => (value.kind === "array" ? value.items : []))
            : values;
        }),
      },
    ];
  }

  if (ts.isObjectLiteralExpression(node)) {
    let variants = [new Map<string, StaticValue[]>()];
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spreadObjects = resolveStaticValues(
          property.expression,
          initializers,
          environment,
          seen,
        ).filter(
          (value): value is Extract<StaticValue, { kind: "object" }> => value.kind === "object",
        );
        if (spreadObjects.length > 0) {
          variants = variants.flatMap((properties) =>
            spreadObjects.map((spreadObject) => {
              const merged = new Map(properties);
              for (const [name, values] of spreadObject.properties) merged.set(name, values);
              return merged;
            }),
          );
        }
      } else if (ts.isPropertyAssignment(property)) {
        const name = staticPropertyName(property.name);
        if (name) {
          const values = resolveStaticValues(property.initializer, initializers, environment, seen);
          variants.forEach((properties) => properties.set(name, values));
        }
      } else if (ts.isShorthandPropertyAssignment(property)) {
        const values = resolveStaticValues(property.name, initializers, environment, seen);
        variants.forEach((properties) => properties.set(property.name.text, values));
      }
    }
    return variants.map((properties) => ({
      kind: "object" as const,
      node,
      properties,
    }));
  }

  if (ts.isPropertyAccessExpression(node)) {
    return resolveStaticValues(node.expression, initializers, environment, seen).flatMap((value) =>
      value.kind === "object" ? (value.properties.get(node.name.text) ?? []) : [],
    );
  }

  if (ts.isElementAccessExpression(node)) {
    const owners = resolveStaticValues(node.expression, initializers, environment, seen);
    const argument = node.argumentExpression
      ? unwrapStaticExpression(node.argumentExpression)
      : undefined;
    const key =
      argument && (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument))
        ? argument.text
        : null;
    return owners.flatMap((owner) => {
      if (owner.kind === "object") {
        return key === null
          ? [...owner.properties.values()].flat()
          : (owner.properties.get(key) ?? []);
      }
      if (owner.kind === "array") {
        if (key === null) return owner.items;
        const index = Number(key);
        return Number.isInteger(index) ? (owner.items[index] ? [owner.items[index]] : []) : [];
      }
      return [];
    });
  }

  if (ts.isTemplateExpression(node)) {
    let combinations = [node.head.text];
    for (const span of node.templateSpans) {
      const substitutions = staticStringValues(
        resolveStaticValues(span.expression, initializers, environment, seen),
      );
      if (substitutions.length === 0) return [];
      combinations = combinations.flatMap((prefix) =>
        substitutions.map((substitution) => prefix + substitution.value + span.literal.text),
      );
    }
    return combinations.map((value) => ({ kind: "string" as const, node, value }));
  }

  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValues(
      resolveStaticValues(node.left, initializers, environment, seen),
    );
    const right = staticStringValues(
      resolveStaticValues(node.right, initializers, environment, seen),
    );
    return left.flatMap((leftValue) =>
      right.map((rightValue) => ({
        kind: "string" as const,
        node,
        value: leftValue.value + rightValue.value,
      })),
    );
  }

  if (ts.isConditionalExpression(node)) {
    return [
      ...resolveStaticValues(node.whenTrue, initializers, environment, seen),
      ...resolveStaticValues(node.whenFalse, initializers, environment, seen),
    ];
  }

  return [];
}

function semanticTokens(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function semanticIdentifier(value: string): boolean {
  const tokens = semanticTokens(value);
  return (
    tokens.includes("reference") ||
    tokens.includes("idempotency") ||
    tokens.includes("slug") ||
    (tokens.includes("payment") && tokens.at(-1) === "id") ||
    (tokens.includes("provider") && tokens.at(-1) === "id") ||
    (tokens.includes("receipt") && tokens.includes("number"))
  );
}

const INTL_DATE_COMPONENTS = new Set(["dateStyle", "day", "era", "month", "weekday", "year"]);
const INTL_TIME_COMPONENTS = new Set([
  "dayPeriod",
  "fractionalSecondDigits",
  "hour",
  "minute",
  "second",
  "timeStyle",
  "timeZoneName",
]);

function toLocaleStringCategories(
  call: ts.CallExpression,
): readonly ("localized-date" | "time-range")[] {
  if (callName(call) !== "toLocaleString") return [];
  const options = call.arguments[1];
  if (
    !options ||
    options.kind === ts.SyntaxKind.UndefinedKeyword ||
    options.kind === ts.SyntaxKind.NullKeyword
  ) {
    return ["localized-date", "time-range"];
  }
  if (!ts.isObjectLiteralExpression(options)) return ["localized-date", "time-range"];

  let hasDate = false;
  let hasTime = false;
  let hasUnknownComponentValue = false;
  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property)) {
      if (ts.isSpreadAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
        hasUnknownComponentValue = true;
      }
      continue;
    }
    const name = staticPropertyName(property.name);
    if (!name) {
      hasUnknownComponentValue = true;
      continue;
    }
    if (!INTL_DATE_COMPONENTS.has(name) && !INTL_TIME_COMPONENTS.has(name)) continue;
    const initializer = unwrapStaticExpression(property.initializer);
    if (initializer.kind === ts.SyntaxKind.UndefinedKeyword) {
      hasUnknownComponentValue = true;
      continue;
    }
    if (!ts.isStringLiteralLike(initializer) && !ts.isNumericLiteral(initializer)) {
      hasUnknownComponentValue = true;
      continue;
    }
    if (INTL_DATE_COMPONENTS.has(name)) hasDate = true;
    if (INTL_TIME_COMPONENTS.has(name)) hasTime = true;
  }

  if (hasUnknownComponentValue || (!hasDate && !hasTime)) {
    return ["localized-date", "time-range"];
  }
  return [
    ...(hasDate ? (["localized-date"] as const) : []),
    ...(hasTime ? (["time-range"] as const) : []),
  ];
}

function isConditionalGuard(node: ts.Node): boolean {
  for (
    let child: ts.Node = node, parent = node.parent;
    parent;
    child = parent, parent = parent.parent
  ) {
    if (
      ts.isBinaryExpression(parent) &&
      parent.left === child &&
      (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      let renderedBranch: ts.Expression = parent.right;
      while (ts.isParenthesizedExpression(renderedBranch))
        renderedBranch = renderedBranch.expression;
      if (ts.isJsxElement(renderedBranch) || ts.isJsxSelfClosingElement(renderedBranch))
        return true;
    }
    if (ts.isConditionalExpression(parent) && parent.condition === child) return true;
    if (ts.isJsxExpression(parent)) return false;
  }
  return false;
}

function isInputValue(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isJsxAttribute(parent)) continue;
    if (parent.name.getText() !== "value") return false;
    for (let owner = parent.parent; owner; owner = owner.parent) {
      if (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) {
        return jsxTagName(owner.tagName) === "input";
      }
      if (ts.isJsxElement(owner)) return false;
    }
    return false;
  }
  return false;
}

function isInsideJsxAttribute(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxAttribute(parent)) return true;
    if (ts.isStatement(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

function isDeclarationName(node: ts.Node): boolean {
  return (
    (ts.isVariableDeclaration(node.parent) ||
      ts.isParameter(node.parent) ||
      ts.isPropertyDeclaration(node.parent)) &&
    node.parent.name === node
  );
}

function contactProperty(node: ts.PropertyAccessExpression): boolean {
  if (node.name.text === "emailBody" || node.name.text === "phoneBody") return true;
  if (node.name.text !== "email" && node.name.text !== "phone") return false;
  const owner = node.expression.getText();
  return /(?:^|\.)(?:m|me|member|profile|studio)$/.test(owner);
}

function identifierUse(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) {
    if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) return false;
    return semanticIdentifier(node.text);
  }
  return ts.isPropertyAccessExpression(node) && semanticIdentifier(node.name.text);
}

function isDynamicCurrencyElement(node: ts.JsxElement): boolean {
  const hasCurrencySymbol = node.children.some(
    (child) => ts.isJsxText(child) && child.text.includes("₪"),
  );
  return hasCurrencySymbol && node.children.some(ts.isJsxExpression);
}

function addFinding(
  collection: Map<string, RouteBidiFinding>,
  source: ts.SourceFile,
  file: string,
  node: ts.Node,
  category: RouteBidiCategory,
  snippetOverride?: string,
) {
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const snippet = snippetOverride ?? node.getText(source).replace(/\s+/g, " ").slice(0, 180);
  collection.set(`${file}\0${line}\0${category}\0${snippet}`, { file, line, category, snippet });
}

function auditInput(
  opening: ts.JsxOpeningLikeElement,
): { expectedKind: "email" | "phone" | "url" | "identifier"; protected: boolean } | null {
  if (jsxTagName(opening.tagName) !== "input") return null;
  const typeText = attributeText(jsxAttribute(opening, "type"));
  const inputModeText = attributeText(jsxAttribute(opening, "inputMode"));
  const valueText = attributeText(jsxAttribute(opening, "value"));
  const semanticText = [
    valueText,
    attributeText(jsxAttribute(opening, "id")),
    attributeText(jsxAttribute(opening, "name")),
  ].join(" ");
  const semantic = new Set(semanticTokens(semanticText));
  let expectedKind: "email" | "phone" | "url" | "identifier" | null = null;

  if (/^["']email["']$/.test(typeText)) expectedKind = "email";
  else if (/^["'](?:tel)["']$/.test(typeText) || /["']tel["']/.test(inputModeText)) {
    expectedKind = "phone";
  } else if (/^["']url["']$/.test(typeText)) expectedKind = "url";
  else if (semantic.has("phone") || semantic.has("tel")) expectedKind = "phone";
  else if (semantic.has("email")) expectedKind = "email";
  else if (semantic.has("url")) expectedKind = "url";
  else if (semanticIdentifier(semanticText)) expectedKind = "identifier";
  else if (typeText === "{type}" && inputModeText.includes('id === "phone"'))
    expectedKind = "phone";

  if (!expectedKind) return null;
  const dirText = attributeText(jsxAttribute(opening, "dir"));
  const protectedDirection =
    dirText.includes(`bidiDirectionFor("${expectedKind}")`) ||
    (typeText === "{type}" &&
      dirText.includes('id === "phone"') &&
      dirText.includes('bidiDirectionFor("phone")') &&
      dirText.includes('bidiDirectionFor("email")'));
  return { expectedKind, protected: protectedDirection };
}

export function auditRouteBidi(routesRoot: string): {
  violations: RouteBidiFinding[];
  protectedUses: RouteBidiFinding[];
} {
  const violations = new Map<string, RouteBidiFinding>();
  const protectedUses = new Map<string, RouteBidiFinding>();
  const files = typescriptFilesUnder(routesRoot).filter(
    (file) => !file.includes("/api/") && /\.[jt]sx$/.test(file),
  );

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      basename(file).endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
    );
    const initializers = variableInitializers(source);
    const visibleVariables = visibleVariableNames(source, initializers);
    const visibleVariableUses = directVisibleVariableUses(source, initializers);

    const record = (
      node: ts.Node,
      category: RouteBidiCategory,
      protectedValue: boolean,
      snippetOverride?: string,
    ) =>
      addFinding(
        protectedValue ? protectedUses : violations,
        source,
        file,
        node,
        category,
        snippetOverride,
      );
    const protectedValue = (node: ts.Node, category: RouteBidiCategory) =>
      isProtectedValue(node, category, visibleVariableUses);

    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const input = auditInput(node);
        if (input) record(node, "technical-input", input.protected);
        if (jsxTagName(node.tagName) === "BidiDateTime") {
          record(node, "localized-date", true);
          record(node, "time-range", true);
        }
      }

      if (ts.isJsxElement(node) && isDynamicCurrencyElement(node)) {
        record(node, "currency", bidiKindFromOpening(node.openingElement) === "currency");
      }

      if (isVisibleValue(node, visibleVariables)) {
        if (ts.isCallExpression(node)) {
          const name = callName(node);
          if (name === "toLocaleString") {
            for (const category of toLocaleStringCategories(node)) {
              record(node, category, protectedValue(node, category));
            }
          } else if (COMBINED_DATE_TIME_CALLS.has(name)) {
            record(node, "localized-date", protectedValue(node, "localized-date"));
            record(node, "time-range", protectedValue(node, "time-range"));
          } else if (SHARED_COMBINED_DATE_TIME_CALLS.has(name)) {
            record(node, "localized-date", true);
            record(node, "time-range", true);
          } else if (DATE_CALLS.has(name)) {
            record(node, "localized-date", protectedValue(node, "localized-date"));
          }
          if (TIME_CALLS.has(name)) record(node, "time-range", protectedValue(node, "time-range"));
          if (CURRENCY_CALLS.has(name)) record(node, "currency", protectedValue(node, "currency"));
        }
        if (
          ts.isPropertyAccessExpression(node) &&
          contactProperty(node) &&
          !isConditionalGuard(node)
        ) {
          record(node, "contact", protectedValue(node, "contact"));
        }
        if (
          identifierUse(node) &&
          !isDeclarationName(node) &&
          !isConditionalGuard(node) &&
          !isInputValue(node) &&
          !isInsideJsxAttribute(node)
        ) {
          record(node, "identifier", protectedValue(node, "identifier"));
        }
        if (
          ts.isIdentifier(node) &&
          node.text === "price" &&
          !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
        ) {
          record(node, "currency", protectedValue(node, "currency"));
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(source);

    const scanStaticContacts = (values: readonly StaticValue[], protectedContact: boolean) => {
      const visitValue = (value: StaticValue) => {
        if (value.kind === "array") {
          value.items.forEach(visitValue);
          return;
        }
        if (value.kind === "object") {
          for (const propertyValues of value.properties.values())
            propertyValues.forEach(visitValue);
          return;
        }
        for (const segment of embeddedBidiSegments(value.value)) {
          if (segment.kind) {
            record(value.node, "contact", protectedContact, `${segment.kind}:${segment.value}`);
          }
        }
      };
      values.forEach(visitValue);
    };

    const scanVisibleNode = (node: ts.Node, environment: StaticEnvironment): void => {
      if (ts.isJsxText(node)) {
        scanStaticContacts([{ kind: "string", node, value: node.text }], false);
        return;
      }
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = ts.isJsxElement(node) ? node.openingElement : node;
        const embeddedContactRenderer = jsxTagName(opening.tagName) === "EmbeddedContactText";
        for (const attribute of opening.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
          if (jsxTagName(opening.tagName) === "input" && attribute.name.getText() === "value") {
            continue;
          }
          const visibleAttribute =
            embeddedContactRenderer && attribute.name.getText() === "text"
              ? true
              : VISIBLE_JSX_ATTRIBUTES.has(attribute.name.getText());
          if (!visibleAttribute || !ts.isJsxExpression(attribute.initializer)) continue;
          if (attribute.initializer.expression) {
            scanVisibleExpression(
              attribute.initializer.expression,
              environment,
              embeddedContactRenderer && attribute.name.getText() === "text",
            );
          }
        }
        if (ts.isJsxElement(node)) {
          node.children.forEach((child) => scanVisibleNode(child, environment));
        }
        return;
      }
      if (ts.isJsxFragment(node)) {
        node.children.forEach((child) => scanVisibleNode(child, environment));
        return;
      }
      if (ts.isJsxExpression(node) && node.expression) {
        scanVisibleExpression(
          node.expression,
          environment,
          isProtected(node.expression, "contact"),
        );
      }
    };

    const scanVisibleExpression = (
      rawExpression: ts.Expression,
      environment: StaticEnvironment,
      protectedContact: boolean,
    ): void => {
      const expression = unwrapStaticExpression(rawExpression);
      if (
        ts.isCallExpression(expression) &&
        ts.isPropertyAccessExpression(expression.expression) &&
        expression.expression.name.text === "map"
      ) {
        const collections = resolveStaticValues(
          expression.expression.expression,
          initializers,
          environment,
        );
        const items = collections.flatMap((value) => (value.kind === "array" ? value.items : []));
        const callback = expression.arguments[0];
        if (
          callback &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
          callback.parameters[0] &&
          ts.isIdentifier(callback.parameters[0].name)
        ) {
          const callbackEnvironment = new Map(environment);
          callbackEnvironment.set(callback.parameters[0].name.text, items);
          if (ts.isBlock(callback.body)) {
            const visitReturn = (candidate: ts.Node) => {
              if (ts.isReturnStatement(candidate) && candidate.expression) {
                scanVisibleExpression(candidate.expression, callbackEnvironment, protectedContact);
                return;
              }
              ts.forEachChild(candidate, visitReturn);
            };
            visitReturn(callback.body);
          } else {
            scanVisibleExpression(callback.body, callbackEnvironment, protectedContact);
          }
        }
        return;
      }
      if (ts.isConditionalExpression(expression)) {
        scanVisibleExpression(expression.whenTrue, environment, protectedContact);
        scanVisibleExpression(expression.whenFalse, environment, protectedContact);
        return;
      }
      if (
        ts.isJsxElement(expression) ||
        ts.isJsxSelfClosingElement(expression) ||
        ts.isJsxFragment(expression)
      ) {
        scanVisibleNode(expression, environment);
        return;
      }
      scanStaticContacts(
        resolveStaticValues(expression, initializers, environment),
        protectedContact,
      );
    };

    const scanJsxRoots = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        scanVisibleNode(node, new Map());
        return;
      }
      ts.forEachChild(node, scanJsxRoots);
    };
    scanJsxRoots(source);
  }

  const sortFindings = (findings: Iterable<RouteBidiFinding>) =>
    [...findings].sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.category.localeCompare(right.category),
    );
  return {
    violations: sortFindings(violations.values()),
    protectedUses: sortFindings(protectedUses.values()),
  };
}
