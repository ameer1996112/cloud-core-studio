# Member design-system recommendation

The recommendation preserves Cloud & Core’s midnight navy, warm gold, ivory and quiet editorial restraint. It refines the existing system; it does not propose a rebrand.

| Area | Recommendation | Change type |
|---|---|---|
| Principles | Quiet strength, one primary task per surface, information before decoration, calm feedback, and explicit booking/payment consequences. | Preserves |
| Semantic color tokens | `surface.canvas #FAF7F2`, `surface.base #FFFFFF`, `surface.subtle #F4EEE5`, `text.primary #0B1D3A`, `text.secondary #53627A`, `border.subtle #D9C7A4`, `action.primary #0B1D3A`, `focus.outer #0B1D3A`, `focus.inner #D4AF6A`, `success #456650`, `warning #8A641F`, `danger #9A3F49`. Verify all text/background pairs at AA; gold is an accent, never body text. | Refines |
| Surface hierarchy | Canvas → white task card → sand supporting card → navy emphasis panel. One hairline border and one low-elevation shadow maximum; no gradient as the only affordance. | Refines |
| Typography | Assistant 400/600/700 for Hebrew and English UI; Noto Sans Arabic 400/600/700 for Arabic. Cormorant Garamond 600 only for English editorial display/brand moments, never controls, prices or Arabic/Hebrew. | Preserves |
| Type scale | Label 12/16; body 16/25; small body 14/22; title 24/30; page title 32/38 mobile then 40/46 desktop; display 48/52 desktop. Use tabular numerals for time, availability, price and codes. | Refines |
| Spacing | Retain 4px base: 4, 8, 12, 16, 24, 32, 48, 64. Cards: 16 mobile / 24 desktop; page gutter 16 mobile / clamp(24,4vw,48) desktop; section gaps 24/32. Remove one-off values unless tied to an icon or safe area. | Refines |
| Layout | Member content max 1120px, readable copy max 680px, form max 560px, modal max 560px. At 768px switch navigation pattern, not merely card width. | Preserves |
| Shape/elevation | Radius 8 input, 12 button/card, 16 panel, pill only for compact status. Shadows: none for resting boundaries; card `0 4px 18px rgba(11,29,58,.08)`; modal `0 20px 48px rgba(11,29,58,.18)`. | Refines |
| Buttons | Primary navy filled; secondary navy outline; tertiary text link; destructive outline then confirm. All 44px minimum, label+icon order flips logically in RTL, `loading` replaces label without changing width. | Refines |
| Inputs | Visible persistent label, 44px minimum, helper/error below, `aria-describedby`, error icon/text plus border, `autocomplete`, directional phone/email values. | Preserves |
| Cards | Standard info card, selectable plan card, class card, reservation card, empty card. Each has documented default/selected/loading/disabled/error/long-text variants. | Consolidates inconsistent patterns |
| Navigation | Five 52px mobile tabs are usable but dense. At 320px allow a labelled “More” pattern or shorten localized labels; on tablet/desktop retain top nav with an unmistakable active underline. | Refines |
| Dialog/sheet | Use Radix variants: labelled title, description, close, Escape, focus restore, scrollable content with persistent non-obscuring CTA. Class address must wrap or disclose. | Refines |
| State patterns | Skeleton preserves card geometry; empty state says why/what next; error names the problem and retry; success shows an outcome plus the next relevant action; pending payment explicitly says not to pay again. | Preserves |
| RTL/LTR | Use `margin-inline`, `padding-inline`, `inset-inline-*`, logical icon classes, `bdi`/`dir=ltr` for dates, phones, currency and codes. Ban physical positioning except truly fixed visual artwork. | Refines |
| Motion | 150–220ms opacity/transform; never transition `all`; respect reduced motion; no pulsing status without text. | Refines |

Foundation acceptance: token names replace arbitrary visual utilities in member routes; every button/input/card is a documented variant; all focus states meet 3:1; every RTL icon/action is regression-tested in Arabic and Hebrew.
