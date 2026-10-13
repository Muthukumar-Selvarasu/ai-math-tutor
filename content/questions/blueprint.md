# SolvePath Question Bank Blueprint (`content/questions/blueprint.md`)

Sources: PRD §10.3, §10.3.1 (TECH-07, V1–V9, C1–C4), §18.3, §18.4.1, §19, §21; SPEC §2.4, §4 (WF-10).

## 1. Item Architecture & Zero-Leak Requirements

Every approved seed item adheres to:
- **V1**: 2 to 4 main-path `solution_steps`; final step has no `permitted_scaffold_step`.
- **V2**: No `permitted_scaffold_step`, probe template, isomorphic worked example or diagram label contains an accepted value as a literal after normalisation.
- **V3**: Collision-free misconception predictions (no prediction equals another prediction, a step target value, a probe value, or an accepted form).
- **V4**: Canonical answer has at least two digits or `answer_requires_unit: true`.
- **V5**: At most 4 scaffold probes, each kind `value` probe evaluates to `expected_value` and != final answer.
- **V6**: `method_leak_patterns` specifies operations and step phrases blocked below Level 4.
- **V7**: All alternate paths reach the accepted answer.
- **V8**: Every approved item has a legal transfer partner in the cohort starting set.
- **V9**: Reflection block with `{student_value}`, 3–4 options with at least one `sound: true`, passing age-appropriate constraints.

---

## 2. Release 1.0 Item Matrix (Core Seed Bank)

| Question ID | Subskill | Title | Target Misconception | Probes | Diagram Spec | Legal Transfer Partner |
|---|---|---|---|---|---|---|
| `ratio_share_001` | `part_sharing_total` | Sharing $60 in 2:3 | `ratio_reversal`, `unit_rate_error`, `ratio_additive_interpretation` | 2 probes (parts, unit part) | `diag_ratio_share_001` (Ratio table) | `ratio_share_002` |
| `ratio_share_002` | `part_sharing_total` | Sharing $90 in 4:5 | `ratio_reversal`, `unit_rate_error`, `ratio_additive_interpretation` | 2 probes (parts, unit part) | None | `ratio_share_001` |
| `ratio_simp_001` | `simplification` | Simplifying 12:18 | `whole_to_part_confusion`, `ratio_additive_interpretation` | 2 probes (common factor, first term) | None | `ratio_simp_002` |
| `ratio_simp_002` | `simplification` | Simplifying 15:25 | `whole_to_part_confusion`, `ratio_additive_interpretation` | 2 probes (common factor, first term) | None | `ratio_simp_001` |
| `ratio_unit_001` | `unit_rate` | Book cost unit rate | `unit_rate_error`, `incomplete_reasoning` | 2 probes (price per book, total price) | None | `ratio_unit_002` |
| `ratio_unit_002` | `unit_rate` | Pen cost unit rate | `unit_rate_error`, `incomplete_reasoning` | 2 probes (price per pen, total price) | None | `ratio_unit_001` |
| `scale_0001` | `scale_drawing` | Map scale 1 cm to 4 km | `scale_direction_error`, `unit_conversion_error` | 3 probes (1 cm scale, 2 cm scale, 7.5 cm setup) | `diag_scale_0001` | `scale_0003` |
| `scale_0002` | `scale_drawing` | Map scale 1 cm to 5 km | `scale_direction_error`, `unit_conversion_error` | 2 probes (1 cm scale, 6 cm setup) | None | `scale_0003` |
| `scale_0003` | `scale_drawing` | Map scale 1 cm to 4 km (transfer) | `scale_direction_error`, `unit_conversion_error` | 2 probes (1 cm scale, 5.5 cm setup) | None | `scale_0002` |
| `ratio_table_001` | `ratio_table_representation` | Mixing paint in 3:5 | `ratio_additive_interpretation`, `ratio_reversal` | 2 probes (total parts, blue part amount) | `diag_ratio_table_001` | `ratio_table_002` |
| `ratio_table_002` | `ratio_table_representation` | Baking recipe in 2:5 | `ratio_additive_interpretation`, `ratio_reversal` | 2 probes (total parts, flour amount) | None | `ratio_table_001` |
| `ratio_mult_001` | `multiplicative_comparison` | Card collection scaling | `ratio_additive_interpretation`, `incomplete_reasoning` | 2 probes (multiplier parts, Zoe parts) | None | `ratio_mult_002` |
| `ratio_mult_002` | `multiplicative_comparison` | Marble collection scaling | `ratio_additive_interpretation`, `incomplete_reasoning` | 2 probes (multiplier parts, Sam parts) | None | `ratio_mult_001` |

---

## 3. Release 1.1 Extended Bank (>= 40 items)

The Release 1.1 bank extends coverage across:
- `part_sharing_total` (questions `ratio_share_003` through `ratio_share_010`)
- `simplification` (questions `ratio_simp_003` through `ratio_simp_010`)
- `unit_rate` (questions `ratio_unit_003` through `ratio_unit_010`)
- `scale_drawing` (questions `scale_0004` through `scale_0010`)
- `ratio_table_representation` (questions `ratio_table_003` through `ratio_table_008`)
- `multiplicative_comparison` (questions `ratio_mult_003` through `ratio_mult_008`)
Every item satisfies content validation rules V1–V9, has an approved status, and pairs with a valid transfer partner within its skill.
