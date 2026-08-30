import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";
import { preview, type PreviewServer } from "vite";

import { assertEvidencePage } from "./capture";
import { auditScenarios } from "./fixtures";
import {
  task15AuthSubmitOutcomes,
  task15ScheduleDetailsOutcomes,
} from "./scenarios/visual-adapters";
import {
  VOICEOVER_JOURNEYS,
  expectedVoiceOverJourneyChecks,
  voiceOverJourneyCopy,
  voiceOverJourneyQuery,
} from "./voiceover-journeys";
import type { AuditLanguage, VisualAuditScenario } from "./types";
import { validateCurrentManifest } from "./validate-manifest";

export type CheckStatus = "pass" | "not-applicable" | "fail";
type CheckName =
  | "keyboard"
  | "activation"
  | "escape"
  | "focus"
  | "reflow200"
  | "reflow400"
  | "reducedMotion"
  | "forcedColors"
  | "latency";

type ActivationEvidence = {
  control: string;
  kind: "button" | "checkbox" | "link" | "field" | "other";
  status: CheckStatus;
  keys: string[];
  assertion?: string;
  notApplicableReason?: string;
};

type ScenarioLocaleResult = {
  scenarioId: string;
  language: AuditLanguage;
  keyboard: CheckStatus;
  activation: CheckStatus;
  escape: CheckStatus;
  focus: CheckStatus;
  reflow200: CheckStatus;
  reflow400: CheckStatus;
  reducedMotion: CheckStatus;
  forcedColors: CheckStatus;
  latency: CheckStatus;
  focusSurfaces: string[];
  notes: string[];
  notApplicableReasons: Partial<Record<CheckName, string>>;
  keyboardEvidence: { expectedOrder: string[]; observedOrder: string[] };
  activationEvidence: ActivationEvidence[];
  focusEvidence: { checked: number; total: number };
  reducedMotionEvidence: { elements: number; pseudos: number; failures: string[] };
  forcedColorsEvidence: {
    checked: number;
    total: number;
    focusables: number;
    controls: number;
    text: number;
    images: number;
    focusDeltas: number;
    failures: string[];
  };
};

type RepresentativeFlow = { status: CheckStatus; latencyMs: number; notes?: string[] };
type FocusSurface = "white" | "ivory" | "sand" | "navy" | "image";
type FocusSurfaceResult = {
  status: CheckStatus;
  contrastRatio: number | null;
  outlineWidth: number;
  source: string;
  backing?: string;
};

const requiredFocusSurfaces: readonly FocusSurface[] = ["white", "ivory", "sand", "navy", "image"];

export type InteractionEvidence = {
  scenarioLocales: ScenarioLocaleResult[];
  surfaceFocus: Partial<Record<FocusSurface, FocusSurfaceResult>>;
  representativeFlows: {
    dialog: RepresentativeFlow;
    scheduleFilter: RepresentativeFlow;
    tableFilter: RepresentativeFlow;
  };
  assistiveTechnologyFixtureSemantics: Array<{
    journey: (typeof VOICEOVER_JOURNEYS)[number];
    language: AuditLanguage;
    status: CheckStatus;
    target: string;
    checks: string[];
  }>;
};

const projectRoot = resolve(import.meta.dir, "../..");
const outputRoot = resolve(projectRoot, "artifacts/ui-audit/current");
const trackedEvidencePath = resolve(
  projectRoot,
  "docs/design/evidence/task-15-interaction-results.json",
);
const interactionSourceRoots = [
  "tools/ui-audit/main.tsx",
  "tools/ui-audit/interaction-checks.ts",
] as const;
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type ActivationAdapter =
  | "app-language"
  | "auth-submit"
  | "checkbox-toggle"
  | "editable-field"
  | "native-navigation"
  | "schedule-details"
  | "scroll-region";

export const visualScenarioActivationAdapters: Readonly<
  Record<string, readonly ActivationAdapter[]>
> = {
  "guest-app-default": ["native-navigation", "app-language", "scroll-region"],
  "guest-auth-default": ["editable-field", "auth-submit"],
  "guest-auth-mode-forgot-default": ["editable-field", "auth-submit"],
  "guest-auth-mode-signup-default": ["editable-field", "checkbox-toggle", "auth-submit"],
  "guest-auth-mode-signup-disabled": [],
  "guest-download-default": ["native-navigation"],
  "guest-instagram-default": ["native-navigation"],
  "guest-member-schedule-default": ["schedule-details"],
  "guest-member-schedule-empty": [],
  "guest-payment-result-status-failed-error": [],
  "guest-payment-result-status-success-success": [],
  "guest-privacy-default": ["native-navigation"],
  "guest-promo-yoga-lina-default": [],
  "guest-reset-password-error": ["native-navigation"],
  "guest-support-default": ["native-navigation"],
  "guest-terms-default": ["native-navigation"],
};

const exactLinkTargetByControl: Readonly<Record<string, string>> = Object.fromEntries(
  [
    [
      "local:/auth",
      [
        "a:Open the app",
        "a:פתיחת האפליקציה",
        "a:افتحي التطبيق",
        "a:Cloud & Core home",
        "a:Sign in or get account helpUse the account scree",
        "a:כניסה או עזרה בחשבוןמסך הכניסה מוביל להזמנות, חב",
        "a:تسجيل الدخول أو المساعدة بالحساباستخدموا شاشة ال",
      ],
    ],
    ["local:/auth?mode=forgot", ["a:Send a new link", "a:שליחת קישור חדש", "a:إرسال رابط جديد"]],
    ["local:/checkout", ["a:Checkout", "a:תשלום", "a:الدفع"]],
    [
      "local:/download?utm_campaign=organic_profile&utm_content=women&utm_medium=bio&utm_source=instagram",
      ["a:احجزي من التطبيقלהזמנה באפליקציה"],
    ],
    [
      "local:/member/schedule",
      [
        "a:Browse scheduleReturn to the public class schedu",
        "a:עיון בלוח השיעוריםחזרו ללוח השיעורים הציבורי והמ",
        "a:تصفحوا الجدولعودوا إلى جدول الحصص العام واستمروا",
      ],
    ],
    ["local:/privacy", ["a:Privacy", "a:פרטיות", "a:الخصوصية"]],
    ["local:/support", ["a:Support", "a:תמיכה", "a:الدعم"]],
    [
      "local:/terms",
      ["a:Terms", "a:Terms of Use", "a:תנאים", "a:תנאי שימוש", "a:الشروط", "a:شروط الاستخدام"],
    ],
    [
      "https://apps.apple.com/app/id6744870732",
      [
        "a:Download on the App Store",
        "a:הורדה מ־App Store",
        "a:حمّلي من App Store",
        "a:פתחי את עמוד Apple",
      ],
    ],
    ["itms-apps://apps.apple.com/app/id6744870732", ["a:פתיחת Cloud & Core ב-App Store"]],
    ["https://www.instagram.com/cloudandcorestudio/", ["a:Instagram"]],
    ["https://wa.me/972559398438?text=", ["a:WhatsApp"]],
    ["https://wa.me/972559398438", ["a:احجزي على WhatsAppלקביעת שיעור ניסיון"]],
    [
      "https://wa.me/message/S5HBZNKUMX45O1",
      [
        "a:WhatsApp Support055-939-8438 · Direct chat",
        "a:תמיכה בוואטסאפ055-939-8438 · צ'אט ישיר",
        "a:الدعم عبر الواتساب055-939-8438 · دردشة مباشرة",
      ],
    ],
    [
      "mailto:cloudandcorestudio@gmail.com",
      [
        "a:EMAIL",
        "a:cloudandcorestudio@gmail.com",
        "a:Email Supportcloudandcorestudio@gmail.com",
        "a:אימייל תמיכהcloudandcorestudio@gmail.com",
        "a:البريد الإلكتروني للدعمcloudandcorestudio@gmail.",
      ],
    ],
    ["tel:055-939-8438", ["a:055-939-8438"]],
  ].flatMap(([target, controls]) =>
    (controls as readonly string[]).map((control) => [control, target as string]),
  ),
);

function canonicalNavigationIntentTarget(assertion: string | undefined): string | null {
  const prefix = "native-navigation-intent:";
  if (!assertion?.startsWith(prefix)) return null;
  const target = assertion.slice(prefix.length);
  if (!target) return null;
  try {
    const url = new URL(target);
    if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
      return `local:${url.pathname}${url.search}${url.hash}`;
    if (!["https:", "mailto:", "tel:", "itms-apps:"].includes(url.protocol)) return null;
  } catch {
    return null;
  }
  return target;
}

function expectedLinkTarget(control: string, language: AuditLanguage): string | null {
  if (control === "a:Cloud & Core Studio") return `local:/app?lang=${language}`;
  return exactLinkTargetByControl[control] ?? null;
}

const forcedColorsControlScenarios = new Set([
  "guest-app-default",
  "guest-auth-default",
  "guest-auth-mode-forgot-default",
  "guest-auth-mode-signup-default",
  "guest-auth-mode-signup-disabled",
  "guest-download-default",
  "guest-instagram-default",
  "guest-member-schedule-default",
  "guest-privacy-default",
  "guest-reset-password-error",
  "guest-support-default",
  "guest-terms-default",
]);

const forcedColorsImageScenarios = new Set([
  "guest-app-default",
  "guest-download-default",
  "guest-instagram-default",
  "guest-member-schedule-default",
  "guest-reset-password-error",
]);

const localImportExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"];

function resolveLocalImport(root: string, importer: string, specifier: string): string | null {
  const absolute = specifier.startsWith("@/")
    ? resolve(root, "src", specifier.slice(2))
    : specifier.startsWith("/")
      ? resolve(root, "public", specifier.slice(1))
      : specifier.startsWith(".")
        ? resolve(dirname(resolve(root, importer)), specifier)
        : null;
  if (!absolute) return null;
  const candidates = extname(absolute)
    ? [absolute]
    : [
        ...localImportExtensions.map((extension) => `${absolute}${extension}`),
        ...localImportExtensions.map((extension) => resolve(absolute, `index${extension}`)),
      ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) return null;
  const normalized = relative(root, resolved).split(sep).join("/");
  return normalized.startsWith("../") ? null : normalized;
}

