# Wish Willow — Design Contract

*The visual spec Capy builds to. Match `wish-willow-demo.html` (clickable mockup) for exact layout/flow; this file is the token + component reference. The mockup is HTML — reimplement it in React Native / Expo, matching the look, not the markup.*

## Aesthetic
Mid-century **novelty / two-color letterpress**. Warm kraft paper, one red ink, espresso willow, ochre only for highlights. Distinctive and warm — the opposite of a generic chatbot. Reference the vibe; all marks are original (not the film's artifact).

## Color tokens
| Token | Hex | Use |
|---|---|---|
| paper | `#EBE0C6` | app background (with subtle grain) |
| paper-2 | `#E2D4B4` | insets, chips-off, dashed boxes |
| cream-light | `#F4ECD8` | cards, inputs |
| red | `#B23A2C` | primary ink, buttons, borders |
| red-deep | `#8E2C20` | button shadow, headings |
| ink | `#241C16` | text, the willow |
| ochre | `#C68A38` | highlight only (streak, reward, "grow" moment) |
| line | `#C9B98F` | hairlines, card borders |

## Type (2–3 families)
- **Anton** — logotype, section kickers, buttons (uppercase, letter-spaced).
- **Yeseva One** — the "wish" voice: the big questions, card titles.
- **DM Sans** — all body + UI text.

## Components
- **Buttons** — filled red with a hard `red-deep` drop-shadow (stamp look); ghost = red outline. Uppercase Anton.
- **Chips** — pill, red outline → filled red when selected. Finish chips carry a real color swatch dot.
- **Cards** (`.rescard`, `.wishcard`) — cream-light, 1.5px line border, rounded 14px.
- **Inputs** — cream-light rounded field + a round red **mic** button (voice is first-class everywhere).
- **Progress** — row of dots; active dot is an elongated red pill.
- **Logo** — willow-twig roundel (red ring) + `WISH · WILLOW` wordmark + `★ wishes do come true ★` (one line).
- **Avatar** — initial-only red circle (top-right handle).
- **Blow animation** — catkins scatter from the twig on cast.

## Layout conventions
- **Logo top-left; handle (initial avatar) + 🔥 streak top-right.**
- **"I Wish" home**: left-aligned title, example wish cards, **custom wish input pinned at the bottom**.
- **Bottom tab bar** on home/menu/community (hidden during the wish flow): 🔔 Notifications · ✉️ DMs · 🌳 Wishes · 👥 Community.
- **Result cards are actionable** — every card has a real CTA (no dead ends).

## Responsive (required)
Auto-adapt to all device sizes (iPhone SE → Pro Max → tablet): flex layouts, relative units, **safe-area insets**, no fixed heights. The "I Wish" home fits one screen without scrolling on the smallest phone (text scales to fit).

## Screens (see mockup)
splash (2s) → I Wish home → adaptive clarify (chips + voice/text) → anything-else → private/public (+ reward quick-picks $0/$25/$50/$100 + custom) → blow → actionable result. Plus: handle menu (notifications / wishes / DMs), wish detail + action list, modify flow, community grove.
