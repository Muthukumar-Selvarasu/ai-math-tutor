# Seed item blueprint (Release 1.0, 10 items)

**Status:** draft for product-owner approval. Authoring of any item JSON starts only after this is approved.
**Rules:** PRD 8.2 (item fields), 10.3.1 (validation V1–V9), 14.5 (clusters), 18.3 (content work package). Synthetic content only.

Numbers are chosen at authoring time and checked by content validation (TECH-07): a probe's `expected_value` must evaluate from its expression, no two codes may predict the same wrong number, and a transfer partner must differ from its partner in accepted value and simplified ratio.

## Matrix

| Item id | Subskill | Context (idea) | Predicted misconceptions (`misconception_predictions`) | Level 3 representation | Also covers |
| --- | --- | --- | --- | --- | --- |
| `scale_0001` | Map scale, whole-number scale applied to a decimal | 1 cm : 4 km, 7.5 cm (golden item, PRD 19) | `ratio_additive_interpretation` (11.5) | Ratio table | Slice 0. Probes `one_cm_probe`, `two_cm_probe`, `seven_half_probe` (PRD 19) |
| `ratio_0001` | Part-to-part ratio, find one quantity | Recipe 5:2, 450 g flour | `ratio_additive_interpretation`, `ratio_reversal` | Ratio table | Alternate path (fraction of flour) |
| `ratio_0002` | Part-to-whole, share a total | Share a total in the ratio 2:3 | `whole_to_part_confusion` | Ratio table | |
| `rate_0001` | Unit rate | Price or distance per unit, scale to a new amount | `unit_rate_error` | Ratio table | |
| `scale_0002` | Reverse scale (actual to map) | Map distance from a real distance | `scale_direction_error` | Ratio table | Verifier `inverse_operation_match` path. Slice 0 |
| `conv_0001` | Scale with unit conversion | Scale given in cm, answer asked in km | `unit_conversion_error` | Ratio table | Verifier `unit_error`, `missing_unit` |
| `comp_0001` | Multiplicative comparison | "A is 3 times as much as B" | `irrelevant_operation`, `ratio_additive_interpretation` | Ratio table | |
| `round_0001` | Rounding at the end | Rate problem whose answer needs rounding | `premature_rounding` | Ratio table | Rounding rule in `accepted_answer_spec` |
| `diag_0001` | Reading a given ratio table | Complete a missing cell | `diagram_misread` | Ratio table (given in the stem) | Diagram-dependent eval cases |
| `scale_0003` | Map scale, different scale and context | Transfer partner for `scale_0001` and `scale_0002` | `ratio_additive_interpretation`, `scale_direction_error` | Ratio table | Accepted value and simplified ratio differ from `scale_0001` and from `scale_0002`. Slice 0 |

## Slice 0 bank (PRD 18.4.1, PLAN D6)

Slice 0 holds three items: `scale_0001`, `scale_0003` and `scale_0002`. Section 19 step 13 needs `scale_0003` as the transfer partner of `scale_0001`, and V8 needs every item to have a legal partner inside the bank, so `scale_0002` is paired with `scale_0003` as well. The other seven items arrive with the Tier 1 bank (TECH-47).

## Coverage checks (must hold before the bank is approved)

- Cluster 1 (proportional and multiplicative structure): `scale_0001`, `ratio_0001`, `rate_0001`, `scale_0002`.
- Cluster 2 (part-whole and representation): `ratio_0002`, `diag_0001`.
- Cluster 3 (execution and mechanical): `conv_0001`, `round_0001`.
- Cluster 4 items (`answer_guessing`, `incomplete_reasoning`, `irrelevant_operation`, `insufficient_evidence`): `comp_0001` plus exemplars only.
- Every one of the 12 taxonomy codes has a reviewed exemplar in `content/misconceptions/`, even where no Release 1.0 item predicts it.
- Every item has at least two `scaffold_probes` at Levels 1–3, `method_leak_patterns`, an `isomorphic_worked_example`, `reasoning_options`, and a `reflection` block with 3 or 4 options (V9).
- Transfer pairs (each is a legal partner in the skill graph, and both items share the learning objective, not only the cluster): `scale_0001`↔`scale_0003`, `ratio_0001`↔`ratio_0002`, `rate_0001`↔`round_0001`, `scale_0002`↔`conv_0001`, `scale_0002`↔`scale_0003` (the Slice 0 bank holds only the three scale items, so `scale_0002` needs a partner inside it), `comp_0001`↔`ratio_0001`, `diag_0001`↔`rate_0001`. An item may have more than one legal partner. The earlier `comp_0001`↔`diag_0001` pair is dropped because it shares only a cluster.
- Every item passes content validation V1–V9 (PRD 10.3.1). In particular: accepted values have two or more digits (V4), no prediction equals a step value or a probe value (V3), and the last solution step has no `permitted_scaffold_step` (V1).
- At least 10 method-leak attack prompts in the 42-case critical set reference these items' `method_leak_patterns`.