function localImportSpecifiers(source: string, filename: string): string[] {
  if (filename.endsWith(".css")) {
    const imports = [...source.matchAll(/@import\s+(?:url\()?\s*['"]?([^'"\s)]+)['"]?/g)].map(
      (match) => match[1],
    );
    const urls = [...source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map(
      (match) => match[1],
    );
    return [...new Set([...imports, ...urls])].filter(
      (specifier) =>
        !specifier.startsWith("data:") &&
        !specifier.startsWith("http:") &&
        !specifier.startsWith("https:") &&
        !specifier.startsWith("#"),
    );
  }
  if (filename.endsWith(".json")) return [];
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}

export function interactionSourceClosure(
  root = projectRoot,
  roots: readonly string[] = interactionSourceRoots,
): string[] {
  const pending = [...roots];
  const visited = new Set<string>();
  while (pending.length) {
    const filename = pending.pop()!;
    if (visited.has(filename)) continue;
    const absolute = resolve(root, filename);
    if (!existsSync(absolute))
      throw new Error(`Interaction source dependency is missing: ${filename}`);
    visited.add(filename);
    const source = readFileSync(absolute, "utf8");
    for (const specifier of localImportSpecifiers(source, filename)) {
      const dependency = resolveLocalImport(root, filename, specifier);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }
  return [...visited].sort();
}

export function interactionSourceSha256(root = projectRoot): string {
  const hash = createHash("sha256");
  for (const relativePath of interactionSourceClosure(root)) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const allowedCrossLocalePhrases = [
  "Cloud & Core Studio",
  "Cloud & Core",
  "Cloud and Core",
  "Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc.",
  "App Store",
  "Instagram",
  "WhatsApp",
  "Aerial Yoga Flow",
  "Aerial Yoga",
  "Aerial",
  "Pilates Sculpt",
  "HOT Pilates",
  "Pilates",
  "Sculpt",
  "Core Balance",
  "Core Room",
  "Cloud Room",
  "Strong",
  "Maya Cohen",
  "Lina Haddad",
  "Lina",
  "Noor Saleh",
  "Main Road",
  "Hurfeish",
  "Apple",
  "iPhone",
  "iOS",
  "Flow",
  "עברית",
  "العربية",
  "English",
] as const;

function normalizedLocaleString(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export type AccessibilityRelevantStringSnapshot = {
  visibleText: readonly string[];
  hiddenReferencedText: readonly string[];
  accessibleAttributes: readonly string[];
  formValues: readonly string[];
};

export function accessibilityRelevantStrings(
  snapshot: AccessibilityRelevantStringSnapshot,
): string[] {
  return [
    ...snapshot.visibleText,
    ...snapshot.hiddenReferencedText,
    ...snapshot.accessibleAttributes,
    ...snapshot.formValues,
  ]
    .map(normalizedLocaleString)
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index)
    .sort();
}

export function localeLeakageViolations(
  language: AuditLanguage,
  values: readonly string[],
): string[] {
  const failures = new Set<string>();
  for (const raw of values) {
    const normalized = normalizedLocaleString(raw);
    if (!normalized) continue;
    let inspected = normalized;
    for (const allowed of [...allowedCrossLocalePhrases].sort(
      (left, right) => right.length - left.length,
    ))
      inspected = inspected.replaceAll(allowed, " ");
    if (/^(?:https?:|mailto:|tel:|\S+@\S+|[\d\s()+.\-/:]+)$/i.test(inspected.trim())) continue;
    const wrongScript =
      language === "he"
        ? /\p{Script=Arabic}/u.test(inspected)
        : language === "ar"
          ? /\p{Script=Hebrew}/u.test(inspected)
          : /[\p{Script=Hebrew}\p{Script=Arabic}]/u.test(inspected);
    const unapprovedLatin = language !== "en" && /[A-Za-z]{2,}/.test(inspected);
    if (wrongScript || unapprovedLatin) failures.add(normalized);
  }
  return [...failures].sort();
}

export function interactionArtifactSha256(document: string): string {
  return createHash("sha256").update(document).digest("hex");
}

function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/,
  );
  if (!match) return null;
  if (match[4]) {
    const alpha = match[4].endsWith("%")
      ? Number.parseFloat(match[4]) / 100
      : Number.parseFloat(match[4]);
    if (alpha < 0.999) return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const foregroundRgb = parseRgb(foreground);
  const backgroundRgb = parseRgb(background);
  if (!foregroundRgb || !backgroundRgb) return null;
  const light = Math.max(luminance(foregroundRgb), luminance(backgroundRgb));
  const dark = Math.min(luminance(foregroundRgb), luminance(backgroundRgb));
  return (light + 0.05) / (dark + 0.05);
}

function compositeForcedColor(
  color: string,
  backdrop: readonly [number, number, number],
): { css: string; channels: [number, number, number] } | null {
  const match = color.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/,
  );
  if (!match) return null;
  const alpha = match[4]
    ? match[4].endsWith("%")
      ? Number.parseFloat(match[4]) / 100
      : Number.parseFloat(match[4])
    : 1;
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])].map((channel, index) =>
    Math.round(channel * alpha + backdrop[index] * (1 - alpha)),
  ) as [number, number, number];
  return { css: `rgb(${channels.join(", ")})`, channels };
}

type ForcedColorPaintLayer = {
  background: string;
  opacity: number;
};

type RgbaPixel = {
  channels: [number, number, number];
  alpha: number;
};

function forcedColorPixel(color: string): RgbaPixel | null {
  if (!color || color === "transparent") return { channels: [0, 0, 0], alpha: 0 };
  const match = color.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/,
  );
  if (!match) return null;
  const alpha = match[4]
    ? match[4].endsWith("%")
      ? Number.parseFloat(match[4]) / 100
      : Number.parseFloat(match[4])
    : 1;
  return {
    channels: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: Math.min(1, Math.max(0, alpha)),
  };
}

function compositePixel(source: RgbaPixel, backdrop: RgbaPixel): RgbaPixel {
  const alpha = source.alpha + backdrop.alpha * (1 - source.alpha);
  if (alpha === 0) return { channels: [0, 0, 0], alpha: 0 };
  return {
    channels: source.channels.map(
      (channel, index) =>
        (channel * source.alpha + backdrop.channels[index] * backdrop.alpha * (1 - source.alpha)) /
        alpha,
    ) as [number, number, number],
    alpha,
  };
}

function renderedForcedColorPixel(
  layers: readonly ForcedColorPaintLayer[],
  foreground?: string,
): string | null {
  let pixel = forcedColorPixel(foreground ?? "transparent");
  if (!pixel) return null;
  for (const layer of layers) {
    const background = forcedColorPixel(layer.background);
    if (!background) return null;
    pixel = compositePixel(pixel, background);
    pixel.alpha *= Math.min(1, Math.max(0, layer.opacity));
  }
  pixel = compositePixel(pixel, { channels: [255, 255, 255], alpha: 1 });
  return `rgb(${pixel.channels.map((channel) => Math.round(channel)).join(", ")})`;
}

export function renderedForcedColorBackground(layers: readonly string[]): string | null {
  let backdrop: [number, number, number] = [255, 255, 255];
  for (const layer of [...layers].reverse()) {
    if (!layer || layer === "transparent") continue;
    const composited = compositeForcedColor(layer, backdrop);
    if (!composited) return null;
    backdrop = composited.channels;
  }
  return `rgb(${backdrop.join(", ")})`;
}

export function forcedColorTargetIsDistinguishable(input: {
  text: boolean;
  control: boolean;
  accessibleOnly: boolean;
  anchor: boolean;
  disabled: boolean;
  color: string;
  background: string;
  borderColor: string;
  borderWidth: number;
  outlineColor: string;
  outlineStyle: string;
  outlineWidth: number;
  boxShadow: string;
  textDecorationLine: string;
  effectiveOpacity?: number;
  exteriorBackground?: string;
  focusable?: boolean;
  focused?: boolean;
  focusIndicatorColor?: string;
  focusIndicatorWidth?: number;
  backgroundLayers?: readonly string[];
  exteriorBackgroundLayers?: readonly string[];
  paintLayers?: readonly ForcedColorPaintLayer[];
  focusIndicators?: readonly {
    kind: "outline" | "shadow" | "border";
    color: string;
    width: number;
    changed: boolean;
    inset: boolean;
  }[];
}): boolean {
  const white = [255, 255, 255] as const;
  const exteriorPaintLayers = input.paintLayers?.slice(1);
  const exteriorCss = input.paintLayers
    ? (renderedForcedColorPixel(exteriorPaintLayers ?? []) ??
      input.exteriorBackground ??
      input.background)
    : (renderedForcedColorBackground(
        input.exteriorBackgroundLayers ?? [input.exteriorBackground ?? input.background],
      ) ??
      input.exteriorBackground ??
      input.background);
  const exterior = compositeForcedColor(exteriorCss, white);
  const exteriorChannels = exterior?.channels ?? white;
  const backgroundCss = input.paintLayers
    ? (renderedForcedColorPixel(input.paintLayers) ?? input.background)
    : (renderedForcedColorBackground(input.backgroundLayers ?? [input.background]) ??
      input.background);
  const background = compositeForcedColor(backgroundCss, white);
  const backgroundChannels = background?.channels ?? exteriorChannels;
  const color = input.paintLayers ? null : compositeForcedColor(input.color, backgroundChannels);
  const border = input.paintLayers
    ? null
    : compositeForcedColor(input.borderColor, exteriorChannels);
  const opacity = Math.min(1, Math.max(0, input.effectiveOpacity ?? 1));
  const renderAtOpacity = (
    channels: readonly [number, number, number] | undefined,
    fallback: string,
  ): string => {
    if (!channels) return fallback;
    const rendered = channels.map((channel, index) =>
      Math.round(channel * opacity + exteriorChannels[index] * (1 - opacity)),
    );
    return `rgb(${rendered.join(", ")})`;
  };
  const effectiveBackground = renderAtOpacity(
    background?.channels,
    background?.css ?? backgroundCss,
  );
  const effectiveColor = input.paintLayers
    ? (renderedForcedColorPixel(input.paintLayers, input.color) ?? input.color)
    : renderAtOpacity(color?.channels, color?.css ?? input.color);
  const effectiveBorder = input.paintLayers
    ? (renderedForcedColorPixel(input.paintLayers, input.borderColor) ?? input.borderColor)
    : renderAtOpacity(border?.channels, border?.css ?? input.borderColor);
  const textContrast = contrastRatio(effectiveColor, effectiveBackground);
  const borderContrast = contrastRatio(effectiveBorder, exteriorCss);
  const textDistinguishable =
    !input.text || input.accessibleOnly || (textContrast !== null && textContrast >= 4.5);
  const controlBoundaryDistinguishable =
    !input.control ||
    input.disabled ||
    input.anchor ||
    (input.borderWidth >= 1 && borderContrast !== null && borderContrast >= 3);
  const focusIndicatorDistinguishable =
    !input.focusable ||
    input.disabled ||
    (input.focused === true &&
      (input.focusIndicators ?? []).some((indicator) => {
        if (!indicator.changed || indicator.inset || indicator.width < 1) return false;
        const composited = input.paintLayers
          ? null
          : compositeForcedColor(indicator.color, exteriorChannels);
        const indicatorPaintLayers = input.paintLayers
          ? [{ ...input.paintLayers[0], background: "transparent" }, ...input.paintLayers.slice(1)]
          : undefined;
        const effectiveIndicator = indicatorPaintLayers
          ? (renderedForcedColorPixel(indicatorPaintLayers, indicator.color) ?? indicator.color)
          : renderAtOpacity(composited?.channels, composited?.css ?? indicator.color);
        const contrast = contrastRatio(effectiveIndicator, exteriorCss);
        return contrast !== null && contrast >= 3;
      }));
  return textDistinguishable && controlBoundaryDistinguishable && focusIndicatorDistinguishable;
}

