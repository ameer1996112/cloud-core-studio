import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, extname, relative, resolve } from "node:path";
import { parse as parseCss, type ChildNode, type Declaration, type Root, type Rule } from "postcss";
import selectorParser, { type Node as SelectorNode } from "postcss-selector-parser";
import ts from "typescript";

export type StyleContractIssueCode =
  | "hardcoded-color"
  | "physical-direction"
  | "decorative-gold-body-text"
  | "duplicate-breakpoint-recipe"
  | "important-declaration"
  | "route-css-in-compatibility"
  | "route-css-boundary"
  | "cascade-equivalence";

export type StyleContractIssue = {
  code: StyleContractIssueCode;
  file: string;
  line: number;
  message: string;
};

export type StyleContractOptions = {
  root: string;
};

const BASE_STYLE = "src/styles/base.css";
const COMPATIBILITY_STYLE = "src/styles.css";
const ROUTE_STYLES = {
  public: "src/styles/public.css",
  member: "src/styles/member.css",
  admin: "src/styles/admin.css",
  instructor: "src/styles/instructor.css",
} as const;
const COLOR_LITERAL =
  /#[\da-f]{3,8}\b|(?<![a-z\d-])(?:rgb|hsl)a?\s*\([^)]*\)|(?<![a-z\d-])(?:oklch|oklab|lab|lch|color)\s*\([^)]*\)/gi;
const BODY_TAGS = new Set(["p", "li", "label", "dd", "dt", "blockquote"]);
const PRESENTATION_ATTRIBUTE_NAMES = new Set([
  "className",
  "style",
  "color",
  "fill",
  "stroke",
  "stopColor",
  "floodColor",
]);
const PRESENTATION_PROPERTY_SEGMENTS = new Set([
  "accent",
  "background",
  "border",
  "color",
  "fill",
  "gradient",
  "overlay",
  "rail",
  "shadow",
  "stroke",
  "surface",
  "wash",
]);
const TAILWIND_PRESENTATION =
  /(?:^|\s)(?:bg|border|decoration|fill|from|outline|ring|shadow|stroke|text|to|via)-\[[^\]]*(?:#[\da-f]|(?:rgb|hsl)a?\(|(?:oklch|oklab|lab|lch|color)\()/i;
const COLOR_APPROVAL = /style-contract-allow-color:\s*[^\s*][^\n]*/i;

type ImportantBaseline = { version: 1; signatures: string[] };
type ParsedStyle = { file: string; source: string; root: Root };
type StaticFragment = { text: string; start: number; node: ts.Node };

function listSourceFiles(root: string) {
  const src = resolve(root, "src");
  if (!existsSync(src)) return [];
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if ([".ts", ".tsx", ".js", ".jsx", ".css"].includes(extname(entry.name))) {
        files.push(relative(root, path));
      }
    }
  };
  visit(src);
  return files.sort();
}

function read(root: string, file: string) {
  return readFileSync(resolve(root, file), "utf8");
}

function issueAtLine(
  issues: StyleContractIssue[],
  code: StyleContractIssueCode,
  file: string,
  line: number,
  message: string,
) {
  issues.push({ code, file, line, message });
}

function lineOf(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function cssLineOf(source: string, index: number) {
  return (source.slice(0, index).match(/\r\n|[\n\r\f]/g)?.length ?? 0) + 1;
}

function replaceCssLexemePreservingOffsets(lexeme: string, replacement: string) {
  if (lexeme.length < replacement.length) return lexeme;
  const output = Array.from({ length: lexeme.length }, () => " ");
  replacement.split("").forEach((character, index) => (output[index] = character));
  return output.join("");
}

function normalizeLeadingEscapedAtRuleKeywords(source: string) {
  return source.replace(
    /@[\t ]*(\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\f\r ])?|[^\r\n\f])(?:[\w-]|\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\f\r ])?|[^\r\n\f]))*)/gi,
    (match, name: string) => {
      const decoded = cssUnescape(name).toLowerCase();
      const keyword = match[1] === "\\" && /^-?[a-z_][\w-]*$/i.test(decoded) ? `@${decoded}` : "@x";
      return replaceCssLexemePreservingOffsets(match, keyword);
    },
  );
}

function parseStyle(root: string, file: string): ParsedStyle | undefined {
  if (!existsSync(resolve(root, file))) return undefined;
  const source = read(root, file);
  return {
    file,
    source,
    root: parseCss(normalizeLeadingEscapedAtRuleKeywords(source), { from: file }),
  };
}

function parsedStyleLine(style: ParsedStyle, node: ChildNode) {
  const offset = node.source?.start?.offset;
  return offset === undefined ? (node.source?.start?.line ?? 1) : cssLineOf(style.source, offset);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function atRuleContext(node: ChildNode) {
  const contexts: string[] = [];
  let parent = node.parent;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule") {
      contexts.unshift(`@${parent.name.toLowerCase()} ${normalizeWhitespace(parent.params)}`);
    }
    parent = parent.parent;
  }
  return contexts.join(" | ");
}

function declarationSelector(declaration: Declaration) {
  const parent = declaration.parent;
  return parent?.type === "rule" ? normalizeWhitespace(parent.selector) : "<at-rule>";
}

function importantSignature(file: string, declaration: Declaration) {
  return [
    file,
    atRuleContext(declaration),
    declarationSelector(declaration),
    declaration.prop.trim().toLowerCase(),
    normalizeWhitespace(declaration.value),
  ].join(" | ");
}

function loadImportantBaseline(root: string): ImportantBaseline {
  const path = resolve(root, "tools/ui-audit/style-important-baseline.json");
  if (!existsSync(path)) return { version: 1, signatures: [] };
  return JSON.parse(readFileSync(path, "utf8")) as ImportantBaseline;
}

export function buildImportantBaseline({ root }: StyleContractOptions): ImportantBaseline {
  const style = parseStyle(root, BASE_STYLE);
  const signatures: string[] = [];
  style?.root.walkDecls((declaration) => {
    if (declaration.important) signatures.push(importantSignature(BASE_STYLE, declaration));
  });
  return { version: 1, signatures: signatures.sort() };
}

function hasCssApproval(declaration: Declaration) {
  const previous = declaration.prev();
  return previous?.type === "comment" && COLOR_APPROVAL.test(previous.text);
}

function isApprovedImageGradient(declaration: Declaration) {
  return (
    /^background(?:-image)?$/i.test(declaration.prop) &&
    /(?:linear|radial|conic)-gradient\s*\(/i.test(declaration.value) &&
    /url\s*\(/i.test(declaration.value)
  );
}

function colorMatches(value: string) {
  return [...value.matchAll(COLOR_LITERAL)];
}

function scanCssColors(style: ParsedStyle, issues: StyleContractIssue[]) {
  style.root.walkDecls((declaration) => {
    const matches = colorMatches(declaration.value);
    if (matches.length === 0) return;
    if (
      (style.file === "src/styles/tokens.css" && declaration.prop.startsWith("--")) ||
      isApprovedImageGradient(declaration) ||
      hasCssApproval(declaration)
    ) {
      return;
    }
    for (const match of matches) {
      issueAtLine(
        issues,
        "hardcoded-color",
        style.file,
        parsedStyleLine(style, declaration),
        `Use a semantic/component token instead of ${match[0]}.`,
      );
    }
  });
}

function isPhysicalDeclaration(declaration: Declaration) {
  const property = declaration.prop.trim().toLowerCase();
  const value = declaration.value.trim().toLowerCase();
  return (
    /^(?:left|right)$/.test(property) ||
    /^(?:margin|padding|scroll-margin|scroll-padding)-(?:left|right)$/.test(property) ||
    /^border-(?:(?:left|right)(?:-(?:color|style|width))?|(?:top|bottom)-(?:left|right)-radius)$/.test(
      property,
    ) ||
    (/^(?:clear|float|text-align)$/.test(property) && /^(?:left|right)$/.test(value))
  );
}

function scanCssDirectionAndImportant(
  style: ParsedStyle,
  importantBaseline: Map<string, number>,
  issues: StyleContractIssue[],
) {
  style.root.walkDecls((declaration) => {
    if (
      Object.values(ROUTE_STYLES).includes(style.file as never) &&
      isPhysicalDeclaration(declaration)
    ) {
      issueAtLine(
        issues,
        "physical-direction",
        style.file,
        parsedStyleLine(style, declaration),
        "Use a flow-relative logical property/value.",
      );
    }
    if (!declaration.important) return;
    const signature = importantSignature(style.file, declaration);
    const allowed = importantBaseline.get(signature) ?? 0;
    if (style.file === BASE_STYLE && allowed > 0) {
      importantBaseline.set(signature, allowed - 1);
      return;
    }
    issueAtLine(
      issues,
      "important-declaration",
      style.file,
      parsedStyleLine(style, declaration),
      "Resolve the cascade without adding, moving, or changing !important.",
    );
  });
}

type MediaRecipe = { file: string; line: number; query: string; declarations: Set<string> };

function mediaRecipes(style: ParsedStyle): MediaRecipe[] {
  const recipes: MediaRecipe[] = [];
  style.root.walkAtRules("media", (media) => {
    const declarations: string[] = [];
    media.walkDecls((declaration) => {
      declarations.push(
        `${declaration.prop.trim().toLowerCase()}:${normalizeWhitespace(declaration.value)}${
          declaration.important ? "!important" : ""
        }`,
      );
    });
    if (declarations.length < 2) return;
    declarations.sort();
    recipes.push({
      file: style.file,
      line: parsedStyleLine(style, media),
      query: normalizeWhitespace(media.params).toLowerCase(),
      declarations: new Set(declarations),
    });
  });
  return recipes;
}

function scanDuplicateMedia(styles: ParsedStyle[], issues: StyleContractIssue[]) {
  const recipes = styles.flatMap(mediaRecipes);
  const reported = new Set<string>();
  for (let leftIndex = 0; leftIndex < recipes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < recipes.length; rightIndex += 1) {
      const left = recipes[leftIndex];
      const right = recipes[rightIndex];
      if (left.file === right.file || left.query !== right.query) continue;
      const shared = [...left.declarations].filter((declaration) =>
        right.declarations.has(declaration),
      );
      // One ubiquitous declaration is not a recipe. A copied recipe is the complete smaller
      // declaration set, even when the destination adds unrelated declarations.
      if (
        shared.length < 2 ||
        shared.length !== Math.min(left.declarations.size, right.declarations.size)
      ) {
        continue;
      }
      const identity = [right.file, right.line, left.file, left.line].join(":");
      if (reported.has(identity)) continue;
      reported.add(identity);
      issueAtLine(
        issues,
        "duplicate-breakpoint-recipe",
        right.file,
        right.line,
        `Breakpoint declaration recipe overlaps ${left.file}:${left.line} (${shared
          .sort()
          .join(", ")}).`,
      );
    }
  }
}

function scanCompatibility(style: ParsedStyle, issues: StyleContractIssue[]) {
  const nodes = style.root.nodes.filter((node) => node.type !== "comment");
  const valid =
    nodes.length === 1 &&
    nodes[0].type === "atrule" &&
    nodes[0].name.toLowerCase() === "import" &&
    /^(["'])\.\/styles\/base\.css\1$/.test(nodes[0].params.trim());
  if (!valid) {
    issueAtLine(
      issues,
      "route-css-in-compatibility",
      style.file,
      nodes[1] ? parsedStyleLine(style, nodes[1]) : nodes[0] ? parsedStyleLine(style, nodes[0]) : 1,
      'styles.css may contain comments and exactly one @import "./styles/base.css" only.',
    );
  }
}

function scriptKind(file: string) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function propertyName(node: ts.PropertyName | undefined) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return node.text;
  return "";
}

function isPresentationPropertyName(name: string) {
  const normalized = name
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
  return normalized.split("-").some((segment) => PRESENTATION_PROPERTY_SEGMENTS.has(segment));
}

type FunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

type StaticVariableBinding = {
  expression: ts.Expression;
  identity: number;
  position: number;
  scope: ts.Node;
  executionFunction?: FunctionNode;
  callSite?: ts.CallExpression;
  sourcePosition?: number;
  semanticOrder?: number;
  mutation?: {
    kind: "push" | "unshift" | "index";
    expressions: readonly ts.Expression[];
    index?: number;
  };
};

type EvaluationContext = {
  variables: Map<string, StaticVariableBinding[]>;
  functions: Map<string, FunctionNode>;
  bindings: Map<string, ts.Expression>;
  resolving: Set<string>;
  depth: number;
  maxCombinations: number;
  evaluationNode?: ts.Node;
  semanticEvaluationOrder?: number;
  semanticOrdersByCall?: Map<ts.CallExpression, Map<ts.Node, number[]>>;
};

function latestSemanticOrder(orders: number[] | undefined, ceiling = Number.POSITIVE_INFINITY) {
  return orders?.findLast((order) => order <= ceiling);
}

function nearestVariableScope(node: ts.Node, blockScoped = true): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isSourceFile(current) ||
      ts.isFunctionLike(current) ||
      (blockScoped && (ts.isBlock(current) || ts.isModuleBlock(current)))
    ) {
      return current;
    }
    current = current.parent;
  }
  return node.getSourceFile();
}

function nearestFunctionScope(node: ts.Node) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function visibleVariableBindings(
  variables: Map<string, StaticVariableBinding[]>,
  name: string,
  reference: ts.Node,
) {
  const position = reference.getStart();
  const visible = (variables.get(name) ?? []).filter(
    (binding) =>
      binding.position <= position &&
      binding.scope.getStart() <= position &&
      binding.scope.getEnd() >= reference.getEnd(),
  );
  if (visible.length === 0) return [];
  let scope = visible[0].scope;
  for (const binding of visible) {
    if (binding.scope.getEnd() - binding.scope.getStart() < scope.getEnd() - scope.getStart()) {
      scope = binding.scope;
    }
  }
  return visible.filter((binding) => binding.scope === scope);
}

function evaluatedVariableBindings(node: ts.Identifier, context: EvaluationContext) {
  const candidates = (context.variables.get(node.text) ?? []).filter(
    (binding) =>
      binding.scope.getStart() <= node.getStart() && binding.scope.getEnd() >= node.getEnd(),
  );
  if (candidates.length === 0) return [];
  let scope = candidates[0].scope;
  for (const binding of candidates) {
    if (binding.scope.getEnd() - binding.scope.getStart() < scope.getEnd() - scope.getStart()) {
      scope = binding.scope;
    }
  }
  let containingFunction: ts.Node | undefined = node.parent;
  while (containingFunction && !ts.isFunctionLike(containingFunction)) {
    containingFunction = containingFunction.parent;
  }
  const scopeIsInsideFunction =
    containingFunction &&
    scope.getStart() >= containingFunction.getStart() &&
    scope.getEnd() <= containingFunction.getEnd();
  const position =
    context.evaluationNode && containingFunction && !scopeIsInsideFunction
      ? context.evaluationNode.getStart()
      : node.getStart();
  return candidates
    .filter((binding) => binding.scope === scope && binding.position <= position)
    .sort((left, right) => left.position - right.position);
}

function staticBoundExpressions(node: ts.Identifier, context: EvaluationContext): ts.Expression[] {
  const parameter = context.bindings.get(node.text);
  if (parameter) return [parameter];
  const binding = evaluatedVariableBindings(node, context).findLast(
    (candidate) => !candidate.mutation,
  );
  return binding ? [binding.expression] : [];
}

function bindingVisibleAtEvaluation(
  binding: StaticVariableBinding,
  node: ts.Identifier,
  context: EvaluationContext,
) {
  const containingFunction = nearestFunctionScope(node);
  if (binding.executionFunction && !binding.callSite) {
    if (context.evaluationNode) return false;
    return binding.executionFunction === containingFunction && binding.position <= node.getStart();
  }
  if (!containingFunction) {
    return (
      binding.scope.getStart() <= node.getStart() &&
      binding.scope.getEnd() >= node.getEnd() &&
      binding.position <= node.getStart()
    );
  }
  const local =
    binding.scope.getStart() >= containingFunction.getStart() &&
    binding.scope.getEnd() <= containingFunction.getEnd();
  const outer =
    binding.scope.getStart() <= containingFunction.getStart() &&
    binding.scope.getEnd() >= containingFunction.getEnd();
  if (!local && !outer) return false;
  if (
    binding.callSite &&
    binding.callSite === context.evaluationNode &&
    binding.semanticOrder !== undefined
  ) {
    const evaluationOrder = latestSemanticOrder(
      context.semanticOrdersByCall?.get(binding.callSite)?.get(node),
      context.semanticEvaluationOrder,
    );
    if (evaluationOrder !== undefined) return binding.semanticOrder <= evaluationOrder;
  }
  if (
    binding.callSite &&
    binding.callSite === context.evaluationNode &&
    binding.sourcePosition !== undefined
  ) {
    return binding.sourcePosition <= node.getStart();
  }
  const position = local
    ? node.getStart()
    : (context.evaluationNode?.getStart() ?? node.getStart());
  return binding.position <= position;
}

