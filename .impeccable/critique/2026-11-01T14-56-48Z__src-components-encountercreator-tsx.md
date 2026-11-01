---
target: encounter creator and combat flow
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\ample\\Documents\\workspace\\projects\\dnd-initiative-and-more\\src\\components\\EncounterCreator.tsx"
target_fingerprint: "sha256:241bebb8ea85dead3cd54ba9e0b79a3a59ff9371aad22f099f638b1190e85b8f"
target_path: "C:\\Users\\ample\\Documents\\workspace\\projects\\dnd-initiative-and-more\\src\\components\\EncounterCreator.tsx"
timestamp: 2026-11-01T14-56-48Z
slug: src-components-encountercreator-tsx
---
## Design Specificity Verdict

The dark, high-density tabletop command center feels specific to an encounter tracker. The initiative order, round state, and party/enemy grouping fit a DM's live task. The main weakness is continuity: create, launch, active combat, and results behave like separate screens without reliably closing or confirming each transition.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | Saved toast and active round are visible, but Begin Encounter left the initiative modal visible after combat started. |
| 2 | Match System / Real World | 2 | “Flawless Victory” appeared with seven foes standing; “End Encounter?” wording differs from “End Combat.” |
| 3 | User Control and Freedom | 2 | Back and undo exist, but the active encounter route and summary return path were unclear in the browser run. |
| 4 | Consistency and Standards | 2 | Creator footer actions, settings-panel actions, and combat transitions use different placement and feedback patterns. |
| 5 | Error Prevention | 1 | Save allowed an empty encounter and duplicate names appeared in the list. |
| 6 | Recognition Rather Than Recall | 2 | Dense combat details and compact icon controls require learning; shortcuts help experienced DMs. |
| 7 | Flexibility and Efficiency | 3 | Bulk initiative rolls, keyboard shortcuts, and quick damage actions support fast operation. |
| 8 | Aesthetic and Minimalist Design | 3 | Visual identity is coherent; creator, combatant details, side panels, and overlays compete for attention. |
| 9 | Error Recovery | 1 | The empty saved scenario looks ordinary and has no clear recovery cue in the list. |
| 10 | Help and Documentation | 2 | Help exists, but the primary flow gives little inline guidance at save, initiative, and completion decisions. |
| **Total** | | **20/40** | **Acceptable; significant flow improvements needed.** |

## Cognitive Load

Moderate to high. The creator shows library search and filters, player/monster tabs, a roster, combatant editing, difficulty estimates, settings, and Save/Launch decisions at once. Five PCs and five enemies also require substantial scanning in the initiative modal. Grouping is present, but primary focus and progressive disclosure are weak, and the workflow asks users to bridge context across creator, initiative, active combat, and summary.

## Overall Impression

The tool has a fitting visual identity and strong DM-oriented density. The greatest opportunity is making each state transition explicit and trustworthy, especially save versus launch, initiative completion, and the difference between “no party members fell” and “victory.”

## What's Working

- The creator shows party composition and recalculates difficulty while enemies are added.
- Active combat keeps current round/current combatant visible and offers quick actions and shortcuts.
- The results screen groups party performance and encounter highlights for a useful recap.

## Priority Issues

1. **[P1] Make save state and encounter identity clear.** The creator save produced an empty encounter, and the list then displayed two identical “QA Save Diagnosis” names. Distinguish “New encounter” from “Edit saved encounter,” prevent or confirm saving with zero combatants, and flag duplicate names. Include player/enemy counts in save feedback.
   - Suggested command: `$impeccable harden`

2. **[P1] Make initiative completion transition cleanly.** After Begin Encounter, active combat appeared while the initiative modal remained visible. Close the modal only after the transition succeeds; on failure, keep it open and show a clear retryable error. The active screen should be the single visible state.
   - Suggested command: `$impeccable clarify`

3. **[P1] Make result language reflect actual outcomes.** “Flawless Victory” appeared while seven enemies remained. Rename it to “No casualties” or “Party unscathed,” and reserve “Victory” for all enemies defeated or an explicit DM decision. Label remaining enemies as still active rather than escaped.
   - Suggested command: `$impeccable clarify`

4. **[P1] Clarify ending combat and reopening results.** The confirmation said “End Encounter?” while the initiating action was “End Combat.” Use one term, explain whether this ends or pauses the encounter, and provide a reliable route from active combat back to the summary and saved encounter.
   - Suggested command: `$impeccable clarify`

5. **[P2] Reduce setup scanning and explain difficulty.** The creator has several simultaneous panels and the initiative screen repeats ten combatants in two columns. Keep core party/enemy setup visible, collapse secondary atmosphere/media options, and explain why the budget rates an encounter as Trivial.
   - Suggested command: `$impeccable distill`

## Persona Red Flags

- **Busy DM:** two same-named encounters and an empty scenario make the right saved encounter harder to identify.
- **New DM:** “Trivial,” “Flawless Victory,” and “End Encounter” are open to over-literal or contradictory interpretations.
- **Power user:** initiative rolling is efficient, but the modal/active-screen overlap interrupts the fast path.

## Minor Observations

- Five level-7 PCs against five CR 1/4 acolytes were rated “Trivial,” which appears plausible; a short explanation of the adjusted XP basis would build confidence.
- The first run's damage numbers were affected by imprecise test clicks and should not inform balance conclusions.
- The second populated encounter was saved and reached round 2, but I did not complete it with artificial damage actions; its combat summary remains unreviewed.

## Questions to Consider

- Should “End Combat” mean the encounter is over, or should it also support leaving combat and resuming later?
- Should “victory” require all enemies defeated, or should the DM choose the outcome?
- Should the next improvement prioritize save/launch reliability, result accuracy, or reducing creator complexity?

## Run Notes

- Target: `src/components/EncounterCreator.tsx`; slug: `src-components-encountercreator-tsx`.
- Assessments: independent dual-agent design review and detector/browser review requested.
- Detector: ran on EncounterCreator, InitiativeModal, and encounterStats; 0 findings.
- Browser: existing local browser evidence reviewed. Fresh-tab overlay attempt stopped at Chrome's “Allow remote debugging?” prompt; no overlay was injected or made visible.
- Ignore list: none found.
- Snapshot: pending.