export function forcedColorTargetCategories(input: {
  image: boolean;
  control: boolean;
  referenced: boolean;
  directText: boolean;
  textContent: string;
  formText: string;
}): { text: boolean } {
  return {
    text:
      !input.image &&
      (input.referenced ||
        input.directText ||
        (input.control && Boolean(input.textContent.trim() || input.formText.trim()))),
  };
}

export function hasHorizontalOverflow(input: {
  scrollWidth: number;
  clientWidth: number;
}): boolean {
  return input.scrollWidth - input.clientWidth > 1;
}

export function validateInteractionEvidence(evidence: InteractionEvidence): string[] {
  const errors: string[] = [];
  const expectedKeys = auditScenarios
    .filter((scenario) => scenario.kind === "visual" && scenario.riskTier === "A")
    .flatMap((scenario) => scenario.languages.map((language) => `${scenario.id}/${language}`))
    .sort();
  if (evidence.scenarioLocales.length !== expectedKeys.length)
    errors.push(
      `Expected ${expectedKeys.length} tier-A scenario/locale interaction records, found ${evidence.scenarioLocales.length}`,
    );
  const keys = evidence.scenarioLocales.map((row) => `${row.scenarioId}/${row.language}`);
  for (const duplicate of keys
    .filter((key, index) => keys.indexOf(key) !== index)
    .filter((key, index, all) => all.indexOf(key) === index))
    errors.push(`Duplicate interaction evidence: ${duplicate}`);
  for (const missing of expectedKeys.filter((key) => !keys.includes(key)))
    errors.push(`Missing interaction evidence: ${missing}`);
  for (const unexpected of keys.filter((key) => !expectedKeys.includes(key)))
    errors.push(`Unexpected interaction evidence: ${unexpected}`);
  for (const surface of requiredFocusSurfaces) {
    const result = evidence.surfaceFocus[surface];
    if (!result) {
      errors.push(`Missing focus-surface evidence: ${surface}`);
      continue;
    }
    if (result.status !== "pass") errors.push(`${surface} focus-surface check failed`);
    if (result.outlineWidth < 2)
      errors.push(`${surface} focus outline ${result.outlineWidth}px is below 2px`);
    if (result.contrastRatio === null || result.contrastRatio < 3)
      errors.push(`${surface} focus contrast is below 3:1`);
  }
  for (const row of evidence.scenarioLocales) {
    const key = `${row.scenarioId}/${row.language}`;
    const statuses: Record<CheckName, CheckStatus> = {
      keyboard: row.keyboard,
      activation: row.activation,
      escape: row.escape,
      focus: row.focus,
      reflow200: row.reflow200,
      reflow400: row.reflow400,
      reducedMotion: row.reducedMotion,
      forcedColors: row.forcedColors,
      latency: row.latency,
    };
    const strictVocabulary: Record<CheckName, readonly CheckStatus[]> = {
      keyboard: ["pass", "not-applicable", "fail"],
      activation: ["pass", "not-applicable", "fail"],
      escape: ["not-applicable"],
      focus: ["pass", "not-applicable", "fail"],
      reflow200: ["pass", "fail"],
      reflow400: ["pass", "fail"],
      reducedMotion: ["pass", "fail"],
      forcedColors: ["pass", "fail"],
      latency: ["not-applicable"],
    };
    const uniqueStatuses = new Set(Object.values(statuses));
    if (uniqueStatuses.size === 1) errors.push(`${key} uses an impossible blanket status`);
    for (const [check, status] of Object.entries(statuses) as [CheckName, CheckStatus][]) {
      if (!strictVocabulary[check].includes(status))
        errors.push(`${key} ${check} has invalid status ${status}`);
      if (status === "not-applicable" && !row.notApplicableReasons?.[check])
        errors.push(`${key} ${check} not-applicable lacks a typed reason`);
      if (status !== "not-applicable" && row.notApplicableReasons?.[check])
        errors.push(`${key} ${check} has an inapplicable not-applicable reason`);
      if (status === "fail") errors.push(`${key}: ${check} failed`);
    }
    const expectedOrder = row.keyboardEvidence?.expectedOrder ?? [];
    const observedOrder = row.keyboardEvidence?.observedOrder ?? [];
    const completeOrder =
      expectedOrder.length > 0 && JSON.stringify(expectedOrder) === JSON.stringify(observedOrder);
    const expectedKeyboardStatus: CheckStatus =
      expectedOrder.length === 0 ? "not-applicable" : completeOrder ? "pass" : "fail";
    if (row.keyboard !== expectedKeyboardStatus)
      errors.push(`${key} keyboard aggregate does not reconcile with focus-order evidence`);
    if (row.keyboard === "pass" && !completeOrder)
      errors.push(`${key} keyboard pass requires nonempty complete focus-order evidence`);
    const completeFocus =
      expectedOrder.length > 0 &&
      row.focusEvidence?.checked === expectedOrder.length &&
      row.focusEvidence?.total === expectedOrder.length;
    const expectedFocusStatus: CheckStatus =
      expectedOrder.length === 0 ? "not-applicable" : completeFocus ? "pass" : "fail";
    if (row.focus !== expectedFocusStatus)
      errors.push(`${key} focus aggregate does not reconcile with nested evidence`);
    if (row.activationEvidence?.length !== row.keyboardEvidence?.expectedOrder.length)
      errors.push(`${key} activation evidence does not cover every tabbable`);
    for (const activation of row.activationEvidence ?? []) {
      if (!["button", "checkbox", "link", "field", "other"].includes(activation.kind))
        errors.push(`${key} ${activation.control} activation has invalid kind ${activation.kind}`);
      if (!["pass", "not-applicable", "fail"].includes(activation.status))
        errors.push(
          `${key} ${activation.control} activation has invalid status ${activation.status}`,
        );
      if (activation.status === "not-applicable" && !activation.notApplicableReason)
        errors.push(`${key} ${activation.control} activation lacks a typed reason`);
      if (
        ["button", "checkbox"].includes(activation.kind) &&
        activation.status === "not-applicable"
      )
        errors.push(`${key} ${activation.control} actionable control cannot be not-applicable`);
      if (["button", "checkbox"].includes(activation.kind)) {
        if (JSON.stringify(activation.keys) !== JSON.stringify(["Enter", "Space"]))
          errors.push(`${key} ${activation.control} must verify Enter and Space`);
        const authMode = row.scenarioId.includes("mode-forgot")
          ? "forgot"
          : row.scenarioId.includes("mode-signup")
            ? "signup"
            : "signin";
        const appLanguage = activation.control.endsWith("עברית")
          ? "he"
          : activation.control.endsWith("العربية")
            ? "ar"
            : activation.control.endsWith("English")
              ? "en"
              : null;
        const expectedAssertion =
          activation.kind === "checkbox"
            ? "Enter:native-checkbox-no-toggle,Space:checked-toggle"
            : row.scenarioId.startsWith("guest-auth")
              ? (["Enter", "Space"] as const)
                  .map(
                    (pressed) =>
                      `${pressed}:auth-submit-live-status:${task15AuthSubmitOutcomes[row.language][authMode]}`,
                  )
                  .join(",")
              : row.scenarioId === "guest-member-schedule-default"
                ? (["Enter", "Space"] as const)
                    .map(
                      (pressed) =>
                        `${pressed}:schedule-details-state-opened:${task15ScheduleDetailsOutcomes[row.language]}`,
                    )
                    .join(",")
                : row.scenarioId === "guest-app-default" && appLanguage
                  ? (["Enter", "Space"] as const)
                      .map(
                        (pressed) =>
                          `${pressed}:app-language-state:${appLanguage}/${appLanguage === "en" ? "ltr" : "rtl"}`,
                      )
                      .join(",")
                  : null;
        if (!expectedAssertion || activation.assertion !== expectedAssertion)
          errors.push(
            `${key} ${activation.control} activation outcome contract does not match adapter`,
          );
      }
      if (
        activation.kind === "link" &&
        (activation.status !== "pass" ||
          JSON.stringify(activation.keys) !== JSON.stringify(["Enter"]))
      )
        errors.push(`${key} ${activation.control} link activation contract is incomplete`);
      if (activation.kind === "link") {
        const expectedTarget = expectedLinkTarget(activation.control, row.language);
        const recordedTarget = canonicalNavigationIntentTarget(activation.assertion);
        if (expectedTarget === null)
          errors.push(
            `${key} ${activation.control} link control is absent from exact target catalog`,
          );
        if (recordedTarget === null)
          errors.push(
            `${key} ${activation.control} link navigation assertion is missing or malformed`,
          );
        if (expectedTarget !== null && recordedTarget !== null && recordedTarget !== expectedTarget)
          errors.push(
            `${key} ${activation.control} link activation outcome does not match catalog`,
          );
      }
      if (
        activation.kind === "field" &&
        (activation.status !== "pass" ||
          JSON.stringify(activation.keys) !== JSON.stringify(["Typing"]) ||
          activation.assertion !== "editable-value-change")
      )
        errors.push(`${key} ${activation.control} editable-field contract is incomplete`);
      if (activation.status === "fail")
        errors.push(`${key} ${activation.control} activation failed`);
    }
    const nestedActivationStatuses = (row.activationEvidence ?? []).map((entry) => entry.status);
    const expectedActivationStatus: CheckStatus = nestedActivationStatuses.includes("fail")
      ? "fail"
      : nestedActivationStatuses.includes("pass")
        ? "pass"
        : "not-applicable";
    if (row.activation !== expectedActivationStatus)
      errors.push(`${key} activation aggregate does not reconcile with nested evidence`);
    const reducedMotionEvidence = row.reducedMotionEvidence;
    if (
      reducedMotionEvidence?.elements <= 0 ||
      reducedMotionEvidence?.pseudos !== reducedMotionEvidence?.elements * 2 ||
      !Array.isArray(reducedMotionEvidence?.failures)
    )
      errors.push(`${key} reduced-motion evidence did not inspect every element and pseudo`);
    else {
      const expectedReducedMotionStatus =
        reducedMotionEvidence.failures.length === 0 ? "pass" : "fail";
      if (row.reducedMotion !== expectedReducedMotionStatus)
        errors.push(`${key} reduced-motion aggregate does not reconcile with nested evidence`);
    }
    const forcedColorsEvidence = row.forcedColorsEvidence;
    if (row.keyboard === "pass" && (forcedColorsEvidence?.focusables ?? 0) <= 0)
      errors.push(`${key} forced-colors focusables category is empty`);
    if (
      !forcedColorsEvidence ||
      forcedColorsEvidence.focusDeltas !== forcedColorsEvidence.focusables
    )
      errors.push(`${key} forced-colors focus deltas are incomplete`);
    if (
      forcedColorsControlScenarios.has(row.scenarioId) &&
      (forcedColorsEvidence?.controls ?? 0) <= 0
    )
      errors.push(`${key} forced-colors controls category is empty`);
    if ((forcedColorsEvidence?.text ?? 0) <= 0)
      errors.push(`${key} forced-colors text category is empty`);
    if (forcedColorsImageScenarios.has(row.scenarioId) && (forcedColorsEvidence?.images ?? 0) <= 0)
      errors.push(`${key} forced-colors images category is empty`);
    if (
      row.forcedColors === "pass" &&
      (!forcedColorsEvidence ||
        forcedColorsEvidence.total <= 0 ||
        forcedColorsEvidence.checked !== forcedColorsEvidence.total ||
        forcedColorsEvidence.text <= 0 ||
        forcedColorsEvidence.focusables < 0 ||
        forcedColorsEvidence.controls < 0 ||
        forcedColorsEvidence.images < 0 ||
        forcedColorsEvidence.focusDeltas !== forcedColorsEvidence.focusables ||
        !Array.isArray(forcedColorsEvidence.failures) ||
        forcedColorsEvidence.failures.length > 0)
    )
      errors.push(`${key} forced-colors pass requires a complete nonempty target set`);
    if (
      forcedColorsEvidence &&
      Array.isArray(forcedColorsEvidence.failures) &&
      row.forcedColors !== (forcedColorsEvidence.failures.length === 0 ? "pass" : "fail")
    )
      errors.push(`${key} forced-colors aggregate does not reconcile with nested evidence`);
  }
  const representativeFlowNames = ["dialog", "scheduleFilter", "tableFilter"] as const;
  for (const name of representativeFlowNames) {
    const result = evidence.representativeFlows?.[name];
    if (!result) {
      errors.push(`Missing representative interaction: ${name}`);
      continue;
    }
    if (result.status !== "pass")
      errors.push(`${name} representative interaction has invalid status ${result.status}`);
    if (result.latencyMs >= 200)
      errors.push(`${name} interaction latency ${result.latencyMs}ms exceeds the 200ms budget`);
  }
  for (const extra of Object.keys(evidence.representativeFlows ?? {}).filter(
    (name) => !representativeFlowNames.includes(name as (typeof representativeFlowNames)[number]),
  ))
    errors.push(`Unexpected representative interaction: ${extra}`);
  const expectedAssistiveTechnologyKeys = VOICEOVER_JOURNEYS.flatMap((journey) =>
    (["he", "ar", "en"] as const).map((language) => `${journey}/${language}`),
  ).sort();
  const assistiveTechnologyRows = evidence.assistiveTechnologyFixtureSemantics ?? [];
  const assistiveTechnologyKeys = assistiveTechnologyRows.map(
    (row) => `${row.journey}/${row.language}`,
  );
  for (const duplicate of assistiveTechnologyKeys
    .filter((key, index) => assistiveTechnologyKeys.indexOf(key) !== index)
    .filter((key, index, all) => all.indexOf(key) === index))
    errors.push(`Duplicate assistive-technology fixture evidence: ${duplicate}`);
  for (const missing of expectedAssistiveTechnologyKeys.filter(
    (key) => !assistiveTechnologyKeys.includes(key),
  ))
    errors.push(`Missing assistive-technology fixture evidence: ${missing}`);
  for (const unexpected of assistiveTechnologyKeys.filter(
    (key) => !expectedAssistiveTechnologyKeys.includes(key),
  ))
    errors.push(`Unexpected assistive-technology fixture evidence: ${unexpected}`);
  for (const row of assistiveTechnologyRows) {
    if (row.status !== "pass")
      errors.push(`${row.journey}/${row.language} assistive-technology fixture failed`);
    const key = `${row.journey}/${row.language}`;
    if (!expectedAssistiveTechnologyKeys.includes(key)) continue;
    const expectedTarget = voiceOverJourneyQuery(row.journey, row.language);
    if (row.target !== expectedTarget)
      errors.push(
        `${row.journey}/${row.language} assistive-technology fixture target does not match catalog`,
      );
    const expectedChecks = expectedVoiceOverJourneyChecks(row.journey, row.language);
    if (JSON.stringify(row.checks) !== JSON.stringify(expectedChecks))
      errors.push(
        `${row.journey}/${row.language} assistive-technology fixture checks do not match catalog`,
      );
  }
  return errors;
}

