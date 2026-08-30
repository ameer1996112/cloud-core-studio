import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

export interface UnresolvedImport {
  importer: string;
  specifier: string;
}

export interface TypeScriptDependencyGraph {
  visitedFiles: string[];
  unresolvedImports: UnresolvedImport[];
  messageKeys: string[];
}

export function typescriptFilesUnder(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);
      return statSync(path).isDirectory()
        ? typescriptFilesUnder(path)
        : SOURCE_EXTENSIONS.includes(extname(path) as (typeof SOURCE_EXTENSIONS)[number])
          ? [path]
          : [];
    })
    .sort();
}

function localImportPath(importer: string, specifier: string, sourceRoot: string): string | null {
  if (specifier.startsWith("@/")) return resolve(sourceRoot, specifier.slice(2));
  if (specifier.startsWith(".")) return resolve(dirname(importer), specifier);
  return null;
}

function sourceCandidates(unresolved: string): string[] {
  // Literal-first is essential for names such as `admin.functions`: `.functions`
  // is part of the basename, not proof that the import already has a source extension.
  return [
    unresolved,
    ...SOURCE_EXTENSIONS.map((extension) => `${unresolved}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => resolve(unresolved, `index${extension}`)),
  ];
}

export function resolveLocalSourceImport(
  importer: string,
  specifier: string,
  sourceRoot: string,
): string | null {
  const cleanSpecifier = specifier.replace(/[?#].*$/, "");
  const unresolved = localImportPath(importer, cleanSpecifier, sourceRoot);
  if (!unresolved) return null;

  for (const candidate of sourceCandidates(unresolved)) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    if (SOURCE_EXTENSIONS.includes(extname(candidate) as (typeof SOURCE_EXTENSIONS)[number])) {
      return candidate;
    }
  }
  return null;
}

function isExistingNonSourceImport(
  importer: string,
  specifier: string,
  sourceRoot: string,
): boolean {
  const cleanSpecifier = specifier.replace(/[?#].*$/, "");
  const unresolved = localImportPath(importer, cleanSpecifier, sourceRoot);
  return Boolean(unresolved && existsSync(unresolved) && statSync(unresolved).isFile());
}

function scriptKindFor(file: string): ts.ScriptKind {
  switch (extname(file)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".js":
      return ts.ScriptKind.JS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function staticString(node: ts.Expression): string | null {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return null;
}

function staticTemplateValue(node: ts.TemplateExpression): string | null {
  let value = node.head.text;
  for (const span of node.templateSpans) {
    const expression = staticString(span.expression);
    if (expression === null) return null;
    value += expression + span.literal.text;
  }
  return value;
}

function importSpecifiersAndMessageKeys(
  file: string,
  knownMessageKeys: ReadonlySet<string>,
): { imports: Set<string>; messageKeys: Set<string> } {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const imports = new Set<string>();
  const messageKeys = new Set<string>();

  const addMessageValue = (value: string) => {
    if (knownMessageKeys.has(value)) messageKeys.add(value);
  };

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.add(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const specifier = staticString(node.arguments[0]);
      if (specifier !== null) imports.add(specifier);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length > 0
    ) {
      const specifier = staticString(node.arguments[0]);
      if (specifier !== null) imports.add(specifier);
    }

    if (ts.isStringLiteralLike(node)) addMessageValue(node.text);

    if (ts.isTemplateExpression(node)) {
      const exactValue = staticTemplateValue(node);
      if (exactValue !== null) {
        addMessageValue(exactValue);
      } else {
        const prefix = node.head.text;
        const suffix = node.templateSpans.at(-1)?.literal.text ?? "";
        if (`${prefix}${suffix}`.includes(".")) {
          for (const key of knownMessageKeys) {
            if (key.startsWith(prefix) && key.endsWith(suffix)) messageKeys.add(key);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  return { imports, messageKeys };
}

function isWithin(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}${sep}`);
}

export function buildTypeScriptDependencyGraph(options: {
  entrypoints: readonly string[];
  sourceRoot: string;
  messageKeys: ReadonlySet<string>;
  excludedRoots?: readonly string[];
}): TypeScriptDependencyGraph {
  const pending = [...options.entrypoints];
  const visited = new Set<string>();
  const messageKeys = new Set<string>();
  const unresolvedImports = new Map<string, UnresolvedImport>();
  const excludedRoots = options.excludedRoots ?? [];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (
      visited.has(file) ||
      !existsSync(file) ||
      excludedRoots.some((directory) => isWithin(file, directory))
    ) {
      continue;
    }
    visited.add(file);

    const dependencies = importSpecifiersAndMessageKeys(file, options.messageKeys);
    for (const key of dependencies.messageKeys) messageKeys.add(key);

    for (const specifier of dependencies.imports) {
      if (!(specifier.startsWith("@/") || specifier.startsWith("."))) continue;
      const dependency = resolveLocalSourceImport(file, specifier, options.sourceRoot);
      if (dependency) {
        if (!visited.has(dependency)) pending.push(dependency);
      } else if (!isExistingNonSourceImport(file, specifier, options.sourceRoot)) {
        const edge = { importer: file, specifier };
        unresolvedImports.set(`${file}\0${specifier}`, edge);
      }
    }
  }

  return {
    visitedFiles: [...visited].sort(),
    unresolvedImports: [...unresolvedImports.values()].sort(
      (left, right) =>
        left.importer.localeCompare(right.importer) ||
        left.specifier.localeCompare(right.specifier),
    ),
    messageKeys: [...messageKeys].sort(),
  };
}