function returnedExpressions(fn: FunctionNode) {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body];
  const expressions: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (node !== fn && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) {
      expressions.push(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return expressions;
}

function calledFunction(
  node: ts.CallExpression,
  context: EvaluationContext,
): { fn: FunctionNode; context: EvaluationContext } | undefined {
  if (!ts.isIdentifier(node.expression)) return undefined;
  const fn = context.functions.get(node.expression.text);
  if (!fn || context.resolving.has(`fn:${node.expression.text}`)) return undefined;
  const bindings = new Map(context.bindings);
  fn.parameters.forEach((parameter, index) => {
    if (!ts.isIdentifier(parameter.name)) return;
    const argument = node.arguments[index] ?? parameter.initializer;
    if (argument) bindings.set(parameter.name.text, argument);
  });
  const evaluationNode = context.evaluationNode ?? node;
  const semanticEvaluationOrder = latestSemanticOrder(
    ts.isCallExpression(evaluationNode)
      ? context.semanticOrdersByCall?.get(evaluationNode)?.get(node)
      : undefined,
    context.semanticEvaluationOrder,
  );
  return {
    fn,
    context: {
      ...context,
      bindings,
      resolving: new Set(context.resolving).add(`fn:${node.expression.text}`),
      depth: context.depth + 1,
      evaluationNode,
      semanticEvaluationOrder: semanticEvaluationOrder ?? context.semanticEvaluationOrder,
    },
  };
}

function staticFragments(node: ts.Node | undefined, context: EvaluationContext): StaticFragment[] {
  if (!node) return [];
  if (context.depth > 32) return [];
  if (ts.isStringLiteralLike(node)) {
    return [{ text: node.text, start: node.getStart() + 1, node }];
  }
  if (
    node.kind === ts.SyntaxKind.TemplateHead ||
    node.kind === ts.SyntaxKind.TemplateMiddle ||
    node.kind === ts.SyntaxKind.TemplateTail
  ) {
    const template = node as ts.TemplateLiteralLikeNode;
    return [{ text: template.text, start: node.getStart() + 1, node }];
  }
  if (ts.isIdentifier(node)) {
    const bound = staticBoundExpressions(node, context);
    if (bound.length > 0 && !context.resolving.has(`var:${node.text}`)) {
      const nestedContext = {
        ...context,
        resolving: new Set(context.resolving).add(`var:${node.text}`),
        depth: context.depth + 1,
      };
      return bound.flatMap((expression) => staticFragments(expression, nestedContext));
    }
  }
  if (ts.isCallExpression(node)) {
    const called = calledFunction(node, context);
    if (called) {
      return returnedExpressions(called.fn).flatMap((expression) =>
        staticFragments(expression, called.context),
      );
    }
  }
  const fragments: StaticFragment[] = [];
  node.forEachChild((child) => {
    fragments.push(
      ...staticFragments(child, {
        ...context,
        resolving: new Set(context.resolving),
        depth: context.depth + 1,
      }),
    );
  });
  return fragments;
}

function hasTsApproval(source: string, node: ts.Node) {
  const candidates: ts.Node[] = [node];
  let current: ts.Node | undefined = node;
  while (current.parent && !ts.isSourceFile(current.parent)) {
    const parent: ts.Node = current.parent;
    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isNonNullExpression(parent)
    ) {
      candidates.push(parent);
      current = parent;
      continue;
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer?.getStart() <= node.getStart()) {
      candidates.push(parent);
      const statement = parent.parent?.parent;
      if (statement && ts.isVariableStatement(statement)) candidates.push(statement);
      break;
    }
    if (ts.isReturnStatement(parent) && parent.expression?.getStart() <= node.getStart()) {
      candidates.push(parent);
      break;
    }
    if (ts.isFunctionLike(parent) || ts.isStatement(parent)) break;
    if (ts.isExpression(parent) || ts.isPropertyAssignment(parent)) {
      if (ts.isPropertyAssignment(parent)) candidates.push(parent);
      current = parent;
      continue;
    }
    break;
  }
  for (const current of candidates) {
    const leading = source.slice(current.getFullStart(), current.getStart());
    if (COLOR_APPROVAL.test(leading)) return true;
  }
  return false;
}

function limitedCartesian(left: string[], right: string[], joiner: string, limit: number) {
  const combined: string[] = [];
  for (const leftValue of left) {
    for (const rightValue of right) {
      combined.push(`${leftValue}${joiner}${rightValue}`);
      if (combined.length >= limit) return combined;
    }
  }
  return combined;
}

function staticStringValues(node: ts.Node | undefined, context: EvaluationContext): string[] {
  if (!node) return [];
  if (context.depth > 32) return [];
  if (ts.isJsxExpression(node)) return staticStringValues(node.expression, context);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isIdentifier(node)) {
    const bound = staticBoundExpressions(node, context);
    if (bound.length > 0 && !context.resolving.has(`value:${node.text}`)) {
      const nestedContext = {
        ...context,
        resolving: new Set(context.resolving).add(`value:${node.text}`),
        depth: context.depth + 1,
      };
      return bound.flatMap((expression) => staticStringValues(expression, nestedContext));
    }
    return [];
  }
  if (ts.isTemplateExpression(node)) {
    let values = [node.head.text];
    for (const span of node.templateSpans) {
      const expressionValues = staticStringValues(span.expression, context);
      if (expressionValues.length === 0) return [];
      values = limitedCartesian(values, expressionValues, "", context.maxCombinations).map(
        (value) => `${value}${span.literal.text}`,
      );
    }
    return values;
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return staticStringValues(node.expression, context);
  }
  if (ts.isConditionalExpression(node)) {
    return [
      ...staticStringValues(node.whenTrue, context),
      ...staticStringValues(node.whenFalse, context),
    ];
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return limitedCartesian(
        staticStringValues(node.left, context),
        staticStringValues(node.right, context),
        "",
        context.maxCombinations,
      );
    }
    if (
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [
        ...staticStringValues(node.left, context),
        ...staticStringValues(node.right, context),
      ];
    }
  }
  if (ts.isCallExpression(node)) {
    const called = calledFunction(node, context);
    if (called) {
      return returnedExpressions(called.fn).flatMap((expression) =>
        staticStringValues(expression, called.context),
      );
    }
    if (
      ts.isIdentifier(node.expression) &&
      /^(?:clsx|cn|classnames)$/i.test(node.expression.text)
    ) {
      return node.arguments.flatMap((argument) => staticStringValues(argument, context));
    }
    if (ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === "join") {
        const separator = staticStringValues(node.arguments[0], context)[0] ?? ",";
        return arrayStringSequences(node.expression.expression, context).map((parts) =>
          parts.filter(Boolean).join(separator),
        );
      }
      if (method === "filter") return staticStringValues(node.expression.expression, context);
    }
  }
  if (ts.isArrayLiteralExpression(node)) {
    return arrayStringSequences(node, context).map((parts) => parts.join(" "));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const keys: string[] = [];
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        keys.push(...staticStringValues(property.expression, context));
        continue;
      }
      if (
        ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property) ||
        ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        if (ts.isComputedPropertyName(property.name)) {
          keys.push(...staticStringValues(property.name.expression, context));
        } else {
          const name = propertyName(property.name);
          if (name) keys.push(name);
        }
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          keys.push(
            ...staticStringValues(
              ts.isPropertyAssignment(property) ? property.initializer : property.name,
              context,
            ),
          );
        }
      }
    }
    return keys;
  }
  return [];
}

function arrayStringSequences(node: ts.Node, context: EvaluationContext): string[][] {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "filter"
  ) {
    return arrayStringSequences(node.expression.expression, context).map((parts) =>
      parts.filter(Boolean),
    );
  }
  if (!ts.isArrayLiteralExpression(node)) {
    return staticStringValues(node, context).map((value) => [value]);
  }
  let sequences: string[][] = [[]];
  for (const element of node.elements) {
    const expression = ts.isSpreadElement(element) ? element.expression : element;
    const values = staticStringValues(expression, context);
    if (values.length === 0) continue;
    const next: string[][] = [];
    for (const sequence of sequences) {
      for (const value of values) {
        next.push([...sequence, value]);
        if (next.length >= context.maxCombinations) return next;
      }
    }
    sequences = next;
  }
  return sequences;
}

function classTokens(values: string[]) {
  return values.flatMap((value) => value.split(/\s+/).filter(Boolean));
}

function staticClassTokens(node: ts.Node | undefined, context: EvaluationContext): string[] {
  if (!node) return [];
  if (ts.isJsxExpression(node)) return staticClassTokens(node.expression, context);
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    /^(?:clsx|cn|classnames)$/i.test(node.expression.text)
  ) {
    return node.arguments.flatMap((argument) => staticClassTokens(argument, context));
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) =>
      staticClassTokens(ts.isSpreadElement(element) ? element.expression : element, context),
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    const tokens: string[] = [];
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        tokens.push(...staticClassTokens(property.expression, context));
        continue;
      }
      if (
        ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property) ||
        ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        const keys = ts.isComputedPropertyName(property.name)
          ? staticStringValues(property.name.expression, context)
          : [propertyName(property.name)].filter(Boolean);
        tokens.push(...classTokens(keys));
        if (ts.isComputedPropertyName(property.name)) {
          tokens.push(...computedClassContractTokens(property.name.expression, context));
        }
        if (ts.isPropertyAssignment(property)) {
          tokens.push(...staticClassTokens(property.initializer, context));
        } else if (ts.isShorthandPropertyAssignment(property)) {
          tokens.push(...staticClassTokens(property.name, context));
        }
      }
    }
    return tokens;
  }
  return [
    ...classTokens(staticStringValues(node, context)),
    ...computedClassContractTokens(node, context),
  ];
}

type StaticStringProgram =
  | { kind: "text"; text: string }
  | { kind: "concat"; parts: StaticStringProgram[] }
  | { kind: "choice"; options: StaticStringProgram[] };

const UNKNOWN_STRING_PROGRAM: StaticStringProgram = {
  kind: "choice",
  options: [
    { kind: "text", text: "" },
    { kind: "text", text: "style" },
    { kind: "text", text: "bgcolor" },
  ],
};

function staticArrayElementProgramChoices(
  node: ts.Node | undefined,
  context: EvaluationContext,
): StaticStringProgram[][] | undefined {
  if (!node || context.depth > 32) return undefined;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return staticArrayElementProgramChoices(node.expression, context);
  }
  if (ts.isIdentifier(node)) {
    const parameter = context.bindings.get(node.text);
    if (parameter) return staticArrayElementProgramChoices(parameter, context);
    const assignment = evaluatedVariableBindings(node, context).findLast(
      (binding) => !binding.mutation,
    );
    if (!assignment || context.resolving.has(`array-program:${node.text}`)) {
      return undefined;
    }
    const nestedContext = {
      ...context,
      resolving: new Set(context.resolving).add(`array-program:${node.text}`),
      depth: context.depth + 1,
    };
    const identityBindings = [...context.variables.values()]
      .flat()
      .filter(
        (binding) =>
          binding.identity === assignment.identity &&
          bindingVisibleAtEvaluation(binding, node, context),
      )
      .sort(
        (left, right) =>
          left.position - right.position ||
          (left.semanticOrder ?? left.sourcePosition ?? left.position) -
            (right.semanticOrder ?? right.sourcePosition ?? right.position) ||
          (left.sourcePosition ?? left.position) - (right.sourcePosition ?? right.position),
      );
    const initializer =
      identityBindings.find(
        (binding) => !binding.mutation && !ts.isIdentifier(binding.expression),
      ) ?? assignment;
    let choices = staticArrayElementProgramChoices(initializer.expression, nestedContext) ?? [];
    for (const binding of identityBindings) {
      if (!binding.mutation || binding.position < initializer.position || choices.length === 0) {
        continue;
      }
      const programs = binding.mutation.expressions.map((expression) =>
        staticStringProgram(expression, nestedContext),
      );
      if (binding.mutation.kind === "push") {
        choices = choices.map((choice) => [...choice, ...programs]);
      } else if (binding.mutation.kind === "unshift") {
        choices = choices.map((choice) => [...programs, ...choice]);
      } else if (binding.mutation.index !== undefined) {
        choices = choices.map((choice) => {
          const next = [...choice];
          while (next.length <= binding.mutation!.index!) {
            next.push({ kind: "text", text: "" });
          }
          next[binding.mutation!.index!] = programs[0] ?? UNKNOWN_STRING_PROGRAM;
          return next;
        });
      }
    }
    return choices.length > 0 ? choices.slice(0, context.maxCombinations) : undefined;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "filter"
  ) {
    return staticArrayElementProgramChoices(node.expression.expression, context);
  }
  if (!ts.isArrayLiteralExpression(node)) return undefined;
  let choices: StaticStringProgram[][] = [[]];
  for (const element of node.elements) {
    if (ts.isSpreadElement(element)) {
      const spread = staticArrayElementProgramChoices(element.expression, context);
      if (!spread) return undefined;
      const next: StaticStringProgram[][] = [];
      for (const choice of choices) {
        for (const spreadChoice of spread) {
          next.push([...choice, ...spreadChoice]);
          if (next.length >= context.maxCombinations) break;
        }
        if (next.length >= context.maxCombinations) break;
      }
      choices = next;
    } else {
      choices = choices.map((choice) => [...choice, staticStringProgram(element, context)]);
    }
  }
  return choices;
}

function staticStringProgram(
  node: ts.Node | undefined,
  context: EvaluationContext,
): StaticStringProgram {
  if (!node || context.depth > 32) return UNKNOWN_STRING_PROGRAM;
  if (ts.isJsxExpression(node)) return staticStringProgram(node.expression, context);
  if (ts.isStringLiteralLike(node)) return { kind: "text", text: node.text };
  if (ts.isIdentifier(node)) {
    const bound = staticBoundExpressions(node, context);
    if (bound.length > 0 && !context.resolving.has(`program:${node.text}`)) {
      const nestedContext = {
        ...context,
        resolving: new Set(context.resolving).add(`program:${node.text}`),
        depth: context.depth + 1,
      };
      return {
        kind: "choice",
        options: bound.map((expression) => staticStringProgram(expression, nestedContext)),
      };
    }
    return UNKNOWN_STRING_PROGRAM;
  }
  if (ts.isTemplateExpression(node)) {
    const parts: StaticStringProgram[] = [{ kind: "text", text: node.head.text }];
    for (const span of node.templateSpans) {
      parts.push(staticStringProgram(span.expression, context));
      parts.push({ kind: "text", text: span.literal.text });
    }
    return { kind: "concat", parts };
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return staticStringProgram(node.expression, context);
  }
  if (ts.isConditionalExpression(node)) {
    return {
      kind: "choice",
      options: [
        staticStringProgram(node.whenTrue, context),
        staticStringProgram(node.whenFalse, context),
      ],
    };
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return {
        kind: "concat",
        parts: [staticStringProgram(node.left, context), staticStringProgram(node.right, context)],
      };
    }
    if (
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return {
        kind: "choice",
        options: [
          staticStringProgram(node.left, context),
          staticStringProgram(node.right, context),
        ],
      };
    }
  }
  if (ts.isCallExpression(node)) {
    const called = calledFunction(node, context);
    if (called) {
      return {
        kind: "choice",
        options: returnedExpressions(called.fn).map((expression) =>
          staticStringProgram(expression, called.context),
        ),
      };
    }
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "join") {
      const separator = staticStringValues(node.arguments[0], context)[0] ?? ",";
      const choices = staticArrayElementProgramChoices(node.expression.expression, context);
      if (choices) {
        const options = choices.map((elements) => ({
          kind: "concat" as const,
          parts: elements.flatMap((element, index) =>
            index > 0 ? [{ kind: "text" as const, text: separator }, element] : [element],
          ),
        }));
        return options.length === 1 ? options[0] : { kind: "choice", options };
      }
    }
  }
  return UNKNOWN_STRING_PROGRAM;
}

const BODY_COPY_CLASS_TOKENS = [
  "text-gold",
  "font-display",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
  "text-7xl",
  "text-8xl",
  "text-9xl",
] as const;
const BLOCKED_CLASS_PREFIX = "\u0000";
const MATCHED_CLASS_PREFIX = "\u0001";
const EMPTY_OPACITY_CLASS_PREFIX = "\u0002";
const OPACITY_CLASS_PREFIX = "\u0003";
const IMPORTANT_SUFFIX_CLASS_PREFIX = "\u0004";

function classStateToken(state: string) {
  for (const prefix of [
    MATCHED_CLASS_PREFIX,
    OPACITY_CLASS_PREFIX,
    IMPORTANT_SUFFIX_CLASS_PREFIX,
  ]) {
    if (state.startsWith(prefix)) return state.slice(prefix.length);
  }
  return undefined;
}