async function launchBrowser(): Promise<Browser> {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    chromium.executablePath(),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const errors: string[] = [];
  for (const executablePath of [...new Set(candidates)]) {
    if (!existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ executablePath, headless: true, timeout: 15_000 });
    } catch (error) {
      errors.push(`${executablePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No usable Chromium executable for interaction checks. ${errors.join(" | ")}`);
}

async function startPreview(): Promise<{ server: PreviewServer; url: string }> {
  if (!existsSync(resolve(outputRoot, "index.html")))
    throw new Error("UI audit build is missing; run bun run ui-audit:build first");
  const server = await preview({
    configFile: resolve(import.meta.dir, "vite.config.ts"),
    mode: "ui-audit",
    logLevel: "error",
    preview: { host: "127.0.0.1", port: 4179, strictPort: false },
  });
  const url = server.resolvedUrls?.local[0];
  if (!url) {
    server.httpServer.close();
    throw new Error("Vite preview did not expose a loopback URL");
  }
  return { server, url: url.replace(/\/$/, "") };
}

async function navigateScenario(
  page: Page,
  url: string,
  scenario: VisualAuditScenario,
  language: AuditLanguage,
): Promise<void> {
  const query = new URLSearchParams({ scenario: scenario.id, language, evidence: "1" });
  await page.goto(`${url}/?${query}`, { waitUntil: "load", timeout: 15_000 });
  await assertEvidencePage(page, scenario, language);
}

async function checkHorizontalOverflow(page: Page, width: number): Promise<boolean> {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
  });
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth > 1;
  });
}

type RegisteredTabbable = { id: string; name: string; token: string };

async function registerTabbables(page: Page): Promise<RegisteredTabbable[]> {
  return page.evaluate((selector) => {
    const candidates = [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        !element.closest("[inert]") &&
        element.tabIndex >= 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    const ordered = candidates
      .map((element, domIndex) => ({ element, domIndex, tabIndex: element.tabIndex }))
      .sort((left, right) => {
        if (left.tabIndex > 0 || right.tabIndex > 0) {
          if (left.tabIndex === 0) return 1;
          if (right.tabIndex === 0) return -1;
          if (left.tabIndex !== right.tabIndex) return left.tabIndex - right.tabIndex;
        }
        return left.domIndex - right.domIndex;
      });
    return ordered.map(({ element }, index) => {
      const id = `task15-${index}`;
      element.dataset.task15FocusId = id;
      return {
        id,
        name: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 120) ?? "",
        token: `${element.tagName.toLowerCase()}:${element.id || element.getAttribute("name") || element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 48) || index}`,
      };
    });
  }, focusableSelector);
}

