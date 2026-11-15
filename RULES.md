# Wish Willow — Project Rules

*Locked 2026-11-15. Applies to all code, demos, docs, and agents working on Wish Willow.*

## Rule 0 — Division of labor: we plan, Capy builds

**Claude Code (every Jenny session on this project) does only three things: PLAN, DESIGN UI, and WRITE THE PRD/specs.** All app code, builds, tests, and PRs are **Capy's** job.

- **Our scope:** product planning + decisions · UI/UX design (mockups, design system, flows) · the PRD, specs, and **Capy tickets** · research · reviewing Capy's output.
- **Capy's scope:** writing ALL app code · running builds + Revyl tests · opening and **submitting PRs** · the app repo.
- **We do NOT** write app code, commit, or push to the app repo. Any code we produce (e.g. the authored Convex backend) is a **spec handed to Capy as a ticket**, never committed by us.
- **Where our artifacts live:** planning/design/PRD/tickets in `~/projects/consumer-mobile-hackathon/` (the packet) + the PRD on the GitHub repo; everything executable goes *to Capy*.
- **GitHub is the single source of truth**; Capy pushes branches → PRs → `main`. We don't do git surgery on its tree.

## Rule 1 — Real info only. No fabrication. Ever.

Every fact Wish Willow shows a user — prices, products, events, places, people, availability, status, counts, dates — **must come from a real, live source.** Nothing is invented, estimated, or presented as real when it isn't.

This is the product's trust contract: Willow does real legwork, so the information it surfaces is real. A single made-up fact breaks the whole premise.

## Rule 2 — Sources: scrape live web, social media, and event web/apps

Pull facts at runtime from authoritative live sources. Prefer official APIs; fall back to scraping the official web/app surface:

| Fact type | Source of truth |
|---|---|
| Device specs & pricing (e.g. iPhone) | The maker's official site / configurator (apple.com) |
| Hackathon / event details | The event's official site + its platform page (consumermobilehackathon.com, events.ycombinator.com) |
| Events, meetups, RSVPs | Luma · Eventbrite · Partiful · official event pages |
| People, updates, activity | The person's public social profiles / posts |
| Places, venues, hours | Maps / places data (official listings) |
| Community wishes & honorers | Wish Willow's own live backend (Convex) |

## Rule 3 — Match reality, with provenance

- Fetch fresh (or cache with a visible timestamp). Stale data is labeled stale.
- Keep the **source URL + fetch time** for every surfaced fact so it's verifiable (fabrication firewall — a claim with no traceable source doesn't ship).
- When the real value changes, the app changes. No hardcoded facts that can drift.

## Rule 4 — When data is missing, say so

If a fact can't be fetched: show "not available," omit the field, or clearly mark it as an **example/demo** — never fill the gap with a plausible guess. "I don't have that yet" beats a confident wrong answer.

## Rule 5 — Demo data must be labeled

Any seeded or illustrative data used before live sources are wired must be visibly marked as demo/sample, so it is never mistaken for real.

---

*Extends Jenny's global standards: verify-before-propagating, fabrication firewall, production-quality-always.*