function recordClassContractState(state: string, found: Set<string>) {
  const token = classStateToken(state);
  if (token) found.add(token);
}

function advanceClassContractProgram(
  program: StaticStringProgram,
  states: Set<string>,
  found: Set<string>,
): Set<string> {
  if (program.kind === "text") {
    let current = states;
    for (const character of program.text) {
      const next = new Set<string>();
      for (const state of current) {
        if (/\s/.test(character)) {
          recordClassContractState(state, found);
          next.add("");
          continue;
        }
        if (state.startsWith(EMPTY_OPACITY_CLASS_PREFIX)) {
          next.add(
            character === "!"
              ? BLOCKED_CLASS_PREFIX
              : `${OPACITY_CLASS_PREFIX}${state.slice(EMPTY_OPACITY_CLASS_PREFIX.length)}`,
          );
          continue;
        }
        if (state.startsWith(OPACITY_CLASS_PREFIX)) {
          next.add(
            character === "!"
              ? `${IMPORTANT_SUFFIX_CLASS_PREFIX}${state.slice(OPACITY_CLASS_PREFIX.length)}`
              : state,
          );
          continue;
        }
        if (character === ":") {
          next.add("");
          continue;
        }
        if (state.startsWith(MATCHED_CLASS_PREFIX)) {
          const token = state.slice(MATCHED_CLASS_PREFIX.length);
          next.add(
            character === "/"
              ? `${EMPTY_OPACITY_CLASS_PREFIX}${token}`
              : character === "!"
                ? `${IMPORTANT_SUFFIX_CLASS_PREFIX}${token}`
                : BLOCKED_CLASS_PREFIX,
          );
          continue;
        }
        if (state.startsWith(IMPORTANT_SUFFIX_CLASS_PREFIX)) {
          next.add(BLOCKED_CLASS_PREFIX);
          continue;
        }
        if (state === BLOCKED_CLASS_PREFIX) {
          next.add(state);
          continue;
        }
        const candidate = `${state}${character}`;
        const matched = BODY_COPY_CLASS_TOKENS.find(
          (token) => candidate === token || candidate === `!${token}`,
        );
        if (matched) {
          next.add(`${MATCHED_CLASS_PREFIX}${matched}`);
          continue;
        }
        next.add(
          BODY_COPY_CLASS_TOKENS.some(
            (token) => token.startsWith(candidate) || `!${token}`.startsWith(candidate),
          )
            ? candidate
            : BLOCKED_CLASS_PREFIX,
        );
      }
      current = next;
    }
    return current;
  }
  if (program.kind === "concat") {
    let current = states;
    for (const part of program.parts) {
      current = advanceClassContractProgram(part, current, found);
    }
    return current;
  }
  const next = new Set<string>();
  for (const option of program.options) {
    for (const state of advanceClassContractProgram(option, states, found)) next.add(state);
  }
  return next;
}

function computedClassContractTokens(node: ts.Node, context: EvaluationContext) {
  const found = new Set<string>();
  const finalStates = advanceClassContractProgram(
    staticStringProgram(node, context),
    new Set([""]),
    found,
  );
  for (const state of finalStates) recordClassContractState(state, found);
  return [...found];
}

type SymbolicHtmlMode = "text" | "tag" | "attribute" | "style-block";
type SymbolicHtmlState = {
  mode: SymbolicHtmlMode;
  tagPhase: "name" | "attributes";
  tagName: string;
  tagIsStyle: boolean;
  closingTag: boolean;
  attrName: string;
  attrKind: "" | "style" | "bgcolor";
  attrPhase: "name" | "after-name" | "after-equals";
  quote: "" | "'" | '"';
  closeProgress: number;
  styleCloseQuote: "" | "'" | '"';
  styleClosePhase:
    | "before-name"
    | "name"
    | "after-name"
    | "before-value"
    | "value"
    | "after-quoted-value";
  colorWord: string;
  colorAwaitParen: boolean;
  hexDigits: number;
  cssComment: "none" | "slash" | "comment" | "comment-star";
  cssString: "" | "'" | '"';
  cssEscape: boolean;
  found: boolean;
  foundColor: string;
  hexValue: string;
};

const COLOR_FUNCTION_NAMES = [
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "oklch",
  "oklab",
  "lab",
  "lch",
  "color",
];
const VALID_HEX_LENGTHS = new Set([3, 4, 6, 8]);

function initialSymbolicHtmlState(): SymbolicHtmlState {
  return {
    mode: "text",
    tagPhase: "name",
    tagName: "",
    tagIsStyle: false,
    closingTag: false,
    attrName: "",
    attrKind: "",
    attrPhase: "name",
    quote: "",
    closeProgress: 0,
    styleCloseQuote: "",
    styleClosePhase: "before-name",
    colorWord: "",
    colorAwaitParen: false,
    hexDigits: -1,
    cssComment: "none",
    cssString: "",
    cssEscape: false,
    found: false,
    foundColor: "",
    hexValue: "",
  };
}

function finishSymbolicColor(state: SymbolicHtmlState) {
  return state.hexDigits >= 0 && VALID_HEX_LENGTHS.has(state.hexDigits)
    ? { ...state, found: true, foundColor: state.hexValue, hexDigits: -1, hexValue: "" }
    : { ...state, hexDigits: -1, hexValue: "" };
}

function feedSymbolicColor(state: SymbolicHtmlState, character: string): SymbolicHtmlState {
  if (state.found) return state;
  const lower = character.toLowerCase();
  if (state.hexDigits >= 0) {
    if (/[\da-f]/i.test(character))
      return {
        ...state,
        hexDigits: state.hexDigits + 1,
        hexValue: `${state.hexValue}${character}`,
      };
    const finished = finishSymbolicColor(state);
    if (finished.found) return finished;
    state = finished;
  }
  if (character === "#") {
    return {
      ...state,
      hexDigits: 0,
      hexValue: "#",
      colorWord: "",
      colorAwaitParen: false,
    };
  }
  if (state.colorAwaitParen) {
    if (/\s/.test(character)) return state;
    if (character === "(")
      return {
        ...state,
        found: true,
        foundColor: `${state.colorWord}(`,
        colorAwaitParen: false,
      };
    state = { ...state, colorAwaitParen: false, colorWord: "" };
  }
  if (/[a-z]/i.test(character)) {
    if (state.colorWord === "blocked") return state;
    const candidate = `${state.colorWord}${lower}`;
    return {
      ...state,
      colorWord: COLOR_FUNCTION_NAMES.some((name) => name.startsWith(candidate))
        ? candidate
        : "blocked",
    };
  }
  if (/[\d-]/.test(character)) return { ...state, colorWord: "blocked" };
  if (COLOR_FUNCTION_NAMES.includes(state.colorWord)) {
    if (character === "(")
      return { ...state, found: true, foundColor: `${state.colorWord}(`, colorWord: "" };
    if (/\s/.test(character)) {
      return { ...state, colorAwaitParen: true };
    }
  }
  return { ...state, colorWord: "", colorAwaitParen: false };
}

function targetPrefix(value: string, targets: string[]) {
  const lower = value.toLowerCase();
  return targets.some((target) => target.startsWith(lower)) ? lower : "blocked";
}

function resetSymbolicAttribute(state: SymbolicHtmlState): SymbolicHtmlState {
  return {
    ...state,
    attrName: "",
    attrKind: "",
    attrPhase: "name",
    quote: "",
    colorWord: "",
    colorAwaitParen: false,
    hexDigits: -1,
    hexValue: "",
  };
}

function feedSymbolicTagAttribute(state: SymbolicHtmlState, character: string): SymbolicHtmlState {
  if (character === ">") {
    return {
      ...resetSymbolicAttribute(state),
      mode: state.tagIsStyle && !state.closingTag ? "style-block" : "text",
      closeProgress: 0,
    };
  }
  if (state.attrPhase === "after-equals") {
    if (/\s/.test(character)) return state;
    if (character === '"' || character === "'") {
      return state.attrKind
        ? {
            ...state,
            mode: "attribute",
            quote: character,
            colorWord: "",
            colorAwaitParen: false,
            hexDigits: -1,
          }
        : resetSymbolicAttribute(state);
    }
    return resetSymbolicAttribute(state);
  }
  if (/\s/.test(character)) {
    if (state.attrPhase === "name" && ["style", "bgcolor"].includes(state.attrName)) {
      return {
        ...state,
        attrKind: state.attrName as "style" | "bgcolor",
        attrPhase: "after-name",
      };
    }
    return state.attrName === "" || state.attrPhase === "after-name"
      ? state
      : resetSymbolicAttribute(state);
  }
  if (character === "=") {
    const attrKind =
      state.attrKind || (["style", "bgcolor"].includes(state.attrName) ? state.attrName : "");
    return attrKind
      ? {
          ...state,
          attrKind: attrKind as "style" | "bgcolor",
          attrPhase: "after-equals",
        }
      : resetSymbolicAttribute(state);
  }
  if (/[\w-]/.test(character)) {
    const attrName =
      state.attrPhase === "after-name"
        ? targetPrefix(character, ["style", "bgcolor"])
        : state.attrName === "blocked"
          ? "blocked"
          : targetPrefix(`${state.attrName}${character}`, ["style", "bgcolor"]);
    return { ...state, attrName, attrKind: "", attrPhase: "name" };
  }
  return resetSymbolicAttribute(state);
}

function feedSymbolicHtml(state: SymbolicHtmlState, character: string): SymbolicHtmlState {
  if (state.found) return state;
  if (state.mode === "attribute") {
    if (character === state.quote) {
      const finished = finishSymbolicColor(state);
      return finished.found ? finished : { ...resetSymbolicAttribute(finished), mode: "tag" };
    }
    return feedSymbolicColor(state, character);
  }
  if (state.mode === "style-block") {
    const close = "</style";
    const closeTail = close.length + 1;
    const lower = character.toLowerCase();
    let closeProgress: number;
    let styleClosed = false;
    let styleCloseQuote = state.styleCloseQuote;
    let styleClosePhase = state.styleClosePhase;
    if (state.closeProgress === closeTail) {
      if (styleCloseQuote) {
        if (character === styleCloseQuote) {
          styleCloseQuote = "";
          styleClosePhase = "after-quoted-value";
        }
      } else {
        styleClosed = character === ">";
        if (!styleClosed && styleClosePhase === "before-value") {
          if (/\s/.test(character)) {
            // Keep waiting for a value.
          } else if (character === '"' || character === "'") {
            styleCloseQuote = character;
          } else {
            styleClosePhase = "value";
          }
        } else if (!styleClosed && styleClosePhase === "before-name") {
          if (!/[\t\n\f\r /]/.test(character)) styleClosePhase = "name";
        } else if (!styleClosed && styleClosePhase === "name") {
          if (/\s/.test(character)) styleClosePhase = "after-name";
          else if (character === "/") styleClosePhase = "before-name";
          else if (character === "=") styleClosePhase = "before-value";
        } else if (!styleClosed && styleClosePhase === "after-name") {
          if (character === "=") styleClosePhase = "before-value";
          else if (character === "/") styleClosePhase = "before-name";
          else if (!/[\t\n\f\r /]/.test(character)) styleClosePhase = "name";
        } else if (!styleClosed && styleClosePhase === "after-quoted-value") {
          if (/\s/.test(character) || character === "/") styleClosePhase = "before-name";
          else styleClosePhase = "name";
        } else if (!styleClosed && styleClosePhase === "value" && /\s/.test(character)) {
          styleClosePhase = "before-name";
        }
      }
      closeProgress = closeTail;
    } else if (state.closeProgress === close.length) {
      styleClosed = character === ">";
      closeProgress = /[\t\n\f\r /]/.test(character) ? closeTail : lower === close[0] ? 1 : 0;
    } else {
      closeProgress =
        lower === close[state.closeProgress] ? state.closeProgress + 1 : lower === close[0] ? 1 : 0;
    }
    if (styleClosed) {
      const finished = finishSymbolicColor(state);
      return finished.found ? finished : { ...initialSymbolicHtmlState(), mode: "text" };
    }
    state = { ...state, closeProgress, styleCloseQuote, styleClosePhase };
    if (closeProgress === closeTail) return state;
    if (state.cssString) {
      if (state.cssEscape) return { ...state, cssEscape: false };
      if (character === "\\") return { ...state, cssEscape: true };
      return character === state.cssString ? { ...state, cssString: "" } : state;
    }
    if (state.cssComment === "comment") {
      return {
        ...state,
        closeProgress,
        cssComment: character === "*" ? "comment-star" : "comment",
      };
    }
    if (state.cssComment === "comment-star") {
      return {
        ...state,
        closeProgress,
        cssComment: character === "/" ? "none" : character === "*" ? "comment-star" : "comment",
      };
    }
    if (state.cssComment === "slash") {
      if (character === "*") return { ...state, closeProgress, cssComment: "comment" };
      const colored = feedSymbolicColor({ ...state, cssComment: "none" }, character);
      return { ...colored, closeProgress };
    }
    if (character === '"' || character === "'") {
      const finished = finishSymbolicColor(state);
      if (finished.found) return finished;
      return {
        ...finished,
        closeProgress,
        cssString: character,
        cssEscape: false,
        colorWord: "",
        colorAwaitParen: false,
      };
    }
    if (character === "/") {
      const finished = finishSymbolicColor(state);
      if (finished.found) return finished;
      return {
        ...finished,
        closeProgress,
        cssComment: "slash",
        colorWord: "",
        colorAwaitParen: false,
      };
    }
    const colored = feedSymbolicColor(state, character);
    if (colored.found) return colored;
    return { ...colored, closeProgress };
  }
  if (state.mode === "text") {
    return character === "<"
      ? { ...initialSymbolicHtmlState(), mode: "tag", tagPhase: "name" }
      : state;
  }
  if (state.tagPhase === "name") {
    if (state.tagName === "" && /\s/.test(character)) return state;
    if (state.tagName === "" && character === "/") return { ...state, closingTag: true };
    if (/[a-z\d-]/i.test(character)) {
      return { ...state, tagName: targetPrefix(`${state.tagName}${character}`, ["style"]) };
    }
    const tagIsStyle = state.tagName === "style";
    return feedSymbolicTagAttribute({ ...state, tagPhase: "attributes", tagIsStyle }, character);
  }
  return feedSymbolicTagAttribute(state, character);
}

function symbolicHtmlStateKey(state: SymbolicHtmlState) {
  // Hex validity depends on length, not the particular digits. Keeping one representative
  // prevents branch-heavy static templates from recreating a Cartesian product.
  return JSON.stringify({ ...state, hexValue: "", foundColor: "" });
}

function advanceSymbolicProgram(
  program: StaticStringProgram,
  states: SymbolicHtmlState[],
): SymbolicHtmlState[] {
  if (program.kind === "text") {
    let current = states;
    for (const character of program.text) {
      const next = new Map<string, SymbolicHtmlState>();
      for (const state of current) {
        const advanced = feedSymbolicHtml(state, character);
        if (advanced.found) return [advanced];
        next.set(symbolicHtmlStateKey(advanced), advanced);
      }
      current = [...next.values()];
    }
    return current;
  }
  if (program.kind === "concat") {
    let current = states;
    for (const part of program.parts) {
      current = advanceSymbolicProgram(part, current);
      if (current.some((state) => state.found)) return current;
    }
    return current;
  }
  const next = new Map<string, SymbolicHtmlState>();
  for (const option of program.options) {
    for (const state of advanceSymbolicProgram(option, states)) {
      if (state.found) return [state];
      next.set(symbolicHtmlStateKey(state), state);
    }
  }
  return [...next.values()];
}

function symbolicRawHtmlColor(node: ts.Node, context: EvaluationContext) {
  const states = advanceSymbolicProgram(staticStringProgram(node, context), [
    initialSymbolicHtmlState(),
  ]);
  for (const state of states) {
    const finished = state.found ? state : finishSymbolicColor(state);
    if (finished.found) return finished.foundColor;
  }
  return undefined;
}

function isDecorativeGoldClass(token: string) {
  return /(?:^|:)!?text-gold(?:\/[^\s!]+)?!?$/.test(token);
}

function isZodSchemaProperty(node: ts.PropertyAssignment) {
  const object = node.parent;
  if (!ts.isObjectLiteralExpression(object) || !ts.isCallExpression(object.parent)) return false;
  const expression = object.parent.expression;
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "z" &&
    expression.name.text === "object"
  );
}