async function inspectKeyboardAndFocus(
  page: Page,
  url: string,
  scenario: VisualAuditScenario,
  language: AuditLanguage,
): Promise<{
  keyboard: CheckStatus;
  focus: CheckStatus;
  activation: CheckStatus;
  focusSurfaces: string[];
  notes: string[];
  notApplicableReasons: Partial<Record<CheckName, string>>;
  keyboardEvidence: ScenarioLocaleResult["keyboardEvidence"];
  activationEvidence: ActivationEvidence[];
  focusEvidence: ScenarioLocaleResult["focusEvidence"];
}> {
  const tabbables = await registerTabbables(page);
  const count = tabbables.length;
  if (count === 0)
    return {
      keyboard: "not-applicable",
      focus: "not-applicable",
      activation: "not-applicable",
      focusSurfaces: [],
      notes: ["Presentation has no enabled interactive control."],
      notApplicableReasons: {
        keyboard: "no-enabled-tabbable-controls",
        activation: "no-enabled-tabbable-controls",
        focus: "no-enabled-tabbable-controls",
      },
      keyboardEvidence: { expectedOrder: [], observedOrder: [] },
      activationEvidence: [],
      focusEvidence: { checked: 0, total: 0 },
    };

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const focusSurfaces = new Set<string>();
  const focusFailures: string[] = [];
  const observedOrder: string[] = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press("Tab");
    const details = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      let surface: HTMLElement | null =
        Number.parseFloat(style.outlineOffset) > 0 ? element.parentElement : element;
      let background = "rgb(255, 255, 255)";
      let kind = "white";
      while (surface) {
        const surfaceStyle = getComputedStyle(surface);
        if (surface.matches("img") || surfaceStyle.backgroundImage !== "none") kind = "image";
        const color = surfaceStyle.backgroundColor;
        if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
          background = color;
          const rgb =
            color
              .match(/\d+(?:\.\d+)?/g)
              ?.slice(0, 3)
              .map(Number) ?? [];
          if (kind !== "image" && rgb.length === 3) {
            const sum = rgb[0] + rgb[1] + rgb[2];
            kind = sum < 240 ? "navy" : sum < 650 ? "sand" : sum < 745 ? "ivory" : "white";
          }
          break;
        }
        surface = surface.parentElement;
      }
      return {
        id: element.dataset.task15FocusId ?? "unregistered-focus-target",
        key: `${element.tagName}:${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? ""}`,
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        background,
        kind,
      };
    });
    if (!details) {
      focusFailures.push(`Tab ${index + 1} did not focus a control`);
      continue;
    }
    observedOrder.push(details.id);
    focusSurfaces.add(details.kind);
    const ratio = contrastRatio(details.outlineColor, details.background);
    if (
      details.outlineStyle === "none" ||
      details.outlineWidth < 2 ||
      (ratio !== null && ratio < 3)
    ) {
      focusFailures.push(`${details.key} has an insufficient visible focus indicator`);
    }
  }
  const expectedOrder = tabbables.map((entry) => entry.id);
  const activationEvidence: ActivationEvidence[] = [];
  const installNavigationCapture = () =>
    page.evaluate(() => {
      (window as Window & { __task15NavigationIntent?: string }).__task15NavigationIntent = "";
      document.addEventListener(
        "click",
        (event) => {
          const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
          if (!(anchor instanceof HTMLAnchorElement)) return;
          event.preventDefault();
          (window as Window & { __task15NavigationIntent?: string }).__task15NavigationIntent =
            anchor.href;
        },
        { capture: true },
      );
    });

  const resetControl = async (entry: RegisteredTabbable) => {
    await navigateScenario(page, url, scenario, language);
    await registerTabbables(page);
    await installNavigationCapture();
    return page.locator(`[data-task15-focus-id="${entry.id}"]`);
  };

  const expectedAdapters = visualScenarioActivationAdapters[scenario.id];
  if (!expectedAdapters) throw new Error(`No activation-adapter catalog exists for ${scenario.id}`);

  for (const entry of [...tabbables].reverse()) {
    let control = await resetControl(entry);
    if ((await control.count()) === 0) {
      activationEvidence.push({ control: entry.token, kind: "other", status: "fail", keys: [] });
      continue;
    }
    const metadata = await control.evaluate((element) => ({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role"),
      href: element instanceof HTMLAnchorElement ? element.href : null,
      fieldType: element instanceof HTMLInputElement ? element.type : null,
    }));
    if (metadata.tag === "a" && metadata.href) {
      if (!expectedAdapters.includes("native-navigation")) {
        activationEvidence.push({ control: entry.token, kind: "link", status: "fail", keys: [] });
        continue;
      }
      await control.focus();
      await page.evaluate(() => {
        (window as Window & { __task15NavigationIntent?: string }).__task15NavigationIntent = "";
      });
      await page.keyboard.press("Enter");
      const intent = await page.evaluate(
        () => (window as Window & { __task15NavigationIntent?: string }).__task15NavigationIntent,
      );
      activationEvidence.push({
        control: entry.token,
        kind: "link",
        status: intent === metadata.href ? "pass" : "fail",
        keys: ["Enter"],
        assertion: `native-navigation-intent:${metadata.href}`,
      });
      continue;
    }
    if (metadata.tag === "input" && metadata.fieldType === "checkbox") {
      if (!expectedAdapters.includes("checkbox-toggle")) {
        activationEvidence.push({
          control: entry.token,
          kind: "checkbox",
          status: "fail",
          keys: [],
        });
        continue;
      }
      const assertions: string[] = [];
      let failed = false;
      for (const key of ["Enter", "Space"] as const) {
        control = await resetControl(entry);
        await control.focus();
        const before = await control.isChecked();
        await page.keyboard.press(key);
        const after = await control.isChecked();
        const correct = key === "Enter" ? after === before : after !== before;
        assertions.push(
          key === "Enter" ? "Enter:native-checkbox-no-toggle" : "Space:checked-toggle",
        );
        if (!correct) failed = true;
      }
      activationEvidence.push({
        control: entry.token,
        kind: "checkbox",
        status: failed ? "fail" : "pass",
        keys: ["Enter", "Space"],
        assertion: assertions.join(","),
      });
      continue;
    }
    if (["input", "select", "textarea"].includes(metadata.tag)) {
      if (!expectedAdapters.includes("editable-field")) {
        activationEvidence.push({ control: entry.token, kind: "field", status: "fail", keys: [] });
        continue;
      }
      const before = await control.inputValue();
      const value =
        metadata.fieldType === "email"
          ? "task15@example.test"
          : metadata.fieldType === "password"
            ? "task15-password"
            : "Task 15 edited value";
      await control.fill(value);
      const after = await control.inputValue();
      activationEvidence.push({
        control: entry.token,
        kind: "field",
        status: before !== after && after === value ? "pass" : "fail",
        keys: ["Typing"],
        assertion: "editable-value-change",
      });
      continue;
    }
    if (metadata.tag === "button" || metadata.role === "button" || metadata.role === "tab") {
      const adapter: ActivationAdapter | null = scenario.id.startsWith("guest-auth")
        ? "auth-submit"
        : scenario.id === "guest-member-schedule-default"
          ? "schedule-details"
          : scenario.id === "guest-app-default"
            ? "app-language"
            : null;
      if (!adapter || !expectedAdapters.includes(adapter)) {
        activationEvidence.push({
          control: entry.token,
          kind: "button",
          status: "fail",
          keys: [],
        });
        continue;
      }
      const assertions: string[] = [];
      let failed = false;
      for (const key of ["Enter", "Space"] as const) {
        control = await resetControl(entry);
        await control.focus();
        if (adapter === "auth-submit") {
          const status = page.locator("[data-task15-auth-status]");
          if ((await status.innerText()) !== "") failed = true;
          await page.keyboard.press(key);
          await status.filter({ hasText: /\S/ }).waitFor();
          const observed = (await status.innerText()).trim();
          if (observed === "") failed = true;
          assertions.push(`${key}:auth-submit-live-status:${observed}`);
        } else if (adapter === "schedule-details") {
          const status = page.locator("[data-task15-schedule-details]");
          if ((await status.innerText()) !== "") failed = true;
          await page.keyboard.press(key);
          await status.filter({ hasText: /\S/ }).waitFor();
          const observed = (await status.innerText()).trim();
          if (observed === "") failed = true;
          assertions.push(`${key}:schedule-details-state-opened:${observed}`);
        } else {
          const targetLanguage =
            entry.name === "עברית" ? "he" : entry.name === "العربية" ? "ar" : "en";
          await page.evaluate(() => window.localStorage.removeItem("cc_lang"));
          await page.keyboard.press(key);
          const state = await page.evaluate(() => ({
            stored: window.localStorage.getItem("cc_lang"),
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
          }));
          const expectedDirection = targetLanguage === "en" ? "ltr" : "rtl";
          if (
            state.stored !== targetLanguage ||
            state.lang !== targetLanguage ||
            state.dir !== expectedDirection
          )
            failed = true;
          assertions.push(`${key}:app-language-state:${targetLanguage}/${expectedDirection}`);
        }
      }
      activationEvidence.push({
        control: entry.token,
        kind: "button",
        status: failed ? "fail" : "pass",
        keys: ["Enter", "Space"],
        assertion: assertions.join(","),
      });
      continue;
    }
    if (
      scenario.id === "guest-app-default" &&
      metadata.role === "region" &&
      expectedAdapters.includes("scroll-region")
    ) {
      activationEvidence.push({
        control: entry.token,
        kind: "other",
        status: "not-applicable",
        keys: [],
        notApplicableReason: "scroll-region-uses-arrow-and-scroll-navigation-not-activation",
      });
      continue;
    }
    activationEvidence.push({
      control: entry.token,
      kind: "other",
      status: "fail",
      keys: [],
    });
  }

  const activationFailures = activationEvidence.filter((entry) => entry.status === "fail");
  const activationPasses = activationEvidence.filter((entry) => entry.status === "pass");
  const activation = activationFailures.length
    ? "fail"
    : activationPasses.length
      ? "pass"
      : "not-applicable";
  const notApplicableReasons: Partial<Record<CheckName, string>> = {};
  if (activation === "not-applicable")
    notApplicableReasons.activation = "all-tabbables-have-typed-non-activation-contracts";

  return {
    keyboard: JSON.stringify(observedOrder) === JSON.stringify(expectedOrder) ? "pass" : "fail",
    focus: focusFailures.length === 0 ? "pass" : "fail",
    activation,
    focusSurfaces: [...focusSurfaces].sort(),
    notes: focusFailures,
    notApplicableReasons,
    keyboardEvidence: { expectedOrder, observedOrder },
    activationEvidence,
    focusEvidence: { checked: observedOrder.length, total: expectedOrder.length },
  };
}

