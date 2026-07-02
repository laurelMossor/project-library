TODO

# Design System — Working Notes

> Status: NOT a formal design system yet, and deliberately so. We're in closed/open beta
> with the foundation still moving. This doc's job is to catch the design system that is
> *already accreting implicitly* — so ad-hoc consolidation stops recurring — without
> over-investing in tokens/docs for surfaces that are still churning.

## Why now (the pattern we keep paying for)
The journal is full of one-off consistency fixes: `gray-*` → `soft-grey`/`ash-green`,
merging DeletePostButton + DeleteEventButton into DeleteConfirmButton, unifying
ProfileTag / NavProfileTag sizing, palette cleanups "throughout." Each was cheap alone;
together they signal an implicit system worth *extracting and naming once* — then guarding.

## High-level TODOs (extract what exists; don't invent)
- [ ] **Palette / tokens:** inventory every color actually in use; codify the named palette
      (soft-grey, ash-green, melon-green, …) as the single source (Tailwind theme / CSS vars).
      Grep out stray `gray-*` and raw hex.
- [ ] **Primitive catalog:** document the shared components we already lean on and their
      variants/props — ProfileTag, ProfilePicture, DeleteConfirmButton, the Form* family
      (FormField/Input/Textarea/Actions/Error), TabbedPanel, EmptyState, CenteredLayout,
      the shared icons file. One page: "what exists, when to reach for it."
- [ ] **Scale audit:** spacing / sizing / typography — note the de-facto scale, flag one-offs.
- [ ] **Guardrail (the actual payoff):** a lint rule or CI check banning raw `gray-*` / hex
      so the consolidation we do once doesn't silently regress.

## Explicitly deferred (too early — revisit post-open-beta)
- Storybook / component playground
- Figma ↔ code parity / a formal token pipeline
- Exhaustive per-component API docs
Rationale: surface count is still small and changing weekly; formalizing now would ossify
things we're still reshaping. Extract + guardrail is the right altitude for this phase.