function scanTsSource(root: string, file: string, issues: StyleContractIssue[]) {
  const source = read(root, file);
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const variables = new Map<string, StaticVariableBinding[]>();
  const functions = new Map<string, FunctionNode>();
  const presentationRoots = new Set<ts.Node>();
  const inlineStyleRoots = new Set<ts.Node>();
  const rawHtmlRoots = new Set<ts.Node>();
  const reportedColorStarts = new Set<number>();
  let nextArrayIdentity = 1;

  const recordVariable = (
    name: string,
    expression: ts.Expression,
    scope: ts.Node,
    position: number,
    mutation?: StaticVariableBinding["mutation"],
    sharedIdentity?: number,
  ) => {
    let identity = sharedIdentity;
    if (identity === undefined && !mutation && ts.isIdentifier(expression)) {
      const target = visibleVariableBindings(variables, expression.text, expression).findLast(
        (binding) => !binding.mutation,
      );
      if (target && nearestFunctionScope(scope) === nearestFunctionScope(target.scope)) {
        identity = target.identity;
      }
    }
    identity ??= nextArrayIdentity++;
    const bindings = variables.get(name) ?? [];
    bindings.push({
      expression,
      identity,
      scope,
      position,
      mutation,
      executionFunction: mutation ? nearestFunctionScope(expression) : undefined,
    });
    variables.set(name, bindings);
  };

  const staticArrayIndex = (
    expression: ts.Expression,
    reference: ts.Node,
    evaluationNode?: ts.Node,
    resolving = new Set<string>(),
  ): number | undefined => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isNonNullExpression(expression)
    ) {
      return staticArrayIndex(expression.expression, reference, evaluationNode, resolving);
    }
    if (ts.isNumericLiteral(expression) || ts.isStringLiteral(expression)) {
      const index = Number(expression.text);
      return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
    }
    if (ts.isIdentifier(expression) && !resolving.has(expression.text)) {
      const candidates = (variables.get(expression.text) ?? []).filter(
        (binding) =>
          !binding.mutation &&
          binding.scope.getStart() <= reference.getStart() &&
          binding.scope.getEnd() >= reference.getEnd(),
      );
      let scope = candidates[0]?.scope;
      for (const binding of candidates) {
        if (scope && binding.scope.getWidth() < scope.getWidth()) scope = binding.scope;
      }
      const containingFunction = nearestFunctionScope(reference);
      const scopeIsInsideFunction =
        containingFunction &&
        scope &&
        scope.getStart() >= containingFunction.getStart() &&
        scope.getEnd() <= containingFunction.getEnd();
      const position =
        evaluationNode && containingFunction && !scopeIsInsideFunction
          ? evaluationNode.getStart()
          : reference.getStart();
      const binding = candidates
        .filter((candidate) => candidate.scope === scope && candidate.position <= position)
        .sort((left, right) => left.position - right.position)
        .at(-1);
      return binding
        ? staticArrayIndex(
            binding.expression,
            binding.expression,
            evaluationNode,
            new Set(resolving).add(expression.text),
          )
        : undefined;
    }
    return undefined;
  };

  const readArrayMutation = (
    node: ts.Node,
  ):
    | {
        name: string;
        mutation: NonNullable<StaticVariableBinding["mutation"]>;
        indexExpression?: ts.Expression;
      }
    | undefined => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      (node.expression.name.text === "push" || node.expression.name.text === "unshift") &&
      node.arguments.length > 0
    ) {
      return {
        name: node.expression.expression.text,
        mutation: { kind: node.expression.name.text, expressions: [...node.arguments] },
      };
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isElementAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.argumentExpression
    ) {
      return {
        name: node.left.expression.text,
        mutation: { kind: "index", expressions: [node.right] },
        indexExpression: node.left.argumentExpression,
      };
    }
    return undefined;
  };

  const evaluatedArrayMutation = (
    mutation: NonNullable<ReturnType<typeof readArrayMutation>>,
    reference: ts.Node,
    evaluationNode?: ts.Node,
  ): NonNullable<StaticVariableBinding["mutation"]> | undefined => {
    if (mutation.mutation.kind !== "index") return mutation.mutation;
    if (!mutation.indexExpression) return undefined;
    const index = staticArrayIndex(mutation.indexExpression, reference, evaluationNode);
    return index === undefined ? undefined : { ...mutation.mutation, index };
  };

  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const declarationList = node.parent;
      const blockScoped =
        ts.isVariableDeclarationList(declarationList) &&
        Boolean(declarationList.flags & ts.NodeFlags.BlockScoped);
      recordVariable(
        node.name.text,
        node.initializer,
        nearestVariableScope(node, blockScoped),
        node.getStart(),
      );
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        functions.set(node.name.text, node.initializer);
      }
      if (isPresentationPropertyName(node.name.text)) presentationRoots.add(node.initializer);
    }
    if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node);
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && node.initializer) {
      recordVariable(node.name.text, node.initializer, nearestVariableScope(node), node.getStart());
      if (isPresentationPropertyName(node.name.text)) presentationRoots.add(node.initializer);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const prior = visibleVariableBindings(variables, node.left.text, node);
      recordVariable(
        node.left.text,
        node.right,
        prior[0]?.scope ?? nearestVariableScope(node, false),
        node.getStart(),
      );
    }
    const arrayMutation = readArrayMutation(node);
    if (arrayMutation) {
      const mutation = evaluatedArrayMutation(arrayMutation, node);
      if (mutation) {
        const prior = visibleVariableBindings(variables, arrayMutation.name, node);
        recordVariable(
          arrayMutation.name,
          mutation.expressions[0],
          prior[0]?.scope ?? nearestVariableScope(node, false),
          node.getStart(),
          mutation,
          prior.at(-1)?.identity,
        );
      }
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (PRESENTATION_ATTRIBUTE_NAMES.has(name)) presentationRoots.add(node.initializer ?? node);
    }
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (isPresentationPropertyName(name) && !isZodSchemaProperty(node)) {
        presentationRoots.add(node.initializer);
      }
      if (name === "content" && ts.isObjectLiteralExpression(node.parent)) {
        const themeName = node.parent.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            propertyName(property.name) === "name" &&
            ts.isStringLiteralLike(property.initializer) &&
            property.initializer.text === "theme-color",
        );
        if (themeName) presentationRoots.add(node.initializer);
      }
    }
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(sourceFile).toLowerCase() === "style"
    ) {
      for (const child of node.children) {
        if (ts.isJsxExpression(child) && child.expression) inlineStyleRoots.add(child.expression);
      }
    }
    if (ts.isStringLiteralLike(node)) {
      if (TAILWIND_PRESENTATION.test(node.text)) presentationRoots.add(node);
      if (node.text.includes("<")) rawHtmlRoots.add(node);
    }
    if (ts.isTemplateExpression(node)) rawHtmlRoots.add(node);
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "join"
    ) {
      rawHtmlRoots.add(node);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      !(
        ts.isBinaryExpression(node.parent) &&
        node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken
      )
    )
      rawHtmlRoots.add(node);
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);
  const functionNeedsCallSiteEvaluation = (fn: FunctionNode, call: ts.CallExpression) => {
    let needed = false;
    const visit = (node: ts.Node) => {
      if (needed || (node !== fn && ts.isFunctionLike(node))) return;
      if (ts.isIdentifier(node)) {
        const candidates = (variables.get(node.text) ?? []).filter(
          (binding) =>
            binding.scope.getStart() <= node.getStart() && binding.scope.getEnd() >= node.getEnd(),
        );
        if (candidates.length > 0) {
          let scope = candidates[0].scope;
          for (const binding of candidates) {
            if (
              binding.scope.getEnd() - binding.scope.getStart() <
              scope.getEnd() - scope.getStart()
            ) {
              scope = binding.scope;
            }
          }
          const captured = !(scope.getStart() >= fn.getStart() && scope.getEnd() <= fn.getEnd());
          const capturedIdentities = new Set(
            candidates
              .filter(
                (binding) =>
                  binding.scope === scope &&
                  !binding.mutation &&
                  binding.position <= (captured ? call.getStart() : node.getStart()),
              )
              .map((binding) => binding.identity),
          );
          const sharedMutationOnTimeline = [...variables.values()].some((bindings) =>
            bindings.some(
              (binding) =>
                binding.mutation &&
                capturedIdentities.has(binding.identity) &&
                (binding.callSite !== undefined ||
                  (!binding.executionFunction &&
                    binding.position > node.getStart() &&
                    binding.position <= call.getStart())),
            ),
          );
          needed =
            captured &&
            (sharedMutationOnTimeline ||
              candidates.some(
                (binding) =>
                  binding.scope === scope &&
                  !binding.mutation &&
                  binding.position > node.getStart() &&
                  binding.position <= call.getStart(),
              ));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(fn);
    return needed;
  };
  const callsByFunction = new Map<FunctionNode, ts.CallExpression[]>();
  const collectStaticFunctionCalls = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = functions.get(node.expression.text);
      if (fn) callsByFunction.set(fn, [...(callsByFunction.get(fn) ?? []), node]);
    }
    ts.forEachChild(node, collectStaticFunctionCalls);
  };
  collectStaticFunctionCalls(sourceFile);

  const chooseNarrowestLatest = (bindings: StaticVariableBinding[]) => {
    if (bindings.length === 0) return undefined;
    let scope = bindings[0].scope;
    for (const binding of bindings) {
      if (binding.scope.getWidth() < scope.getWidth()) scope = binding.scope;
    }
    return bindings
      .filter((binding) => binding.scope === scope)
      .sort((left, right) => left.position - right.position)
      .at(-1);
  };

  const resolveMutationTarget = (
    name: string,
    fn: FunctionNode,
    call: ts.CallExpression,
    mutationNode: ts.Node,
    resolving = new Set<string>(),
  ): { name: string; binding: StaticVariableBinding } | undefined => {
    if (resolving.has(name)) return undefined;
    const nextResolving = new Set(resolving).add(name);
    const local = chooseNarrowestLatest(
      (variables.get(name) ?? []).filter(
        (binding) =>
          !binding.mutation &&
          binding.scope.getStart() >= fn.getStart() &&
          binding.scope.getEnd() <= fn.getEnd() &&
          binding.scope.getStart() <= mutationNode.getStart() &&
          binding.scope.getEnd() >= mutationNode.getEnd() &&
          binding.position <= mutationNode.getStart(),
      ),
    );
    if (local) {
      return ts.isIdentifier(local.expression)
        ? resolveMutationTarget(local.expression.text, fn, call, mutationNode, nextResolving)
        : { name, binding: local };
    }
    const captured = chooseNarrowestLatest(
      (variables.get(name) ?? []).filter(
        (binding) =>
          !binding.mutation &&
          binding.scope.getStart() <= fn.getStart() &&
          binding.scope.getEnd() >= fn.getEnd() &&
          binding.position <= call.getStart(),
      ),
    );
    return captured ? { name, binding: captured } : undefined;
  };

  let semanticMutationCount = 0;
  const maxSemanticMutations = 256;
  const maxSemanticCallDepth = 16;
  const maxSemanticEventsPerCall = 512;
  const maxPresentationReachabilityDepth = 64;
  let semanticMutationOverflowPosition: number | undefined;
  const semanticOrdersByCall = new Map<ts.CallExpression, Map<ts.Node, number[]>>();
  const semanticallyReachedFunctions = new Set<FunctionNode>();
  const presentationEventMemo = new Map<FunctionNode, boolean>();
  const functionHasPresentationEvents = (
    fn: FunctionNode,
    visiting = new Set<FunctionNode>(),
    depth = 0,
  ): boolean => {
    const canMemoize = visiting.size === 0;
    const memoized = canMemoize ? presentationEventMemo.get(fn) : undefined;
    if (memoized !== undefined) return memoized;
    if (depth > maxPresentationReachabilityDepth) return true;
    if (visiting.has(fn)) return false;
    const nextVisiting = new Set(visiting).add(fn);
    let relevant = false;
    const visit = (node: ts.Node) => {
      if (relevant || (node !== fn && ts.isFunctionLike(node))) return;
      if (rawHtmlRoots.has(node) || readArrayMutation(node)) {
        relevant = true;
        return;
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const called = functions.get(node.expression.text);
        if (called && functionHasPresentationEvents(called, nextVisiting, depth + 1)) {
          relevant = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(fn);
    if (canMemoize) presentationEventMemo.set(fn, relevant);
    return relevant;
  };
  const topLevelStaticCalls = [...callsByFunction.entries()]
    .flatMap(([fn, calls]) =>
      calls
        .filter((call) => !nearestFunctionScope(call) && functionHasPresentationEvents(fn))
        .map((call) => ({ call, fn })),
    )
    .sort((left, right) => left.call.getStart() - right.call.getStart());

  for (const { call, fn } of topLevelStaticCalls) {
    const orders = new Map<ts.Node, number[]>();
    semanticOrdersByCall.set(call, orders);
    const reached = new Set<FunctionNode>();
    const stack = new Set<FunctionNode>();
    let semanticOrder = 0;
    let semanticEventCount = 0;
    let sawRawHtml = false;
    let unsafeReplay = false;
    const recordSemanticOrder = (node: ts.Node) => {
      const nodeOrders = orders.get(node) ?? [];
      if (nodeOrders.at(-1) !== semanticOrder) nodeOrders.push(semanticOrder);
      orders.set(node, nodeOrders);
    };

    const recordSemanticMutation = (
      executionFunction: FunctionNode,
      name: string,
      mutationNode: ts.Node,
      mutation: NonNullable<StaticVariableBinding["mutation"]>,
    ) => {
      const target = resolveMutationTarget(name, executionFunction, call, mutationNode);
      if (!target) return;
      if (semanticMutationCount >= maxSemanticMutations) {
        unsafeReplay = true;
        return;
      }
      semanticOrder += 1;
      const bindings = variables.get(target.name) ?? [];
      bindings.push({
        expression: mutation.expressions[0],
        identity: target.binding.identity,
        scope: target.binding.scope,
        position: call.getStart(),
        mutation,
        callSite: call,
        sourcePosition: mutationNode.getStart(),
        semanticOrder,
      });
      variables.set(target.name, bindings);
      semanticMutationCount += 1;
    };

    const replayFunction = (executionFunction: FunctionNode, depth: number) => {
      if (depth > maxSemanticCallDepth || stack.has(executionFunction)) {
        unsafeReplay = true;
        return;
      }
      reached.add(executionFunction);
      stack.add(executionFunction);
      const visit = (node: ts.Node) => {
        if (node !== executionFunction && ts.isFunctionLike(node)) return;
        recordSemanticOrder(node);
        if (rawHtmlRoots.has(node)) sawRawHtml = true;
        if (semanticEventCount >= maxSemanticEventsPerCall) {
          unsafeReplay = true;
          return;
        }
        const mutation = readArrayMutation(node);
        if (mutation) {
          semanticEventCount += 1;
          const evaluatedMutation = evaluatedArrayMutation(mutation, node, call);
          if (evaluatedMutation) {
            recordSemanticMutation(executionFunction, mutation.name, node, evaluatedMutation);
          }
          return;
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const called = functions.get(node.expression.text);
          if (called) {
            semanticEventCount += 1;
            replayFunction(called, depth + 1);
            recordSemanticOrder(node);
            return;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(executionFunction);
      stack.delete(executionFunction);
    };

    replayFunction(fn, 0);
    recordSemanticOrder(call);
    for (const reachedFunction of reached) semanticallyReachedFunctions.add(reachedFunction);
    if (sawRawHtml) rawHtmlRoots.add(call);
    if (unsafeReplay) semanticMutationOverflowPosition ??= call.getStart();
  }
  if (semanticMutationOverflowPosition !== undefined) {
    issueAtLine(
      issues,
      "hardcoded-color",
      file,
      lineOf(source, semanticMutationOverflowPosition),
      "Static array mutation analysis exceeded its bounded budget; review the generated presentation manually.",
    );
  }

  for (const [fn, calls] of callsByFunction) {
    const topLevelCalls = calls.filter((call) => !nearestFunctionScope(call));
    if (!topLevelCalls.some((call) => functionNeedsCallSiteEvaluation(fn, call))) continue;
    for (const call of topLevelCalls) rawHtmlRoots.add(call);
    for (const root of rawHtmlRoots) {
      if (nearestFunctionScope(root) === fn) rawHtmlRoots.delete(root);
    }
  }
  for (const root of rawHtmlRoots) {
    const containingFunction = nearestFunctionScope(root);
    if (containingFunction && semanticallyReachedFunctions.has(containingFunction)) {
      rawHtmlRoots.delete(root);
    }
  }

  const evaluation: EvaluationContext = {
    variables,
    functions,
    bindings: new Map(),
    resolving: new Set(),
    depth: 0,
    maxCombinations: 256,
    semanticOrdersByCall,
  };

  const reportColor = (fragment: StaticFragment, match: RegExpMatchArray, offset = 0) => {
    const start = fragment.start + offset + (match.index ?? 0);
    if (reportedColorStarts.has(start)) return;
    reportedColorStarts.add(start);
    issueAtLine(
      issues,
      "hardcoded-color",
      file,
      lineOf(source, start),
      `Use a semantic/component token instead of ${match[0]}.`,
    );
  };

  for (const presentationRoot of presentationRoots) {
    for (const fragment of staticFragments(presentationRoot, evaluation)) {
      if (hasTsApproval(source, fragment.node) || hasTsApproval(source, presentationRoot)) continue;
      for (const match of colorMatches(fragment.text)) {
        reportColor(fragment, match);
      }
    }
  }

  for (const rawHtmlRoot of rawHtmlRoots) {
    if (hasTsApproval(source, rawHtmlRoot)) continue;
    const rawHtmlColor = symbolicRawHtmlColor(rawHtmlRoot, evaluation);
    if (!rawHtmlColor) continue;
    const start = rawHtmlRoot.getStart();
    if (reportedColorStarts.has(start)) continue;
    reportedColorStarts.add(start);
    issueAtLine(
      issues,
      "hardcoded-color",
      file,
      lineOf(source, start),
      `Use semantic/component tokens instead of ${rawHtmlColor} in generated HTML presentation.`,
    );
  }

  for (const inlineStyleRoot of inlineStyleRoots) {
    for (const fragment of staticFragments(inlineStyleRoot, evaluation)) {
      if (hasTsApproval(source, fragment.node)) continue;
      let inlineCss: Root;
      try {
        inlineCss = parseCss(fragment.text);
      } catch {
        continue;
      }
      inlineCss.walkDecls((declaration) => {
        for (const match of colorMatches(declaration.value)) {
          reportColor(fragment, match, declaration.source.start?.offset ?? 0);
        }
      });
    }
  }

  const visitBodyCopy = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sourceFile).toLowerCase();
      if (BODY_TAGS.has(tag)) {
        const classAttribute = node.openingElement.attributes.properties.find(
          (attribute): attribute is ts.JsxAttribute =>
            ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "className",
        );
        if (classAttribute) {
          const tokens = staticClassTokens(classAttribute.initializer, evaluation);
          const usesGold = tokens.some(isDecorativeGoldClass);
          const decorative = tokens.some(
            (token) =>
              token === "uppercase" ||
              token.includes("eyebrow") ||
              token.includes("title") ||
              token.endsWith("-label"),
          );
          if (usesGold && !decorative) {
            issueAtLine(
              issues,
              "decorative-gold-body-text",
              file,
              sourceFile.getLineAndCharacterOfPosition(classAttribute.getStart()).line + 1,
              "Body copy must use a readable semantic text token; gold is decorative.",
            );
          }
        }
      }
    }
    ts.forEachChild(node, visitBodyCopy);
  };
  visitBodyCopy(sourceFile);
}

function countMap(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function isProjectRoot(root: string) {
  return existsSync(resolve(root, "src/routes/__root.tsx"));
}

type SourceImport = {
  specifier: string;
  line: number;
  defaultBinding?: string;
  sideEffect: boolean;
};

function scriptImports(source: string, file: string): SourceImport[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const imports: SourceImport[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        defaultBinding: node.importClause?.name?.text,
        sideEffect: !node.importClause,
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        sideEffect: false,
      });
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      imports.push({
        specifier: node.arguments[0].text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        sideEffect: true,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return imports;
}

function canonicalImport(root: string, importer: string, specifier: string) {
  const clean = specifier.replace(/[?#].*$/, "");
  let absolute: string;
  if (clean.startsWith("@/")) absolute = resolve(root, "src", clean.slice(2));
  else if (clean.startsWith(".")) absolute = resolve(root, dirname(importer), clean);
  else return undefined;
  const candidates = extname(absolute)
    ? [absolute]
    : [
        absolute,
        `${absolute}.css`,
        `${absolute}.ts`,
        `${absolute}.tsx`,
        resolve(absolute, "index.ts"),
      ];
  const resolved = candidates.find((candidate) => existsSync(candidate)) ?? absolute;
  return relative(root, resolved).replaceAll("\\", "/");
}

function cssUnescape(value: string) {
  return value
    .replace(/\\(?:\r\n|[\n\r\f])/g, "")
    .replace(
      /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([\s\S]))/gi,
      (_escape, hexadecimal: string | undefined, escaped: string | undefined) => {
        if (!hexadecimal) return escaped ?? "";
        const codePoint = Number.parseInt(hexadecimal, 16);
        return codePoint === 0 || codePoint > 0x10ffff ? "\uFFFD" : String.fromCodePoint(codePoint);
      },
    );
}

function cssImportSpecifier(params: string) {
  const decoded = cssUnescape(params);
  const quoted = decoded.match(/^\s*(["'])(.*?)\1/);
  if (quoted) return quoted[2];
  const url = decoded.match(/^\s*url\(\s*(?:(["'])(.*?)\1|([^\s)'";]+))\s*\)/i);
  const value = url?.[2] ?? url?.[3];
  return value || undefined;
}

function cssImportAtRuleParams(atRule: {
  name: string;
  params: string;
  raws?: { afterName?: string };
}) {
  if (cssUnescape(atRule.name).toLowerCase() === "import") return atRule.params;
  if (atRule.raws?.afterName) return undefined;
  const combined = `${atRule.name}${atRule.params}`;
  let index = 0;
  while (index < combined.length) {
    if (/[\w-]/.test(combined[index])) {
      index += 1;
      continue;
    }
    if (combined[index] !== "\\" || index + 1 >= combined.length) break;
    index += 1;
    const hexadecimal = combined.slice(index).match(/^[\da-f]{1,6}/i)?.[0];
    if (hexadecimal) {
      index += hexadecimal.length;
      if (combined.slice(index, index + 2) === "\r\n") index += 2;
      else if (/[\t\n\f\r ]/.test(combined[index] ?? "")) index += 1;
      continue;
    }
    if (combined.slice(index, index + 2) === "\r\n") index += 2;
    else index += 1;
  }
  return cssUnescape(combined.slice(0, index)).toLowerCase() === "import"
    ? combined.slice(index).trimStart()
    : undefined;
}

function routeLoadingIssues(root: string) {
  if (!isProjectRoot(root)) return [] as StyleContractIssue[];
  const issues: StyleContractIssue[] = [];
  const contracts = [
    { role: "base", owner: "src/routes/__root.tsx", target: BASE_STYLE, url: true },
    {
      role: "public",
      owner: "src/components/public/PublicShell.tsx",
      target: ROUTE_STYLES.public,
      url: false,
    },
    {
      role: "member",
      owner: "src/routes/_authenticated/member/route.tsx",
      target: ROUTE_STYLES.member,
      url: true,
    },
    {
      role: "admin",
      owner: "src/routes/_authenticated/admin/route.tsx",
      target: ROUTE_STYLES.admin,
      url: true,
    },
    {
      role: "instructor",
      owner: "src/routes/_authenticated/instructor/route.tsx",
      target: ROUTE_STYLES.instructor,
      url: true,
    },
  ] as const;
  const manifestPath = resolve(root, "tools/ui-audit/route-style-contract.json");
  let manifestValid = false;
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      compatibilityEntry?: { file?: string; onlyImport?: string };
      owners?: Record<string, string>;
      transitionContract?: string;
    };
    manifestValid =
      manifest.compatibilityEntry?.file === COMPATIBILITY_STYLE &&
      manifest.compatibilityEntry.onlyImport === "./styles/base.css" &&
      contracts.every((contract) => manifest.owners?.[contract.role] === contract.owner) &&
      /remain retained/i.test(manifest.transitionContract ?? "") &&
      /isolated/i.test(manifest.transitionContract ?? "");
  }
  if (!manifestValid) {
    issueAtLine(
      issues,
      "route-css-boundary",
      "tools/ui-audit/route-style-contract.json",
      1,
      "The checked-in ownership, compatibility, and retained-style isolation manifest is invalid.",
    );
  }

  const ownerByTarget = new Map(contracts.map((contract) => [contract.target, contract.owner]));
  for (const contract of contracts) {
    if (!existsSync(resolve(root, contract.owner))) {
      issueAtLine(
        issues,
        "route-css-boundary",
        contract.owner,
        1,
        "The stylesheet owner is missing.",
      );
      continue;
    }
    const source = read(root, contract.owner);
    const imports = scriptImports(source, contract.owner);
    const ownedImport = imports.find(
      (entry) => canonicalImport(root, contract.owner, entry.specifier) === contract.target,
    );
    const queryIsUrl = /(?:\?|&)url(?:&|$)/.test(ownedImport?.specifier ?? "");
    const loadingModeValid = contract.url
      ? Boolean(ownedImport?.defaultBinding) && queryIsUrl
      : Boolean(ownedImport?.sideEffect) && !queryIsUrl;
    const bindingReachesHead =
      !contract.url ||
      Boolean(
        ownedImport?.defaultBinding &&
        new RegExp(`href\\s*:\\s*${ownedImport.defaultBinding}\\b`).test(source),
      );
    if (!ownedImport || !loadingModeValid || !bindingReachesHead) {
      issueAtLine(
        issues,
        "route-css-boundary",
        contract.owner,
        ownedImport?.line ?? 1,
        `${contract.target} must be loaded by its owner using the declared SSR-safe route mode.`,
      );
    }
  }

  for (const file of listSourceFiles(root)) {
    if (/\.[jt]sx?$/.test(file)) {
      for (const currentImport of scriptImports(read(root, file), file)) {
        const target = canonicalImport(root, file, currentImport.specifier);
        const owner = target ? ownerByTarget.get(target) : undefined;
        if (owner && owner !== file && !(file === COMPATIBILITY_STYLE && target === BASE_STYLE)) {
          issueAtLine(
            issues,
            "route-css-boundary",
            file,
            currentImport.line,
            `${target} is route-owned by ${owner} and cannot be imported by ${file}.`,
          );
        }
      }
    } else if (file.endsWith(".css")) {
      const style = parseStyle(root, file);
      style?.root.walkAtRules((atRule) => {
        const importParams = cssImportAtRuleParams(atRule);
        if (importParams === undefined) return;
        const specifier = cssImportSpecifier(importParams);
        if (!specifier) return;
        const target = canonicalImport(root, file, specifier);
        const owner = target ? ownerByTarget.get(target) : undefined;
        if (owner && owner !== file && !(file === COMPATIBILITY_STYLE && target === BASE_STYLE)) {
          issueAtLine(
            issues,
            "route-css-boundary",
            file,
            parsedStyleLine(style, atRule),
            `${target} is route-owned by ${owner} and cannot be imported by ${file}.`,
          );
        }
      });
    }
  }
  return issues;
}

function scanRouteBoundarySources(root: string, issues: StyleContractIssue[]) {
  issues.push(...routeLoadingIssues(root));
}

export function checkStyleContract({ root }: StyleContractOptions): StyleContractIssue[] {
  const issues: StyleContractIssue[] = [];
  const allSourceFiles = listSourceFiles(root);
  const parsedStyles = allSourceFiles
    .filter((file) => file.endsWith(".css"))
    .map((file) => parseStyle(root, file))
    .filter((style): style is ParsedStyle => Boolean(style));

  for (const style of parsedStyles) scanCssColors(style, issues);
  for (const file of allSourceFiles.filter((file) => /\.[jt]sx?$/.test(file))) {
    scanTsSource(root, file, issues);
  }

  const baseline = countMap(loadImportantBaseline(root).signatures);
  for (const style of parsedStyles) scanCssDirectionAndImportant(style, baseline, issues);
  for (const [signature, remaining] of baseline) {
    for (let index = 0; index < remaining; index += 1) {
      issueAtLine(
        issues,
        "important-declaration",
        "tools/ui-audit/style-important-baseline.json",
        1,
        `The approved !important declaration is missing or changed: ${signature}.`,
      );
    }
  }

  const routeStyles = Object.values(ROUTE_STYLES)
    .map((file) => parseStyle(root, file))
    .filter((style): style is ParsedStyle => Boolean(style));
  scanDuplicateMedia(routeStyles, issues);

  const compatibility = parseStyle(root, COMPATIBILITY_STYLE);
  if (compatibility) scanCompatibility(compatibility, issues);
  scanRouteBoundarySources(root, issues);

  return issues.sort((a, b) =>
    a.file === b.file
      ? a.line - b.line || a.code.localeCompare(b.code)
      : a.file.localeCompare(b.file),
  );
}

export type CascadeBaseline = {
  version: 1 | 2;
  scenarios: CascadeScenario[];
  participantDigests?: Record<keyof typeof ROUTE_STYLES, CascadeParticipantDigest>;
  approvedLegacyDifferences?: Array<
    Omit<
      CascadeScenario,
      "direction" | "expectedValue" | "expectedImportant" | "expectedSpecificity"
    > & {
      direction: CascadeDirection | "both";
      currentValue: string;
      currentImportant: boolean;
      currentSpecificity: [number, number, number];
      reason: string;
    }
  >;
  legacyProvenance?: {
    commit: string;
    file: string;
    sourceSha256: string;
    resultSha256: string;
    relevantScenarioCount: number;
    identityAuthorityCommit?: string;
    identityAuthorityFile?: string;
    identityAuthoritySourceSha256?: string;
    identitySha256?: string;
  };
};

const CASCADE_IDENTITY_AUTHORITY = {
  legacyCommit: "0292a3a",
  legacyFile: "src/styles.css",
  commit: "4810a61",
  file: "tools/ui-audit/style-cascade-baseline.json",
  sourceSha256: "4db34d593b704fe3f6cd87a6061b45b0b003998105e62c1bd80a7118c08d73c5",
  identitySha256: "589eb1ed14d58d1e4c9ffae7a7152ec5e08031dc9034eba1491b5cdb34099192",
  scenarioCount: 302,
} as const;

export type CascadeDirection = "ltr" | "rtl";

export type CascadeScenario = {
  role: keyof typeof ROUTE_STYLES;
  direction: CascadeDirection;
  property: string;
  baseSelector: string;
  baseContext: string;
  routeSelector: string;
  routeContext: string;
  expectedValue: string;
  expectedImportant: boolean;
  expectedSpecificity: [number, number, number];
};

type CascadeDeclaration = {
  selector: string;
  direction: CascadeDirection;
  context: string;
  property: string;
  value: string;
  important: boolean;
  specificity: [number, number, number];
  order: number;
};

type CascadeParticipant = {
  role: keyof typeof ROUTE_STYLES;
  sheet: "base" | "route";
  selector: string;
  direction: CascadeDirection;
  context: string;
  property: string;
  value: string;
  important: boolean;
  specificity: [number, number, number];
  propertyOrder: number;
};

type CascadeParticipantDigest = {
  count: number;
  sha256: string;
};

const SHORTHAND_COMPONENTS: Record<string, string[]> = {
  background: [
    "background-color",
    "background-image",
    "background-position",
    "background-size",
    "background-repeat",
    "background-origin",
    "background-clip",
    "background-attachment",
  ],
  border: ["border-top", "border-right", "border-bottom", "border-left"],
  "border-color": [
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
  ],
  "border-style": [
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
  ],
  "border-width": [
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
  ],
  "border-radius": [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
  ],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  "padding-inline": ["padding-left", "padding-right"],
  "padding-block": ["padding-top", "padding-bottom"],
  "padding-inline-start": ["padding-left", "padding-right"],
  "padding-inline-end": ["padding-left", "padding-right"],
  "padding-block-start": ["padding-top"],
  "padding-block-end": ["padding-bottom"],
  "margin-inline": ["margin-left", "margin-right"],
  "margin-block": ["margin-top", "margin-bottom"],
  "margin-inline-start": ["margin-left", "margin-right"],
  "margin-inline-end": ["margin-left", "margin-right"],
  "margin-block-start": ["margin-top"],
  "margin-block-end": ["margin-bottom"],
  inset: ["top", "right", "bottom", "left"],
  "inset-inline": ["left", "right"],
  "inset-block": ["top", "bottom"],
  "inset-inline-start": ["left", "right"],
  "inset-inline-end": ["left", "right"],
  "inset-block-start": ["top"],
  "inset-block-end": ["bottom"],
  "border-inline": ["border-left", "border-right"],
  "border-block": ["border-top", "border-bottom"],
  "border-inline-width": ["border-left-width", "border-right-width"],
  "border-inline-style": ["border-left-style", "border-right-style"],
  "border-inline-color": ["border-left-color", "border-right-color"],
  "border-block-width": ["border-top-width", "border-bottom-width"],
  "border-block-style": ["border-top-style", "border-bottom-style"],
  "border-block-color": ["border-top-color", "border-bottom-color"],
  "border-inline-start": ["border-left", "border-right"],
  "border-inline-end": ["border-left", "border-right"],
  "border-block-start": ["border-top"],
  "border-block-end": ["border-bottom"],
  "border-inline-start-width": ["border-left-width", "border-right-width"],
  "border-inline-end-width": ["border-left-width", "border-right-width"],
  "border-inline-start-style": ["border-left-style", "border-right-style"],
  "border-inline-end-style": ["border-left-style", "border-right-style"],
  "border-inline-start-color": ["border-left-color", "border-right-color"],
  "border-inline-end-color": ["border-left-color", "border-right-color"],
  "border-block-start-width": ["border-top-width"],
  "border-block-end-width": ["border-bottom-width"],
  "border-block-start-style": ["border-top-style"],
  "border-block-end-style": ["border-bottom-style"],
  "border-block-start-color": ["border-top-color"],
  "border-block-end-color": ["border-bottom-color"],
  "border-start-start-radius": ["border-top-left-radius", "border-top-right-radius"],
  "border-start-end-radius": ["border-top-left-radius", "border-top-right-radius"],
  "border-end-start-radius": ["border-bottom-left-radius", "border-bottom-right-radius"],
  "border-end-end-radius": ["border-bottom-left-radius", "border-bottom-right-radius"],
  "inline-size": ["width"],
  "min-inline-size": ["min-width"],
  "max-inline-size": ["max-width"],
  "block-size": ["height"],
  "min-block-size": ["min-height"],
  "max-block-size": ["max-height"],
  gap: ["row-gap", "column-gap"],
  overflow: ["overflow-x", "overflow-y"],
  font: ["font-style", "font-variant", "font-weight", "font-size", "line-height", "font-family"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "place-content": ["align-content", "justify-content"],
  "place-items": ["align-items", "justify-items"],
  "place-self": ["align-self", "justify-self"],
  outline: ["outline-width", "outline-style", "outline-color"],
  "text-decoration": [
    "text-decoration-line",
    "text-decoration-color",
    "text-decoration-style",
    "text-decoration-thickness",
  ],
};

function affectedCascadeProperties(property: string) {
  const affected = new Set<string>();
  const pending = [property];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (affected.has(current)) continue;
    affected.add(current);
    pending.push(...(SHORTHAND_COMPONENTS[current] ?? []));
    const borderSide = current.match(/^border-(top|right|bottom|left)$/)?.[1];
    if (borderSide) {
      pending.push(
        `border-${borderSide}-width`,
        `border-${borderSide}-style`,
        `border-${borderSide}-color`,
      );
    }
  }
  return [...affected];
}

function splitCssComponents(value: string) {
  const components: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (/\s/.test(character) && depth === 0) {
      const component = value.slice(start, index).trim();
      if (component) components.push(component);
      start = index + 1;
    }
  }
  const component = value.slice(start).trim();
  if (component) components.push(component);
  return components;
}

function quadValues(value: string): [string, string, string, string] | undefined {
  const values = splitCssComponents(value);
  if (values.length === 1) return [values[0], values[0], values[0], values[0]];
  if (values.length === 2) return [values[0], values[1], values[0], values[1]];
  if (values.length === 3) return [values[0], values[1], values[2], values[1]];
  if (values.length === 4) return [values[0], values[1], values[2], values[3]];
  return undefined;
}

function pairValues(value: string): [string, string] | undefined {
  const values = splitCssComponents(value);
  if (values.length === 1) return [values[0], values[0]];
  if (values.length === 2) return [values[0], values[1]];
  return undefined;
}

function directionalPair(
  start: string,
  end: string,
  direction: CascadeDirection,
): [string, string] {
  return direction === "ltr" ? [start, end] : [end, start];
}

const BORDER_STYLE_VALUES = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

const CSS_WIDE_VALUES = new Set(["inherit", "initial", "revert", "revert-layer", "unset"]);

function cascadeAmbiguity(...values: string[]) {
  return `cc-ambiguous(${[...new Set(values)].sort().join(" | ")})`;
}

function borderComponents(value: string) {
  const tokens = splitCssComponents(value);
  if (tokens.length === 1 && CSS_WIDE_VALUES.has(tokens[0].toLowerCase())) {
    return { width: tokens[0], style: tokens[0], color: tokens[0] };
  }

  let width = "medium";
  let style = "none";
  let color = "currentcolor";
  let hasWidth = false;
  let hasStyle = false;
  let hasColor = false;
  const variableComponents: Array<{ token: string; index: number }> = [];
  for (const [index, token] of tokens.entries()) {
    const normalized = token.toLowerCase();
    if (BORDER_STYLE_VALUES.has(normalized)) {
      style = token;
      hasStyle = true;
      continue;
    }
    if (
      /^(?:thin|medium|thick)$/.test(normalized) ||
      /^(?:0|[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?))(?:[a-z]+|%)?$/i.test(token) ||
      /^(?:calc|min|max|clamp)\(/i.test(token)
    ) {
      width = token;
      hasWidth = true;
      continue;
    }
    if (/^(?:var|env)\(/i.test(token)) {
      variableComponents.push({ token, index });
      continue;
    }
    color = token;
    hasColor = true;
  }
  const assignVariable = (component: "width" | "style" | "color", token: string) => {
    if (component === "width") width = token;
    else if (component === "style") style = token;
    else color = token;
  };
  const missing = [
    ...(!hasWidth ? (["width"] as const) : []),
    ...(!hasStyle ? (["style"] as const) : []),
    ...(!hasColor ? (["color"] as const) : []),
  ];
  if (variableComponents.length === 1) {
    const variable = variableComponents[0];
    if (hasStyle && !hasWidth && !hasColor) {
      width = cascadeAmbiguity(width, variable.token);
      color = cascadeAmbiguity(color, variable.token);
    } else {
      const inferred = missing[0];
      if (inferred) assignVariable(inferred, variable.token);
    }
  } else if (variableComponents.length > 1) {
    variableComponents.slice(0, missing.length).forEach((variable, index) => {
      assignVariable(missing[index], variable.token);
    });
  }
  return { width, style, color };
}

function addCompositeBorderSide(
  expanded: Array<{ property: string; value: string }>,
  side: "top" | "right" | "bottom" | "left",
  value: string,
  components: ReturnType<typeof borderComponents>,
  includeComposite = true,
) {
  if (includeComposite) expanded.push({ property: `border-${side}`, value });
  expanded.push(
    { property: `border-${side}-width`, value: components.width },
    { property: `border-${side}-style`, value: components.style },
    { property: `border-${side}-color`, value: components.color },
  );
}

function expandedCascadeProperties(property: string, value: string, direction: CascadeDirection) {
  const expanded: Array<{ property: string; value: string }> = [{ property, value }];
  const physicalCompositeBorder = /^border(?:-(top|right|bottom|left))?$/.exec(property);
  if (physicalCompositeBorder) {
    const components = borderComponents(value);
    const side = physicalCompositeBorder[1] as "top" | "right" | "bottom" | "left" | undefined;
    if (side) {
      addCompositeBorderSide(expanded, side, value, components, false);
    } else {
      for (const physicalSide of ["top", "right", "bottom", "left"] as const) {
        addCompositeBorderSide(expanded, physicalSide, value, components);
      }
    }
    return expanded;
  }

  const logicalCompositeBorder = /^border-(inline|block)(?:-(start|end))?$/.exec(property);
  if (logicalCompositeBorder) {
    const [, axis, edge] = logicalCompositeBorder;
    const components = borderComponents(value);
    let sides: Array<"top" | "right" | "bottom" | "left">;
    if (axis === "block") {
      sides = edge === "start" ? ["top"] : edge === "end" ? ["bottom"] : ["top", "bottom"];
    } else if (edge === "start") {
      sides = [direction === "ltr" ? "left" : "right"];
    } else if (edge === "end") {
      sides = [direction === "ltr" ? "right" : "left"];
    } else {
      sides = ["left", "right"];
    }
    for (const side of sides) addCompositeBorderSide(expanded, side, value, components);
    return expanded;
  }

  const physical = /^(margin|padding|inset|border-(?:width|style|color))$/.exec(property);
  if (physical) {
    const values = quadValues(value);
    if (!values) return expanded;
    const [top, right, bottom, left] = values;
    if (property === "inset") {
      expanded.push(
        { property: "top", value: top },
        { property: "right", value: right },
        { property: "bottom", value: bottom },
        { property: "left", value: left },
      );
    } else if (property.startsWith("border-")) {
      const suffix = property.slice("border-".length);
      expanded.push(
        { property: `border-top-${suffix}`, value: top },
        { property: `border-right-${suffix}`, value: right },
        { property: `border-bottom-${suffix}`, value: bottom },
        { property: `border-left-${suffix}`, value: left },
      );
    } else {
      expanded.push(
        { property: `${property}-top`, value: top },
        { property: `${property}-right`, value: right },
        { property: `${property}-bottom`, value: bottom },
        { property: `${property}-left`, value: left },
      );
    }
    return expanded;
  }

  const logicalBox = /^(margin|padding|inset)-(inline|block)(?:-(start|end))?$/.exec(property);
  if (logicalBox) {
    const [, prefix, axis, edge] = logicalBox;
    const pair = pairValues(value);
    if (!pair) return expanded;
    if (axis === "block") {
      if (!edge || edge === "start")
        expanded.push({ property: prefix === "inset" ? "top" : `${prefix}-top`, value: pair[0] });
      if (!edge || edge === "end")
        expanded.push({
          property: prefix === "inset" ? "bottom" : `${prefix}-bottom`,
          value: edge ? pair[0] : pair[1],
        });
      return expanded;
    }
    const [left, right] = directionalPair(pair[0], pair[1], direction);
    if (!edge) {
      expanded.push(
        { property: prefix === "inset" ? "left" : `${prefix}-left`, value: left },
        { property: prefix === "inset" ? "right" : `${prefix}-right`, value: right },
      );
    } else {
      const physicalEdge =
        edge === "start"
          ? direction === "ltr"
            ? "left"
            : "right"
          : direction === "ltr"
            ? "right"
            : "left";
      expanded.push({
        property: prefix === "inset" ? physicalEdge : `${prefix}-${physicalEdge}`,
        value: pair[0],
      });
    }
    return expanded;
  }

  const logicalBorder = /^border-(inline|block)(?:-(start|end))?-(width|style|color)$/.exec(
    property,
  );
  if (logicalBorder) {
    const [, axis, edge, suffix] = logicalBorder;
    const pair = pairValues(value);
    if (!pair) return expanded;
    if (axis === "block") {
      if (!edge || edge === "start")
        expanded.push({ property: `border-top-${suffix}`, value: pair[0] });
      if (!edge || edge === "end")
        expanded.push({ property: `border-bottom-${suffix}`, value: edge ? pair[0] : pair[1] });
      return expanded;
    }
    const [left, right] = directionalPair(pair[0], pair[1], direction);
    if (!edge) {
      expanded.push(
        { property: `border-left-${suffix}`, value: left },
        { property: `border-right-${suffix}`, value: right },
      );
    } else {
      const physicalEdge =
        edge === "start"
          ? direction === "ltr"
            ? "left"
            : "right"
          : direction === "ltr"
            ? "right"
            : "left";
      expanded.push({ property: `border-${physicalEdge}-${suffix}`, value: pair[0] });
    }
    return expanded;
  }

  for (const affected of affectedCascadeProperties(property)) {
    if (affected !== property) expanded.push({ property: affected, value });
  }
  return expanded;
}

function splitSelectors(selectorList: string) {
  return selectorParser()
    .astSync(selectorList)
    .nodes.map((selector) => normalizeWhitespace(selector.toString()))
    .filter(Boolean);
}

function addSpecificity(
  left: [number, number, number],
  right: [number, number, number],
): [number, number, number] {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function maxSpecificity(values: Array<[number, number, number]>) {
  return values.reduce<[number, number, number]>(
    (maximum, value) => (compareSpecificity(maximum, value) < 0 ? value : maximum),
    [0, 0, 0],
  );
}

function selectorNodeSpecificity(node: SelectorNode): [number, number, number] {
  if (node.type === "id") return [1, 0, 0];
  if (node.type === "class" || node.type === "attribute") return [0, 1, 0];
  if (node.type === "tag") return [0, 0, 1];
  if (node.type === "nesting" || node.type === "comment" || node.type === "combinator") {
    return [0, 0, 0];
  }
  if (node.type === "pseudo") {
    const name = node.value.toLowerCase();
    if (
      name.startsWith("::") ||
      [":before", ":after", ":first-line", ":first-letter"].includes(name)
    ) {
      return [0, 0, 1];
    }
    if (name === ":where") return [0, 0, 0];
    const argumentSpecificity = maxSpecificity(
      (node.nodes ?? []).map((selector) => selectorSpecificity(selector.toString())),
    );
    if ([":is", ":not", ":has"].includes(name)) return argumentSpecificity;
    return addSpecificity([0, 1, 0], argumentSpecificity);
  }
  let total: [number, number, number] = [0, 0, 0];
  for (const child of node.nodes ?? [])
    total = addSpecificity(total, selectorNodeSpecificity(child));
  return total;
}

export function selectorSpecificity(selector: string): [number, number, number] {
  const root = selectorParser().astSync(selector);
  return maxSpecificity(root.nodes.map((node) => selectorNodeSpecificity(node)));
}

type SelectorFacts = {
  tags: Set<string>;
  ids: Set<string>;
  pseudoElements: Set<string>;
};

const selectorFactsCache = new Map<string, SelectorFacts>();
const selectorOverlapCache = new Map<string, boolean>();

function terminalSelectorFacts(selector: string): SelectorFacts {
  const cached = selectorFactsCache.get(selector);
  if (cached) return cached;
  const parsed = selectorParser().astSync(selector).nodes[0];
  const nodes = parsed?.nodes ?? [];
  const lastCombinator = nodes.reduce(
    (index, node, current) => (node.type === "combinator" ? current : index),
    -1,
  );
  const terminal = nodes.slice(lastCombinator + 1);
  const tags = new Set(
    terminal.filter((node) => node.type === "tag").map((node) => node.value.toLowerCase()),
  );
  const ids = new Set(terminal.filter((node) => node.type === "id").map((node) => node.value));
  const pseudoElements = new Set(
    terminal
      .filter(
        (node) =>
          node.type === "pseudo" &&
          (node.value.startsWith("::") ||
            [":before", ":after", ":first-line", ":first-letter"].includes(
              node.value.toLowerCase(),
            )),
      )
      .map((node) => node.value.toLowerCase().replace(/^:(?!:)/, "::")),
  );
  const facts = { tags, ids, pseudoElements };
  selectorFactsCache.set(selector, facts);
  return facts;
}

function selectorsMayMatchSameElement(left: string, right: string) {
  const cacheKey = left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
  const cached = selectorOverlapCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const leftFacts = terminalSelectorFacts(left);
  const rightFacts = terminalSelectorFacts(right);
  if (
    leftFacts.tags.size > 0 &&
    rightFacts.tags.size > 0 &&
    ![...leftFacts.tags].some((tag) => rightFacts.tags.has(tag))
  ) {
    selectorOverlapCache.set(cacheKey, false);
    return false;
  }
  // Classes and attributes are additive, so differently named constraints can still
  // coexist on one element. Only contradictory element names, ids, or pseudo-elements
  // are safe to exclude from the conservative cross-boundary comparison.
  if (
    leftFacts.ids.size > 0 &&
    rightFacts.ids.size > 0 &&
    ![...leftFacts.ids].some((id) => rightFacts.ids.has(id))
  ) {
    return false;
  }
  if (leftFacts.pseudoElements.size !== rightFacts.pseudoElements.size) {
    selectorOverlapCache.set(cacheKey, false);
    return false;
  }
  if (
    leftFacts.pseudoElements.size > 0 &&
    ![...leftFacts.pseudoElements].some((pseudo) => rightFacts.pseudoElements.has(pseudo))
  ) {
    selectorOverlapCache.set(cacheKey, false);
    return false;
  }
  selectorOverlapCache.set(cacheKey, true);
  return true;
}

function resolvedRuleSelectors(rule: Rule): string[] {
  const current = splitSelectors(rule.selector);
  if (rule.parent?.type !== "rule") return current;
  const parents = resolvedRuleSelectors(rule.parent);
  const parentList = parents.join(", ");
  return current.map((selector) =>
    normalizeWhitespace(
      selector.includes("&")
        ? selector.replaceAll("&", `:is(${parentList})`)
        : `:is(${parentList}) ${selector}`,
    ),
  );
}

function selectorDirections(selector: string): CascadeDirection[] {
  const rtl = /\[\s*dir\s*=\s*["']?rtl["']?\s*\]|:dir\(\s*rtl\s*\)/i.test(selector);
  const ltr = /\[\s*dir\s*=\s*["']?ltr["']?\s*\]|:dir\(\s*ltr\s*\)/i.test(selector);
  if (rtl && !ltr) return ["rtl"];
  if (ltr && !rtl) return ["ltr"];
  return ["ltr", "rtl"];
}

function cascadeDeclarations(source: string) {
  const root = parseCss(source);
  const declarations: CascadeDeclaration[] = [];
  let order = 0;
  root.walkDecls((declaration) => {
    if (declaration.parent?.type !== "rule") return;
    if (atRuleContext(declaration).includes("@keyframes ")) return;
    for (const selector of resolvedRuleSelectors(declaration.parent)) {
      for (const direction of selectorDirections(selector)) {
        for (const expanded of expandedCascadeProperties(
          declaration.prop.trim().toLowerCase(),
          normalizeWhitespace(declaration.value),
          direction,
        )) {
          declarations.push({
            selector,
            direction,
            context: atRuleContext(declaration),
            property: expanded.property,
            value: expanded.value,
            important: Boolean(declaration.important),
            specificity: selectorSpecificity(selector),
            order: order++,
          });
        }
      }
    }
  });
  return declarations;
}

export function cascadeDeclarationSnapshot(source: string) {
  return cascadeDeclarations(source);
}

function cascadePropertyKey(declaration: Pick<CascadeDeclaration, "direction" | "property">) {
  return `${declaration.direction}\u0000${declaration.property}`;
}

function cascadeDeclarationKey(
  declaration: Pick<CascadeDeclaration, "direction" | "property" | "selector" | "context">,
) {
  return [
    declaration.direction,
    declaration.property,
    declaration.selector,
    declaration.context,
  ].join("\u0000");
}

function indexCascadeDeclarations(
  declarations: CascadeDeclaration[],
  key: (declaration: CascadeDeclaration) => string,
) {
  const index = new Map<string, CascadeDeclaration[]>();
  for (const declaration of declarations) {
    const identity = key(declaration);
    const matches = index.get(identity) ?? [];
    matches.push(declaration);
    index.set(identity, matches);
  }
  return index;
}

export function reducedMotionOverrideAudit(source: string, scopeSelector: string) {
  const root = parseCss(source);
  const governed: CascadeDeclaration[] = [];
  const overrides: CascadeDeclaration[] = [];
  let order = 0;
  root.walkDecls((declaration) => {
    if (declaration.parent?.type !== "rule") return;
    const context = atRuleContext(declaration);
    const property = declaration.prop.trim().toLowerCase();
    const affected =
      property === "transition" || property === "transition-duration"
        ? ["transition-duration"]
        : property === "animation"
          ? ["animation-duration", "animation-iteration-count"]
          : property === "animation-duration" || property === "animation-iteration-count"
            ? [property]
            : [];
    if (affected.length === 0) return;
    for (const selector of resolvedRuleSelectors(declaration.parent)) {
      if (!selector.includes(scopeSelector)) continue;
      for (const targetProperty of affected) {
        const current = {
          selector,
          direction: "ltr" as const,
          context,
          property: targetProperty,
          value: normalizeWhitespace(declaration.value),
          important: Boolean(declaration.important),
          specificity: selectorSpecificity(selector),
          order: order++,
        };
        if (/prefers-reduced-motion\s*:\s*reduce/i.test(context)) overrides.push(current);
        else governed.push(current);
      }
    }
  });

  const expectedValues: Record<string, string> = {
    "transition-duration": "0.01ms",
    "animation-duration": "0.01ms",
    "animation-iteration-count": "1",
  };
  const failures: string[] = [];
  for (const declaration of governed) {
    const pseudoElements = terminalSelectorFacts(declaration.selector).pseudoElements;
    const pseudo = pseudoElements.size > 0 ? [...pseudoElements][0] : "";
    const requiredSelector = normalizeWhitespace(`${scopeSelector}${scopeSelector} *${pseudo}`);
    const candidates = overrides.filter(
      (candidate) =>
        candidate.property === declaration.property && candidate.selector === requiredSelector,
    );
    const actual = winner([declaration, ...candidates]);
    if (
      actual === declaration ||
      normalizeWhitespace(actual.value) !== expectedValues[declaration.property]
    ) {
      failures.push(
        `${declaration.selector} ${declaration.property} is not won by ${requiredSelector} in prefers-reduced-motion.`,
      );
    }
  }
  return { governedDeclarations: governed.length, failures };
}

function compareSpecificity(left: [number, number, number], right: [number, number, number]) {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function winner(declarations: CascadeDeclaration[]) {
  return declarations.reduce((current, candidate) => {
    if (current.important !== candidate.important) return candidate.important ? candidate : current;
    const specificity = compareSpecificity(current.specificity, candidate.specificity);
    if (specificity !== 0) return specificity < 0 ? candidate : current;
    return candidate.order > current.order ? candidate : current;
  });
}

function currentScenarioWinner(
  scenario: CascadeScenario,
  base: CascadeDeclaration[],
  route: CascadeDeclaration[],
) {
  const runtime = [
    ...base,
    ...route.map((declaration) => ({ ...declaration, order: declaration.order + base.length })),
  ];
  return scenarioWinner(runtime, scenario);
}

function scenarioWinner(
  declarations: CascadeDeclaration[],
  scenario: Pick<
    CascadeScenario,
    "direction" | "property" | "baseSelector" | "baseContext" | "routeSelector" | "routeContext"
  >,
) {
  const candidates = declarations.filter(
    (declaration) =>
      declaration.direction === scenario.direction &&
      declaration.property === scenario.property &&
      ((declaration.selector === scenario.baseSelector &&
        declaration.context === scenario.baseContext) ||
        (declaration.selector === scenario.routeSelector &&
          declaration.context === scenario.routeContext)),
  );
  return candidates.length > 0 ? winner(candidates) : undefined;
}

function loadCascadeBaseline(root: string): CascadeBaseline | undefined {
  const path = resolve(root, "tools/ui-audit/style-cascade-baseline.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as CascadeBaseline;
}

function mediaRange(context: string) {
  const ranges = { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY };
  for (const match of context.matchAll(/(?:min|max)-width\s*:\s*([\d.]+)(px|rem)/gi)) {
    const value = Number(match[1]) * (match[2].toLowerCase() === "rem" ? 16 : 1);
    if (match[0].toLowerCase().startsWith("min")) ranges.min = Math.max(ranges.min, value);
    else ranges.max = Math.min(ranges.max, value);
  }
  return ranges;
}

function contextsMayOverlap(left: string, right: string) {
  const leftRange = mediaRange(left);
  const rightRange = mediaRange(right);
  if (Math.max(leftRange.min, rightRange.min) > Math.min(leftRange.max, rightRange.max)) {
    return false;
  }
  for (const feature of ["prefers-color-scheme", "prefers-reduced-motion", "orientation"]) {
    const pattern = new RegExp(`${feature}\\s*:\\s*([\\w-]+)`, "i");
    const leftValue = left.match(pattern)?.[1];
    const rightValue = right.match(pattern)?.[1];
    if (leftValue && rightValue && leftValue.toLowerCase() !== rightValue.toLowerCase())
      return false;
  }
  return true;
}

function participantKey(participant: CascadeParticipant) {
  return [
    participant.role,
    participant.sheet,
    participant.direction,
    participant.property,
    participant.propertyOrder,
    participant.selector,
    participant.context,
    participant.value,
    participant.important,
    participant.specificity.join("-"),
  ].join("\u0000");
}

export function buildCascadeParticipantSnapshot({
  root,
}: StyleContractOptions): CascadeParticipant[] {
  const base = cascadeDeclarations(read(root, BASE_STYLE));
  const participants: CascadeParticipant[] = [];

  for (const [role, routeFile] of Object.entries(ROUTE_STYLES) as Array<
    [keyof typeof ROUTE_STYLES, string]
  >) {
    const route = cascadeDeclarations(read(root, routeFile));
    const routeByProperty = new Map<string, CascadeDeclaration[]>();
    for (const declaration of route) {
      const propertyKey = `${declaration.direction}\u0000${declaration.property}`;
      const declarations = routeByProperty.get(propertyKey) ?? [];
      declarations.push(declaration);
      routeByProperty.set(propertyKey, declarations);
    }
    const participatingBase = new Set<CascadeDeclaration>();
    const participatingRoute = new Set<CascadeDeclaration>();
    for (const baseDeclaration of base) {
      const propertyKey = `${baseDeclaration.direction}\u0000${baseDeclaration.property}`;
      const routeCandidates = routeByProperty.get(propertyKey) ?? [];
      if (
        routeCandidates.some(
          (routeDeclaration) =>
            contextsMayOverlap(baseDeclaration.context, routeDeclaration.context) &&
            selectorsMayMatchSameElement(baseDeclaration.selector, routeDeclaration.selector),
        )
      ) {
        participatingBase.add(baseDeclaration);
      }
    }
    const baseByProperty = indexCascadeDeclarations(base, cascadePropertyKey);
    for (const routeDeclaration of route) {
      if (
        (baseByProperty.get(cascadePropertyKey(routeDeclaration)) ?? []).some(
          (baseDeclaration) =>
            contextsMayOverlap(baseDeclaration.context, routeDeclaration.context) &&
            selectorsMayMatchSameElement(baseDeclaration.selector, routeDeclaration.selector),
        )
      ) {
        participatingRoute.add(routeDeclaration);
      }
    }

    for (const [sheet, declarations, selected] of [
      ["base", base, participatingBase],
      ["route", route, participatingRoute],
    ] as const) {
      const propertyOrders = new Map<string, number>();
      for (const declaration of declarations) {
        const propertyKey = `${declaration.direction}\u0000${declaration.property}`;
        const propertyOrder = propertyOrders.get(propertyKey) ?? 0;
        propertyOrders.set(propertyKey, propertyOrder + 1);
        if (!selected.has(declaration)) continue;
        participants.push({
          role,
          sheet,
          selector: declaration.selector,
          direction: declaration.direction,
          context: declaration.context,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important,
          specificity: declaration.specificity,
          propertyOrder,
        });
      }
    }
  }

  return participants.sort((left, right) =>
    participantKey(left).localeCompare(participantKey(right)),
  );
}

export function buildCascadeParticipantDigests({
  root,
}: StyleContractOptions): Record<keyof typeof ROUTE_STYLES, CascadeParticipantDigest> {
  const participants = buildCascadeParticipantSnapshot({ root });
  return Object.fromEntries(
    (Object.keys(ROUTE_STYLES) as Array<keyof typeof ROUTE_STYLES>).map((role) => {
      const roleParticipants = participants.filter((participant) => participant.role === role);
      return [
        role,
        {
          count: roleParticipants.length,
          sha256: createHash("sha256").update(JSON.stringify(roleParticipants)).digest("hex"),
        },
      ];
    }),
  ) as Record<keyof typeof ROUTE_STYLES, CascadeParticipantDigest>;
}

function scenarioKey(
  scenario: Omit<CascadeScenario, "expectedValue" | "expectedImportant" | "expectedSpecificity">,
) {
  return [
    scenario.role,
    scenario.direction,
    scenario.property,
    scenario.baseSelector,
    scenario.baseContext,
    scenario.routeSelector,
    scenario.routeContext,
  ].join("\u0000");
}

export function cascadeScenarioDigest(scenarios: CascadeScenario[]) {
  return createHash("sha256").update(JSON.stringify(scenarios)).digest("hex");
}

function cascadeScenarioIdentityDigest(scenarios: CascadeScenario[]) {
  const keys = scenarios.map((scenario) => scenarioKey(scenario)).sort();
  return {
    count: keys.length,
    uniqueCount: new Set(keys).size,
    sha256: createHash("sha256").update(JSON.stringify(keys)).digest("hex"),
  };
}

function canonicalCommitId(root: string, revision: string | undefined) {
  if (!revision || !/^[\da-f]{7,40}$/i.test(revision)) return undefined;
  try {
    const commit = execFileSync("git", ["rev-parse", "--verify", `${revision}^{commit}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    }).trim();
    return /^[\da-f]{40}$/i.test(commit) ? commit.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

function loadCascadeTokens(root: string) {
  const tokens = new Map<string, string>();
  for (const file of ["src/styles/tokens.css", BASE_STYLE]) {
    const style = parseStyle(root, file);
    style?.root.walkDecls((declaration) => {
      if (declaration.prop.startsWith("--") && !tokens.has(declaration.prop.trim())) {
        tokens.set(declaration.prop.trim(), normalizeWhitespace(declaration.value));
      }
    });
  }
  return tokens;
}

function resolvedTokenValue(
  token: string,
  tokens: Map<string, string>,
  resolving = new Set<string>(),
): string | undefined {
  if (resolving.has(token)) return undefined;
  const value = tokens.get(token);
  if (!value) return undefined;
  const nested = value.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (nested) {
    return (
      resolvedTokenValue(nested[1], tokens, new Set(resolving).add(token)) ??
      (nested[2] ? resolvedCssValue(nested[2], tokens, new Set(resolving).add(token)) : undefined)
    );
  }
  const normalized = normalizeWhitespace(value).toLowerCase();
  return /^#[\da-f]{3,8}$/.test(normalized) ? hexToRgba(normalized) : normalized;
}

function resolvedCssValue(
  value: string,
  tokens: Map<string, string>,
  resolving = new Set<string>(),
) {
  const normalized = normalizeWhitespace(value);
  const token = normalized.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (!token) {
    const plain = normalized.toLowerCase();
    return /^#[\da-f]{3,8}$/.test(plain) ? hexToRgba(plain) : plain;
  }
  return (
    resolvedTokenValue(token[1], tokens, resolving) ??
    (token[2] ? resolvedCssValue(token[2], tokens, resolving) : undefined)
  );
}

function normalizeLegacyFallbacks(value: string, tokens: Map<string, string>) {
  return normalizeWhitespace(value).replace(
    /var\(\s*(--[\w-]+)\s*,\s*(#[\da-f]{3,8}|var\(\s*--[\w-]+(?:\s*,\s*#[\da-f]{3,8})?\s*\))\s*\)/gi,
    (whole, token: string, fallback: string) => {
      const tokenValue = resolvedTokenValue(token, tokens);
      const fallbackValue = resolvedCssValue(fallback, tokens);
      return tokenValue && fallbackValue && tokenValue === fallbackValue ? `var(${token})` : whole;
    },
  );
}

function hexToRgba(value: string) {
  const hex = value.slice(1);
  const expanded =
    hex.length === 3 || hex.length === 4
      ? [...hex].map((character) => `${character}${character}`).join("")
      : hex;
  if (expanded.length !== 6 && expanded.length !== 8) return value.toLowerCase();
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return `rgba(${red},${green},${blue},${Number(alpha.toFixed(4))})`;
}

function canonicalCascadeValue(
  value: string,
  tokens: Map<string, string>,
  strictFallback: boolean,
) {
  let normalized = normalizeWhitespace(value);
  for (let pass = 0; pass < 12; pass += 1) {
    const replaced = normalized.replace(
      /var\(\s*(--[\w-]+)(?:\s*,\s*([^()]+))?\s*\)/gi,
      (whole, token: string, fallback: string | undefined) => {
        if (strictFallback && fallback) return whole;
        return resolvedTokenValue(token, tokens) ?? fallback?.trim() ?? whole;
      },
    );
    if (replaced === normalized) break;
    normalized = replaced;
  }
  normalized = normalized.replace(
    /color-mix\(\s*in\s+srgb\s*,\s*(#[\da-f]{3,8})\s+([\d.]+)%\s*,\s*transparent\s*\)/gi,
    (_whole, color: string, percentage: string) => {
      const rgba = hexToRgba(color).match(/^rgba\((\d+),(\d+),(\d+),[\d.]+\)$/);
      return rgba
        ? `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${Number((Number(percentage) / 100).toFixed(4))})`
        : _whole;
    },
  );
  normalized = normalized.replace(
    /color-mix\(\s*in\s+srgb\s*,\s*(rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*1\s*\)|white|black)\s+([\d.]+)%\s*,\s*transparent\s*\)/gi,
    (_whole, color: string, percentage: string) => {
      const rgba =
        color.toLowerCase() === "white"
          ? [255, 255, 255]
          : color.toLowerCase() === "black"
            ? [0, 0, 0]
            : color
                .match(/[\d.]+/g)
                ?.slice(0, 3)
                .map(Number);
      return rgba?.length === 3
        ? `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${Number((Number(percentage) / 100).toFixed(4))})`
        : _whole;
    },
  );
  normalized = normalized.replace(/#[\da-f]{3,8}\b/gi, (color) => hexToRgba(color));
  normalized = normalized.replace(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/gi,
    (_whole, red: string, green: string, blue: string, alpha: string | undefined) => {
      const parsedAlpha = alpha?.endsWith("%")
        ? Number(alpha.slice(0, -1)) / 100
        : Number(alpha ?? 1);
      return `rgba(${Number(red)},${Number(green)},${Number(blue)},${Number(
        parsedAlpha.toFixed(4),
      )})`;
    },
  );
  return normalizeWhitespace(normalized)
    .replace(/\s*([,:()])\s*/g, "$1")
    .toLowerCase();
}

export function buildCascadeBaseline({
  root,
  legacySource,
  legacyParticipantsOnly = false,
}: StyleContractOptions & {
  legacySource: string;
  legacyParticipantsOnly?: boolean;
}): CascadeBaseline {
  const legacy = cascadeDeclarations(legacySource);
  const base = cascadeDeclarations(read(root, BASE_STYLE));
  const legacyByDeclaration = indexCascadeDeclarations(legacy, cascadeDeclarationKey);
  const baseByDeclaration = indexCascadeDeclarations(base, cascadeDeclarationKey);
  const tokens = loadCascadeTokens(root);
  const scenarios: CascadeScenario[] = [];
  const seen = new Set<string>();

  for (const [role, routeFile] of Object.entries(ROUTE_STYLES) as Array<
    [keyof typeof ROUTE_STYLES, string]
  >) {
    const route = cascadeDeclarations(read(root, routeFile));
    const routeByProperty = indexCascadeDeclarations(route, cascadePropertyKey);
    const routeByDeclaration = indexCascadeDeclarations(route, cascadeDeclarationKey);
    for (const baseDeclaration of base) {
      const baseIdentity = cascadeDeclarationKey(baseDeclaration);
      const legacyBase = legacyByDeclaration.get(baseIdentity) ?? [];
      if (legacyParticipantsOnly && legacyBase.length === 0) continue;
      for (const routeDeclaration of routeByProperty.get(cascadePropertyKey(baseDeclaration)) ??
        []) {
        const routeIdentity = cascadeDeclarationKey(routeDeclaration);
        const legacyRoute = legacyByDeclaration.get(routeIdentity) ?? [];
        if (legacyParticipantsOnly && legacyRoute.length === 0) continue;
        if (!selectorsMayMatchSameElement(baseDeclaration.selector, routeDeclaration.selector))
          continue;
        if (!contextsMayOverlap(baseDeclaration.context, routeDeclaration.context)) continue;
        const identity = {
          role,
          direction: baseDeclaration.direction,
          property: baseDeclaration.property,
          baseSelector: baseDeclaration.selector,
          baseContext: baseDeclaration.context,
          routeSelector: routeDeclaration.selector,
          routeContext: routeDeclaration.context,
        };
        const key = scenarioKey(identity);
        if (seen.has(key)) continue;
        const hasBase = legacyBase.length > 0;
        const hasRoute = legacyRoute.length > 0;
        if (legacyParticipantsOnly && (!hasBase || !hasRoute)) continue;
        const currentExpected = winner([
          ...(baseByDeclaration.get(baseIdentity) ?? []),
          ...(routeByDeclaration.get(routeIdentity) ?? []).map((declaration) => ({
            ...declaration,
            order: declaration.order + base.length,
          })),
        ]);
        const legacyExpected =
          hasBase && hasRoute ? winner([...legacyBase, ...legacyRoute]) : undefined;
        const legacyValue = legacyExpected
          ? canonicalCascadeValue(
              normalizeLegacyFallbacks(legacyExpected.value, tokens),
              tokens,
              true,
            )
          : undefined;
        const currentValue = canonicalCascadeValue(currentExpected.value, tokens, false);
        const intendedEquivalentChange = legacyValue === currentValue;
        const expected =
          !legacyExpected || intendedEquivalentChange ? currentExpected : legacyExpected;
        seen.add(key);
        scenarios.push({
          ...identity,
          expectedValue: legacyExpected && !intendedEquivalentChange ? legacyValue! : currentValue,
          expectedImportant: expected.important,
          expectedSpecificity: expected.specificity,
        });
      }
    }
  }

  scenarios.sort((left, right) => scenarioKey(left).localeCompare(scenarioKey(right)));
  return { version: 1, scenarios };
}

export function buildLegacyWinnerScenarios({
  root,
  legacySource,
  identities,
}: StyleContractOptions & { legacySource: string; identities: CascadeScenario[] }) {
  const legacy = cascadeDeclarations(legacySource);
  const legacyByDeclaration = indexCascadeDeclarations(legacy, cascadeDeclarationKey);
  const tokens = loadCascadeTokens(root);
  return identities.flatMap((scenario) => {
    const {
      expectedValue: _expectedValue,
      expectedImportant: _expectedImportant,
      expectedSpecificity: _expectedSpecificity,
      ...identity
    } = scenario;
    const baseCandidates =
      legacyByDeclaration.get(
        cascadeDeclarationKey({
          direction: identity.direction,
          property: identity.property,
          selector: identity.baseSelector,
          context: identity.baseContext,
        }),
      ) ?? [];
    const routeCandidates =
      legacyByDeclaration.get(
        cascadeDeclarationKey({
          direction: identity.direction,
          property: identity.property,
          selector: identity.routeSelector,
          context: identity.routeContext,
        }),
      ) ?? [];
    if (baseCandidates.length === 0 || routeCandidates.length === 0) {
      throw new Error(
        `Legacy ${identity.role} winner is missing for ${identity.property}: ${identity.baseSelector} × ${identity.routeSelector}.`,
      );
    }
    const expected = winner([...baseCandidates, ...routeCandidates]);
    return [
      {
        ...identity,
        expectedValue: canonicalCascadeValue(
          normalizeLegacyFallbacks(expected.value, tokens),
          tokens,
          true,
        ),
        expectedImportant: expected.important,
        expectedSpecificity: expected.specificity,
      } satisfies CascadeScenario,
    ];
  });
}

export function checkCascadeBaseline({
  root,
  baseline,
}: StyleContractOptions & { baseline: CascadeBaseline }): StyleContractIssue[] {
  if (!isProjectRoot(root)) return [];
  const base = cascadeDeclarations(read(root, BASE_STYLE));
  const tokens = loadCascadeTokens(root);
  const issues: StyleContractIssue[] = [];
  for (const loadingIssue of routeLoadingIssues(root)) {
    issueAtLine(
      issues,
      "cascade-equivalence",
      loadingIssue.file,
      loadingIssue.line,
      `Runtime stylesheet order cannot be established: ${loadingIssue.message}`,
    );
  }
  const routeCache = new Map<keyof typeof ROUTE_STYLES, CascadeDeclaration[]>();
  if (baseline.participantDigests) {
    const actualDigests = buildCascadeParticipantDigests({ root });
    for (const role of Object.keys(ROUTE_STYLES) as Array<keyof typeof ROUTE_STYLES>) {
      const expected = baseline.participantDigests[role];
      const actual = actualDigests[role];
      if (expected.count === actual.count && expected.sha256 === actual.sha256) continue;
      issueAtLine(
        issues,
        "cascade-equivalence",
        ROUTE_STYLES[role],
        1,
        `Cross-boundary cascade participant snapshot changed; expected ${expected.count} declarations (${expected.sha256}) and received ${actual.count} (${actual.sha256}).`,
      );
    }
  }
  const baselineKeys = new Set(
    baseline.scenarios.map(
      ({
        expectedValue: _value,
        expectedImportant: _important,
        expectedSpecificity: _specificity,
        ...identity
      }) => scenarioKey(identity),
    ),
  );
  const usedLegacyDifferences = new Set<number>();
  const provenance = baseline.legacyProvenance;
  const authoritativeBaseline = existsSync(
    resolve(root, "tools/ui-audit/style-cascade-baseline.json"),
  );
  if (authoritativeBaseline && !provenance) {
    issueAtLine(
      issues,
      "cascade-equivalence",
      "tools/ui-audit/style-cascade-baseline.json",
      1,
      "The checked-in cascade baseline requires immutable legacy and identity provenance.",
    );
  }
  if (provenance) {
    let immutableLegacySource: string | undefined;
    try {
      if (!/^[\w./-]+$/.test(provenance.file) || provenance.file.split("/").includes("..")) {
        throw new Error("invalid legacy file path");
      }
      const legacyCommit = canonicalCommitId(root, provenance.commit);
      if (!legacyCommit) throw new Error("invalid commit identifier");
      immutableLegacySource = execFileSync("git", ["show", `${legacyCommit}:${provenance.file}`], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      issueAtLine(
        issues,
        "cascade-equivalence",
        "tools/ui-audit/style-cascade-baseline.json",
        1,
        "The immutable legacy stylesheet provenance cannot be read from git.",
      );
    }
    const actualScenarioDigest = cascadeScenarioDigest(baseline.scenarios);
    const immutableSourceDigest = immutableLegacySource
      ? createHash("sha256").update(immutableLegacySource).digest("hex")
      : undefined;
    let immutableScenarioDigest: string | undefined;
    if (immutableLegacySource && immutableSourceDigest === provenance.sourceSha256) {
      try {
        immutableScenarioDigest = cascadeScenarioDigest(
          buildLegacyWinnerScenarios({
            root,
            legacySource: immutableLegacySource,
            identities: baseline.scenarios,
          }),
        );
      } catch {
        // A changed identity that has no base/route participant in the immutable source is invalid.
      }
    }
    if (
      provenance.relevantScenarioCount !== baseline.scenarios.length ||
      provenance.resultSha256 !== actualScenarioDigest ||
      immutableSourceDigest !== provenance.sourceSha256 ||
      immutableScenarioDigest !== provenance.resultSha256
    ) {
      issueAtLine(
        issues,
        "cascade-equivalence",
        "tools/ui-audit/style-cascade-baseline.json",
        1,
        "The checked legacy-derived winners no longer match the immutable git source and provenance digests.",
      );
    }
  }
  if (authoritativeBaseline) {
    let authorityValid = false;
    try {
      const legacyCommit = canonicalCommitId(root, provenance?.commit);
      const expectedLegacyCommit = canonicalCommitId(root, CASCADE_IDENTITY_AUTHORITY.legacyCommit);
      const authorityCommit = canonicalCommitId(root, provenance?.identityAuthorityCommit);
      const expectedAuthorityCommit = canonicalCommitId(root, CASCADE_IDENTITY_AUTHORITY.commit);
      if (!expectedAuthorityCommit) throw new Error("missing identity authority commit");
      const authoritySource = execFileSync(
        "git",
        ["show", `${expectedAuthorityCommit}:${CASCADE_IDENTITY_AUTHORITY.file}`],
        { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      );
      const authorityBaseline = JSON.parse(authoritySource) as CascadeBaseline;
      const authorityIdentity = cascadeScenarioIdentityDigest(authorityBaseline.scenarios);
      const actualIdentity = cascadeScenarioIdentityDigest(baseline.scenarios);
      authorityValid =
        Boolean(provenance) &&
        legacyCommit === expectedLegacyCommit &&
        provenance?.file === CASCADE_IDENTITY_AUTHORITY.legacyFile &&
        authorityCommit === expectedAuthorityCommit &&
        createHash("sha256").update(authoritySource).digest("hex") ===
          CASCADE_IDENTITY_AUTHORITY.sourceSha256 &&
        authorityIdentity.count === CASCADE_IDENTITY_AUTHORITY.scenarioCount &&
        authorityIdentity.uniqueCount === CASCADE_IDENTITY_AUTHORITY.scenarioCount &&
        authorityIdentity.sha256 === CASCADE_IDENTITY_AUTHORITY.identitySha256 &&
        actualIdentity.count === CASCADE_IDENTITY_AUTHORITY.scenarioCount &&
        actualIdentity.uniqueCount === CASCADE_IDENTITY_AUTHORITY.scenarioCount &&
        actualIdentity.sha256 === CASCADE_IDENTITY_AUTHORITY.identitySha256 &&
        provenance?.identityAuthorityFile === CASCADE_IDENTITY_AUTHORITY.file &&
        provenance?.identityAuthoritySourceSha256 === CASCADE_IDENTITY_AUTHORITY.sourceSha256 &&
        provenance?.identitySha256 === CASCADE_IDENTITY_AUTHORITY.identitySha256;
    } catch {
      authorityValid = false;
    }
    if (!authorityValid) {
      issueAtLine(
        issues,
        "cascade-equivalence",
        "tools/ui-audit/style-cascade-baseline.json",
        1,
        "The complete cascade scenario identity set no longer matches its immutable authority.",
      );
    }
  }
  if (!baseline.participantDigests) {
    const currentKeys = new Set<string>();
    for (const [role, routeFile] of Object.entries(ROUTE_STYLES) as Array<
      [keyof typeof ROUTE_STYLES, string]
    >) {
      const route = cascadeDeclarations(read(root, routeFile));
      routeCache.set(role, route);
      for (const baseDeclaration of base) {
        for (const routeDeclaration of route) {
          if (baseDeclaration.direction !== routeDeclaration.direction) continue;
          if (baseDeclaration.property !== routeDeclaration.property) continue;
          if (!selectorsMayMatchSameElement(baseDeclaration.selector, routeDeclaration.selector))
            continue;
          if (!contextsMayOverlap(baseDeclaration.context, routeDeclaration.context)) continue;
          const identity = {
            role,
            direction: baseDeclaration.direction,
            property: baseDeclaration.property,
            baseSelector: baseDeclaration.selector,
            baseContext: baseDeclaration.context,
            routeSelector: routeDeclaration.selector,
            routeContext: routeDeclaration.context,
          };
          const key = scenarioKey(identity);
          if (currentKeys.has(key)) continue;
          currentKeys.add(key);
          if (!baselineKeys.has(key)) {
            issueAtLine(
              issues,
              "cascade-equivalence",
              routeFile,
              1,
              `${identity.property} creates an unbaselined cross-boundary cascade between ${identity.baseSelector} and ${identity.routeSelector}.`,
            );
          }
        }
      }
    }
  } else {
    for (const [role, routeFile] of Object.entries(ROUTE_STYLES) as Array<
      [keyof typeof ROUTE_STYLES, string]
    >) {
      routeCache.set(role, cascadeDeclarations(read(root, routeFile)));
    }
  }
  for (const scenario of baseline.scenarios) {
    let route = routeCache.get(scenario.role);
    if (!route) {
      route = cascadeDeclarations(read(root, ROUTE_STYLES[scenario.role]));
      routeCache.set(scenario.role, route);
    }
    const actual = currentScenarioWinner(scenario, base, route);
    const actualValue = actual ? canonicalCascadeValue(actual.value, tokens, false) : undefined;
    const expectedValue = canonicalCascadeValue(scenario.expectedValue, tokens, true);
    if (
      !actual ||
      actualValue !== expectedValue ||
      actual.important !== scenario.expectedImportant ||
      compareSpecificity(actual.specificity, scenario.expectedSpecificity) !== 0
    ) {
      const approvedDifferenceIndex = baseline.approvedLegacyDifferences?.findIndex(
        (difference) =>
          (difference.direction === "both" || difference.direction === scenario.direction) &&
          scenarioKey({ ...difference, direction: scenario.direction }) ===
            scenarioKey({
              role: scenario.role,
              direction: scenario.direction,
              property: scenario.property,
              baseSelector: scenario.baseSelector,
              baseContext: scenario.baseContext,
              routeSelector: scenario.routeSelector,
              routeContext: scenario.routeContext,
            }) &&
          actualValue === canonicalCascadeValue(difference.currentValue, tokens, false) &&
          actual?.important === difference.currentImportant &&
          compareSpecificity(actual?.specificity ?? [-1, -1, -1], difference.currentSpecificity) ===
            0 &&
          difference.reason.trim().length > 0,
      );
      if (approvedDifferenceIndex !== undefined && approvedDifferenceIndex >= 0) {
        usedLegacyDifferences.add(approvedDifferenceIndex);
        continue;
      }
      issueAtLine(
        issues,
        "cascade-equivalence",
        ROUTE_STYLES[scenario.role],
        1,
        `${scenario.property} ${scenario.direction.toUpperCase()} winner for ${scenario.baseSelector} × ${scenario.routeSelector} changed; expected ${expectedValue}${scenario.expectedImportant ? " !important" : ""} at ${scenario.expectedSpecificity.join("-")}, received ${actualValue ?? "<missing>"}${actual?.important ? " !important" : ""} at ${actual?.specificity.join("-") ?? "<missing>"}.`,
      );
    }
  }
  for (const [index, difference] of (baseline.approvedLegacyDifferences ?? []).entries()) {
    if (usedLegacyDifferences.has(index)) continue;
    issueAtLine(
      issues,
      "cascade-equivalence",
      "tools/ui-audit/style-cascade-baseline.json",
      1,
      `The approved legacy difference for ${difference.property}: ${difference.baseSelector} × ${difference.routeSelector} is missing, changed, duplicated, or no longer needed.`,
    );
  }
  return issues;
}

export function checkCascadeEquivalence({ root }: StyleContractOptions): StyleContractIssue[] {
  const baseline = loadCascadeBaseline(root);
  if (!baseline || (baseline.scenarios.length === 0 && !baseline.participantDigests)) {
    return isProjectRoot(root)
      ? [
          {
            code: "cascade-equivalence",
            file: "tools/ui-audit/style-cascade-baseline.json",
            line: 1,
            message: "A non-empty checked-in cascade-equivalence baseline is required.",
          },
        ]
      : [];
  }
  return checkCascadeBaseline({ root, baseline });
}

if (import.meta.main) {
  const root = resolve(process.argv[2] ?? process.cwd());
  const issues = [...checkStyleContract({ root }), ...checkCascadeEquivalence({ root })];
  for (const current of issues) {
    console.error(`${current.file}:${current.line} [${current.code}] ${current.message}`);
  }
  process.exitCode = issues.length === 0 ? 0 : 1;
}