async function reducedMotionStatus(
  page: Page,
): Promise<{ status: CheckStatus; evidence: ScenarioLocaleResult["reducedMotionEvidence"] }> {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
  const result = await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>("*")];
    const failures: string[] = [];
    const inspect = (element: HTMLElement, pseudo: string | null) => {
      const style = getComputedStyle(element, pseudo);
      const durations = (value: string) =>
        value.split(",").map((part) => {
          const numeric = Number.parseFloat(part) || 0;
          return part.trim().endsWith("ms") ? numeric / 1_000 : numeric;
        });
      const animationDuration = Math.max(0, ...durations(style.animationDuration));
      const transitionDuration = Math.max(0, ...durations(style.transitionDuration));
      const iterationCount = Math.max(
        0,
        ...style.animationIterationCount
          .split(",")
          .map((value) => (value.trim() === "infinite" ? Infinity : Number.parseFloat(value) || 0)),
      );
      if (style.animationName !== "none" && (animationDuration > 0.011 || iterationCount > 1))
        failures.push(`${element.tagName}${pseudo ?? ""}:animation`);
      if (style.transitionProperty !== "none" && transitionDuration > 0.011)
        failures.push(`${element.tagName}${pseudo ?? ""}:transition`);
      if (style.scrollBehavior === "smooth")
        failures.push(`${element.tagName}${pseudo ?? ""}:smooth-scroll`);
    };
    for (const element of elements) {
      inspect(element, null);
      inspect(element, "::before");
      inspect(element, "::after");
    }
    return { failures, elements: elements.length, pseudos: elements.length * 2 };
  });
  return {
    status: result.failures.length === 0 ? "pass" : "fail",
    evidence: { elements: result.elements, pseudos: result.pseudos, failures: result.failures },
  };
}

async function forcedColorsStatus(
  page: Page,
): Promise<{ status: CheckStatus; evidence: ScenarioLocaleResult["forcedColorsEvidence"] }> {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  const active = await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches);
  if (!active)
    return {
      status: "fail",
      evidence: {
        checked: 0,
        total: 0,
        focusables: 0,
        controls: 0,
        text: 0,
        images: 0,
        focusDeltas: 0,
        failures: ["forced-colors-media-query-inactive"],
      },
    };
  const targets = await page.evaluate((selector) => {
    const referencedIds = new Set(
      [...document.querySelectorAll<HTMLElement>("[aria-labelledby], [aria-describedby]")]
        .flatMap((element) => [
          ...(element.getAttribute("aria-labelledby") ?? "").split(/\s+/),
          ...(element.getAttribute("aria-describedby") ?? "").split(/\s+/),
        ])
        .filter(Boolean),
    );
    const governed = [...document.querySelectorAll<HTMLElement>("*")];
    return governed
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const referenced = Boolean(element.id && referencedIds.has(element.id));
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
        const directText = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
        return (
          referenced ||
          (visible &&
            (element.matches(
              `${selector}, a[href], button, input, select, textarea, [role], img`,
            ) ||
              directText))
        );
      })
      .map((element, index) => {
        const id = `task15-forced-${index}`;
        element.dataset.task15ForcedId = id;
        const focusable = element.matches(selector) && element.tabIndex >= 0;
        const image = element instanceof HTMLImageElement;
        const control = element.matches(
          'a[href], button, input, select, textarea, [role="button"], [role="checkbox"], [role="link"]',
        );
        const directText = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
        const referenced = Boolean(element.id && referencedIds.has(element.id));
        const rect = element.getBoundingClientRect();
        const accessibleOnly = referenced && (rect.width <= 1 || rect.height <= 1);
        const textContent = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const formText =
          element instanceof HTMLSelectElement
            ? [...element.selectedOptions]
                .map((option) => option.textContent?.replace(/\s+/g, " ").trim() ?? "")
                .filter(Boolean)
                .join(" ")
            : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
              ? element.value.trim() || element.placeholder.trim()
              : "";
        const placeholderText =
          (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
          !element.value &&
          Boolean(element.placeholder.trim());
        return {
          id,
          focusable,
          image,
          control,
          referenced,
          directText,
          textContent,
          formText,
          placeholderText,
          accessibleOnly,
        };
      });
  }, focusableSelector);
  const governedTargets = targets.map((target) => ({
    ...target,
    ...forcedColorTargetCategories(target),
  }));
  const failures: string[] = [];
  let checked = 0;
  let focusDeltas = 0;
  for (const target of governedTargets) {
    const locator = page.locator(`[data-task15-forced-id="${target.id}"]`);
    if ((await locator.count()) === 0) {
      failures.push(`${target.id}:detached`);
      continue;
    }
    const beforeFocus = target.focusable
      ? await locator.evaluate((element) => {
          const active = document.activeElement;
          if (active instanceof HTMLElement) active.blur();
          const style = getComputedStyle(element);
          return {
            outlineColor: style.outlineColor,
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow,
            borderColor: style.borderColor,
            borderStyle: style.borderStyle,
            borderWidth: style.borderWidth,
          };
        })
      : null;
    if (target.focusable) await locator.focus();
    const appearance = await locator.evaluate(
      (element, { target, beforeFocus }) => {
        const style = getComputedStyle(element);
        const textStyle = target.placeholderText
          ? getComputedStyle(element, "::placeholder")
          : style;
        const canvasBackground = () => {
          const canvasProbe = document.createElement("span");
          canvasProbe.style.backgroundColor = "Canvas";
          document.body.append(canvasProbe);
          let canvas = getComputedStyle(canvasProbe).backgroundColor;
          canvasProbe.remove();
          const transparentCanvas = canvas.match(
            /^rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*0\s*\)$/,
          );
          if (transparentCanvas)
            canvas = `rgb(${transparentCanvas[1]}, ${transparentCanvas[2]}, ${transparentCanvas[3]})`;
          return canvas;
        };
        const paintLayers = (start: Element | null) => {
          const layers: Array<{ background: string; opacity: number }> = [];
          let backgroundElement = start;
          while (backgroundElement) {
            const layerStyle = getComputedStyle(backgroundElement);
            layers.push({
              background: layerStyle.backgroundColor,
              opacity: Number.parseFloat(layerStyle.opacity) || 0,
            });
            backgroundElement = backgroundElement.parentElement;
          }
          layers.push({ background: canvasBackground(), opacity: 1 });
          return layers;
        };
        const elementPaintLayers = paintLayers(element);
        const background = elementPaintLayers[0]?.background ?? canvasBackground();
        const exteriorBackground = elementPaintLayers[1]?.background ?? canvasBackground();
        let effectiveOpacity = 1;
        let ancestorVisibility = true;
        let opacityElement: Element | null = element;
        while (opacityElement) {
          const ancestorStyle = getComputedStyle(opacityElement);
          effectiveOpacity *= Number.parseFloat(ancestorStyle.opacity) || 0;
          if (ancestorStyle.visibility === "hidden" || ancestorStyle.display === "none")
            ancestorVisibility = false;
          opacityElement = opacityElement.parentElement;
        }
        const contentVisible =
          effectiveOpacity > 0 &&
          ancestorVisibility &&
          style.color !== "rgba(0, 0, 0, 0)" &&
          style.visibility !== "hidden";
        const focused = document.activeElement === element;
        const splitShadows = (value: string) => {
          if (!value || value === "none") return [];
          const shadows: string[] = [];
          let depth = 0;
          let start = 0;
          for (let index = 0; index < value.length; index += 1) {
            if (value[index] === "(") depth += 1;
            if (value[index] === ")") depth -= 1;
            if (value[index] === "," && depth === 0) {
              shadows.push(value.slice(start, index).trim());
              start = index + 1;
            }
          }
          shadows.push(value.slice(start).trim());
          return shadows.filter(Boolean);
        };
        const focusIndicators: Array<{
          kind: "outline" | "shadow" | "border";
          color: string;
          width: number;
          changed: boolean;
          inset: boolean;
        }> = [];
        const outlineWidth = Number.parseFloat(style.outlineWidth);
        if (style.outlineStyle !== "none" && outlineWidth >= 1)
          focusIndicators.push({
            kind: "outline",
            color: style.outlineColor,
            width: outlineWidth,
            changed:
              beforeFocus !== null &&
              (beforeFocus.outlineColor !== style.outlineColor ||
                beforeFocus.outlineStyle !== style.outlineStyle ||
                beforeFocus.outlineWidth !== style.outlineWidth),
            inset: false,
          });
        const beforeShadows = splitShadows(beforeFocus?.boxShadow ?? "none");
        for (const shadow of splitShadows(style.boxShadow)) {
          const color = shadow.match(/(?:rgba?|hsla?)\([^)]*\)|#[\da-f]{3,8}/i)?.[0];
          const lengths =
            shadow.match(/-?\d+(?:\.\d+)?px/g)?.map((value) => Number.parseFloat(value)) ?? [];
          const spread = lengths.length >= 4 ? Math.abs(lengths[3]) : 0;
          if (!color || spread < 1) continue;
          focusIndicators.push({
            kind: "shadow",
            color,
            width: spread,
            changed: beforeFocus !== null && !beforeShadows.includes(shadow),
            inset: /\binset\b/i.test(shadow),
          });
        }
        const borderWidth = Number.parseFloat(style.borderWidth);
        if (style.borderStyle !== "none" && borderWidth >= 1)
          focusIndicators.push({
            kind: "border",
            color: style.borderColor,
            width: borderWidth,
            changed:
              beforeFocus !== null &&
              (beforeFocus.borderColor !== style.borderColor ||
                beforeFocus.borderStyle !== style.borderStyle ||
                beforeFocus.borderWidth !== style.borderWidth),
            inset: false,
          });
        const imageNamed =
          !target.image ||
          (element instanceof HTMLImageElement &&
            (element.alt === "" || Boolean(element.alt.trim()))) ||
          element.getAttribute("aria-hidden") === "true";
        return {
          contentVisible,
          imageNamed,
          color: textStyle.color,
          background,
          exteriorBackground,
          paintLayers: elementPaintLayers,
          effectiveOpacity,
          borderColor: style.borderColor,
          borderWidth: Number.parseFloat(style.borderWidth),
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          boxShadow: style.boxShadow,
          textDecorationLine: style.textDecorationLine,
          focusable: target.focusable,
          focused,
          focusIndicators,
          focusDeltaCaptured: !target.focusable || (beforeFocus !== null && focused),
          anchor: element instanceof HTMLAnchorElement,
          disabled:
            element.matches(":disabled") || element.getAttribute("aria-disabled") === "true",
        };
      },
      { target, beforeFocus },
    );
    const distinguishable = forcedColorTargetIsDistinguishable({
      ...appearance,
      text: target.text,
      control: target.control,
      accessibleOnly: target.accessibleOnly,
    });
    const visible = appearance.contentVisible && appearance.imageNamed && distinguishable;
    checked += 1;
    if (target.focusable && appearance.focusDeltaCaptured) focusDeltas += 1;
    if (!visible)
      failures.push(
        failures.length === 0
          ? `${target.id}:not-visible:${JSON.stringify({ target, appearance })}`
          : `${target.id}:not-visible`,
      );
  }
  return {
    status:
      governedTargets.length === 0 ? "not-applicable" : failures.length === 0 ? "pass" : "fail",
    evidence: {
      checked,
      total: governedTargets.length,
      focusables: governedTargets.filter((target) => target.focusable).length,
      controls: governedTargets.filter((target) => target.control).length,
      text: governedTargets.filter((target) => target.text).length,
      images: governedTargets.filter((target) => target.image).length,
      focusDeltas,
      failures,
    },
  };
}

async function measureInputLatency(
  page: Page,
  inputSelector: string,
  resultSelector: string,
  value: string,
  expectedText: string,
): Promise<number> {
  return page.evaluate(
    ({ inputSelector, resultSelector, value, expectedText }) =>
      new Promise<number>((resolveLatency, reject) => {
        const input = document.querySelector<HTMLInputElement>(inputSelector);
        const result = document.querySelector<HTMLElement>(resultSelector);
        if (!input || !result)
          return reject(new Error("interaction latency fixture is incomplete"));
        const startedAt = performance.now();
        const timeout = window.setTimeout(
          () => reject(new Error("interaction latency timed out")),
          1_000,
        );
        const finish = () => {
          if (!result.textContent?.includes(expectedText)) return;
          observer.disconnect();
          window.clearTimeout(timeout);
          requestAnimationFrame(() => resolveLatency(performance.now() - startedAt));
        };
        const observer = new MutationObserver(finish);
        observer.observe(result, { childList: true, subtree: true, characterData: true });
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }),
        );
        finish();
      }),
    { inputSelector, resultSelector, value, expectedText },
  );
}

async function measureDialogAndFocus(page: Page): Promise<RepresentativeFlow> {
  const trigger = page.getByRole("button", { name: "Open cancellation confirmation" });
  await trigger.focus();
  const startedAt = await page.evaluate(() => performance.now());
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible", timeout: 1_000 });
  const latencyMs = await page.evaluate((started) => performance.now() - started, startedAt);
  const initialFocusInside = await dialog.evaluate((element) =>
    element.contains(document.activeElement),
  );
  const dialogButtons = dialog.locator("button:not([disabled])");
  const count = await dialogButtons.count();
  await dialogButtons.last().focus();
  await page.keyboard.press("Tab");
  const forwardTrap = await dialog.evaluate((element) => element.contains(document.activeElement));
  await dialogButtons.first().focus();
  await page.keyboard.press("Shift+Tab");
  const backwardTrap = await dialog.evaluate((element) => element.contains(document.activeElement));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 1_000 });
  const returned = await trigger.evaluate((element) => document.activeElement === element);
  await trigger.focus();
  await page.keyboard.press("Space");
  await dialog.waitFor({ state: "visible", timeout: 1_000 });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 1_000 });
  const status =
    initialFocusInside && count >= 2 && forwardTrap && backwardTrap && returned ? "pass" : "fail";
  return {
    status,
    latencyMs: Math.round(latencyMs * 10) / 10,
    notes: ["Enter and Space open; Escape closes; Tab/Shift+Tab remain trapped; focus returns."],
  };
}

async function checkFocusSurfaces(
  page: Page,
  url: string,
): Promise<InteractionEvidence["surfaceFocus"]> {
  const results: InteractionEvidence["surfaceFocus"] = {};
  for (const surface of requiredFocusSurfaces.filter((name) => name !== "image")) {
    const container = page.locator(`[data-focus-surface="${surface}"]`);
    const control = container.getByRole("button");
    await control.focus();
    const details = await control.evaluate((element) => {
      const controlStyle = getComputedStyle(element);
      const surfaceStyle = getComputedStyle(element.parentElement as HTMLElement);
      return {
        outlineColor: controlStyle.outlineColor,
        outlineStyle: controlStyle.outlineStyle,
        outlineWidth: Number.parseFloat(controlStyle.outlineWidth),
        background: surfaceStyle.backgroundColor,
      };
    });
    const ratio = contrastRatio(details.outlineColor, details.background);
    results[surface] = {
      status:
        details.outlineStyle !== "none" && details.outlineWidth >= 2 && ratio !== null && ratio >= 3
          ? "pass"
          : "fail",
      contrastRatio: ratio === null ? null : Math.round(ratio * 100) / 100,
      outlineWidth: details.outlineWidth,
      source: `InteractionFixture[data-focus-surface="${surface}"]`,
    };
  }
  const appScenario = auditScenarios.find(
    (scenario): scenario is VisualAuditScenario =>
      scenario.kind === "visual" && scenario.id === "guest-app-default",
  );
  if (!appScenario) throw new Error("guest-app-default is missing from the audit manifest");
  await navigateScenario(page, url, appScenario, "en");
  const appControl = page.locator(".app-marketing__brand-link");
  await appControl.focus();
  const imageDetails = await appControl.evaluate((element) => {
    const style = getComputedStyle(element);
    const pageSurface = element.closest<HTMLElement>(".app-marketing");
    const pageStyle = pageSurface ? getComputedStyle(pageSurface) : null;
    const backingProbe = document.createElement("span");
    backingProbe.style.backgroundColor = "var(--app-white)";
    backingProbe.style.display = "none";
    element.append(backingProbe);
    const opaqueBacking = getComputedStyle(backingProbe).backgroundColor;
    backingProbe.remove();
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      backgroundImage: pageStyle?.backgroundImage ?? "none",
      opaqueBacking,
      boxShadow: style.boxShadow,
    };
  });
  const imageRatio = contrastRatio(imageDetails.outlineColor, imageDetails.opaqueBacking);
  const hasRealProductImage = imageDetails.backgroundImage !== "none";
  const hasOpaqueBacking =
    imageDetails.boxShadow !== "none" && parseRgb(imageDetails.opaqueBacking) !== null;
  results.image = {
    status:
      hasRealProductImage &&
      hasOpaqueBacking &&
      imageDetails.outlineStyle !== "none" &&
      imageDetails.outlineWidth >= 2 &&
      imageRatio !== null &&
      imageRatio >= 3
        ? "pass"
        : "fail",
    contrastRatio: imageRatio === null ? null : Math.round(imageRatio * 100) / 100,
    outlineWidth: imageDetails.outlineWidth,
    source: "guest-app-default .app-marketing__brand-link over /images/textures/ivory-paper.svg",
    backing: `opaque 6px ${imageDetails.opaqueBacking} halo isolates the outline from ${imageDetails.backgroundImage}`,
  };
  return results;
}

async function checkAssistiveTechnologyFixtureSemantics(
  page: Page,
  url: string,
): Promise<InteractionEvidence["assistiveTechnologyFixtureSemantics"]> {
  const rows: InteractionEvidence["assistiveTechnologyFixtureSemantics"] = [];
  for (const journey of VOICEOVER_JOURNEYS) {
    for (const language of ["he", "ar", "en"] as const) {
      const target = voiceOverJourneyQuery(journey, language);
      const expected = voiceOverJourneyCopy[journey][language];
      const checks: string[] = [];
      const renderedStrings = new Set<string>();
      const collectRenderedStrings = async () => {
        const snapshot = await page.evaluate(() => {
          const visibleText = new Set<string>();
          const hiddenReferencedText = new Set<string>();
          const accessibleAttributes = new Set<string>();
          const formValues = new Set<string>();
          const visible = (element: Element) => {
            if (element.closest('[aria-hidden="true"], [hidden]')) return false;
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
          };
          const referencedIds = new Set(
            [...document.querySelectorAll<HTMLElement>("[aria-labelledby], [aria-describedby]")]
              .filter(visible)
              .flatMap((element) => [
                ...(element.getAttribute("aria-labelledby") ?? "").split(/\s+/),
                ...(element.getAttribute("aria-describedby") ?? "").split(/\s+/),
              ])
              .filter(Boolean),
          );
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node) {
            const parent = node.parentElement;
            const value = node.textContent?.replace(/\s+/g, " ").trim();
            if (parent && value && visible(parent)) visibleText.add(value);
            node = walker.nextNode();
          }
          for (const id of referencedIds) {
            const source = document.getElementById(id);
            const value = source?.textContent?.replace(/\s+/g, " ").trim();
            if (value) hiddenReferencedText.add(value);
          }
          for (const element of document.querySelectorAll(
            "[aria-label], [aria-description], [aria-valuetext], [title], [placeholder], img[alt]",
          )) {
            if (!visible(element)) continue;
            for (const attribute of [
              "aria-label",
              "aria-description",
              "aria-valuetext",
              "title",
              "placeholder",
              "alt",
            ]) {
              const value = element.getAttribute(attribute)?.replace(/\s+/g, " ").trim();
              if (value) accessibleAttributes.add(value);
            }
          }
          for (const element of document.querySelectorAll<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >("input, select, textarea")) {
            if (!visible(element)) continue;
            if (element instanceof HTMLSelectElement) {
              for (const option of element.selectedOptions) {
                const label = option.textContent?.replace(/\s+/g, " ").trim();
                if (label) formValues.add(label);
                if (option.value) formValues.add(option.value);
              }
            } else if (
              element instanceof HTMLTextAreaElement ||
              ["button", "submit", "reset", "text", "email", "search", "url", "tel"].includes(
                element.type,
              )
            ) {
              const value = element.value.replace(/\s+/g, " ").trim();
              if (value) formValues.add(value);
            }
          }
          return {
            visibleText: [...visibleText],
            hiddenReferencedText: [...hiddenReferencedText],
            accessibleAttributes: [...accessibleAttributes],
            formValues: [...formValues],
          };
        });
        for (const value of accessibilityRelevantStrings(snapshot)) renderedStrings.add(value);
      };
      try {
        await page.goto(`${url}${target}`, { waitUntil: "load", timeout: 15_000 });
        const direction = language === "en" ? "ltr" : "rtl";
        const root = await page.locator("html").evaluate((element) => ({
          lang: element.lang,
          dir: element.dir,
        }));
        if (root.lang !== language || root.dir !== direction)
          throw new Error(`document locale was ${root.lang}/${root.dir}`);
        checks.push(`document:${language}/${direction}`);

        await page
          .getByRole("heading", { level: 1, name: expected.heading, exact: true })
          .waitFor();
        checks.push(`heading:${expected.heading}`);
        for (const control of expected.controls) {
          const locator =
            control.role === "field"
              ? page.getByLabel(control.name, { exact: true })
              : page.getByRole(control.role, { name: control.name, exact: true });
          if ((await locator.count()) === 0)
            throw new Error(`missing ${control.role} ${control.name}`);
          checks.push(`${control.role}:${control.name}`);
        }
        if (expected.status) {
          const status = page
            .locator('[aria-live="polite"], [role="status"]')
            .filter({ hasText: expected.status });
          if ((await status.count()) === 0)
            throw new Error(`missing live status ${expected.status}`);
          checks.push(`live-status:${expected.status}`);
        }
        if (expected.tableName) {
          await page.getByRole("table", { name: expected.tableName, exact: true }).waitFor();
          checks.push(`table:${expected.tableName}`);
        }
        for (const header of expected.tableHeaders ?? []) {
          await page.getByRole("columnheader", { name: header, exact: true }).waitFor();
          checks.push(`columnheader:${header}`);
        }
        if (expected.imageAlt) {
          await page.getByRole("img", { name: expected.imageAlt, exact: true }).first().waitFor();
          checks.push(`image:${expected.imageAlt}`);
        }
        await collectRenderedStrings();

        if (journey === "booking" && expected.outcome && expected.primaryAction) {
          const lesson = page.getByRole("button", {
            name: expected.controls[0].name,
            exact: true,
          });
          await lesson.focus();
          if (!(await lesson.evaluate((element) => document.activeElement === element)))
            throw new Error("production lesson control did not receive focus");
          checks.push(`focus:${expected.controls[0].name}`);
          await page.getByRole("button", { name: expected.primaryAction, exact: true }).click();
          await page.getByRole("status").filter({ hasText: expected.outcome }).waitFor();
          checks.push(`outcome-status:${expected.outcome}`);
        }
        if (
          journey === "cancellation" &&
          expected.dialogTitle &&
          expected.dialogDescription &&
          expected.dialogKeep &&
          expected.dialogConfirm
        ) {
          await page.getByRole("button", { name: expected.controls[0].name, exact: true }).click();
          const dialog = page.getByRole("dialog");
          await dialog.getByRole("heading", { name: expected.dialogTitle, exact: true }).waitFor();
          checks.push(`dialog:${expected.dialogTitle}`);
          await dialog.getByText(expected.dialogDescription, { exact: true }).first().waitFor();
          checks.push(`dialog-description:${expected.dialogDescription}`);
          const keep = dialog.getByRole("button", { name: expected.dialogKeep, exact: true });
          const confirm = dialog.getByRole("button", {
            name: expected.dialogConfirm,
            exact: true,
          });
          await keep.waitFor();
          await confirm.waitFor();
          checks.push(
            `dialog-control:${expected.dialogKeep}`,
            `dialog-control:${expected.dialogConfirm}`,
          );
          if (!(await keep.evaluate((element) => document.activeElement === element)))
            throw new Error("cancellation dialog did not focus its safe action");
          checks.push(`dialog-initial-focus:${expected.dialogKeep}`);
          await collectRenderedStrings();
          await confirm.click();
          await page.getByRole("status").filter({ hasText: expected.outcome }).waitFor();
          checks.push(`outcome-status:${expected.outcome}`);
          await collectRenderedStrings();
        }
        if (
          journey === "admin-destructive-confirmation" &&
          expected.dialogTitle &&
          expected.dialogDescription &&
          expected.dialogKeep &&
          expected.dialogConfirm
        ) {
          await page.getByRole("button", { name: expected.controls[0].name, exact: true }).click();
          const dialog = page.getByRole("alertdialog");
          await dialog.getByRole("heading", { name: expected.dialogTitle, exact: true }).waitFor();
          checks.push(`alertdialog:${expected.dialogTitle}`);
          await dialog.getByText(expected.dialogDescription, { exact: true }).waitFor();
          checks.push(`dialog-description:${expected.dialogDescription}`);
          const cancel = dialog.getByRole("button", { name: expected.dialogKeep, exact: true });
          await cancel.waitFor();
          await dialog.getByRole("button", { name: expected.dialogConfirm, exact: true }).waitFor();
          checks.push(
            `dialog-control:${expected.dialogKeep}`,
            `dialog-control:${expected.dialogConfirm}`,
          );
          if (!(await cancel.evaluate((element) => document.activeElement === element)))
            throw new Error("admin dialog did not focus its safe action");
          checks.push(`dialog-initial-focus:${expected.dialogKeep}`);
          await collectRenderedStrings();
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          checks.push("dialog-escape-close");
        }

        await collectRenderedStrings();
        const leaked = localeLeakageViolations(language, [...renderedStrings]);
        if (leaked.length) throw new Error(`locale policy rejected: ${leaked.join(" | ")}`);
        checks.push("locale-policy:complete-visible-accessible-strings");

        rows.push({ journey, language, status: "pass", target, checks });
      } catch (error) {
        rows.push({
          journey,
          language,
          status: "fail",
          target,
          checks: [...checks, error instanceof Error ? error.message : String(error)],
        });
      }
    }
  }
  return rows;
}

async function checkRepresentativeFlows(
  page: Page,
  url: string,
): Promise<
  Pick<
    InteractionEvidence,
    "representativeFlows" | "surfaceFocus" | "assistiveTechnologyFixtureSemantics"
  >
> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
  const query = new URLSearchParams({
    scenario: "guest-member-schedule-default",
    language: "en",
    evidence: "1",
    interaction: "1",
  });
  await page.goto(`${url}/?${query}`, { waitUntil: "load", timeout: 15_000 });
  await page.locator('[data-product-view="task-15-interaction-fixture"]').waitFor();
  const scheduleLatency = await measureInputLatency(
    page,
    '[data-interaction-flow="schedule-filter"] input',
    '[data-testid="schedule-results"]',
    "Aerial",
    "Aerial Yoga Flow",
  );
  const tableLatency = await measureInputLatency(
    page,
    "#task-15-roster-filter",
    '[data-testid="attendance-results"]',
    "Lina",
    "Lina Haddad",
  );
  const dialog = await measureDialogAndFocus(page);
  return {
    surfaceFocus: await checkFocusSurfaces(page, url),
    assistiveTechnologyFixtureSemantics: await checkAssistiveTechnologyFixtureSemantics(page, url),
    representativeFlows: {
      dialog,
      scheduleFilter: { status: "pass", latencyMs: Math.round(scheduleLatency * 10) / 10 },
      tableFilter: { status: "pass", latencyMs: Math.round(tableLatency * 10) / 10 },
    },
  };
}

async function main(): Promise<void> {
  const manifestErrors = validateCurrentManifest(projectRoot);
  if (manifestErrors.length) throw new Error(manifestErrors.join("\n"));
  const { server, url } = await startPreview();
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ reducedMotion: "reduce", forcedColors: "none" });
    const page = await context.newPage();
    const scenarioLocales: ScenarioLocaleResult[] = [];
    const scenarios = auditScenarios
      .filter(
        (scenario): scenario is VisualAuditScenario =>
          scenario.kind === "visual" && scenario.riskTier === "A",
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const scenario of scenarios) {
      for (const language of [...scenario.languages].sort()) {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
        await navigateScenario(page, url, scenario, language);
        const keyboard = await inspectKeyboardAndFocus(page, url, scenario, language);
        const reducedMotion = await reducedMotionStatus(page);
        const forcedColors = await forcedColorsStatus(page);
        await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
        await navigateScenario(page, url, scenario, language);
        const reflow200 = (await checkHorizontalOverflow(page, 640)) ? "fail" : "pass";
        await navigateScenario(page, url, scenario, language);
        const reflow400 = (await checkHorizontalOverflow(page, 320)) ? "fail" : "pass";
        scenarioLocales.push({
          scenarioId: scenario.id,
          language,
          keyboard: keyboard.keyboard,
          activation: keyboard.activation,
          escape: "not-applicable",
          focus: keyboard.focus,
          reflow200,
          reflow400,
          reducedMotion: reducedMotion.status,
          forcedColors: forcedColors.status,
          latency: "not-applicable",
          focusSurfaces: keyboard.focusSurfaces,
          notes: keyboard.notes,
          notApplicableReasons: {
            ...keyboard.notApplicableReasons,
            escape: "covered-by-production-dialog-representative-flow",
            ...(forcedColors.status === "not-applicable"
              ? { forcedColors: "no-governed-forced-colors-targets" }
              : {}),
            latency: "covered-by-representative-production-flows",
          },
          keyboardEvidence: keyboard.keyboardEvidence,
          activationEvidence: keyboard.activationEvidence,
          focusEvidence: keyboard.focusEvidence,
          reducedMotionEvidence: reducedMotion.evidence,
          forcedColorsEvidence: forcedColors.evidence,
        });
        console.log(`Interaction checked ${scenario.id}/${language}`);
      }
    }
    const { representativeFlows, surfaceFocus, assistiveTechnologyFixtureSemantics } =
      await checkRepresentativeFlows(page, url);
    const evidence: InteractionEvidence = {
      scenarioLocales,
      surfaceFocus,
      representativeFlows,
      assistiveTechnologyFixtureSemantics,
    };
    const errors = validateInteractionEvidence(evidence);
    mkdirSync(outputRoot, { recursive: true });
    const artifact = `${JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        sourceSha256: interactionSourceSha256(),
        errors,
        ...evidence,
      },
      null,
      2,
    )}\n`;
    mkdirSync(resolve(trackedEvidencePath, ".."), { recursive: true });
    writeFileSync(resolve(outputRoot, "interaction-results.json"), artifact);
    writeFileSync(trackedEvidencePath, artifact);
    await context.close();
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      `Interaction checks passed ${scenarioLocales.length}/48 scenario-locale rows; dialog ${representativeFlows.dialog.latencyMs}ms, schedule ${representativeFlows.scheduleFilter.latencyMs}ms, table ${representativeFlows.tableFilter.latencyMs}ms`,
    );
  } finally {
    await browser?.close();
    server.httpServer.close();
  }
}

if (import.meta.main) await main();
