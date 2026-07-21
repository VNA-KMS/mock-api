---
name: kms-palette
description: >-
  Mock-api CEO chart colors. ROLE_TOKEN_ALIAS khóa; gen colorToken theo checklist.
---

# Gen chart color (mock-api)

## Khóa — không đụng

```ts
ROLE_TOKEN_ALIAS = {
  'series.actual': 'primary.branding',      // TH
  'series.target': 'semantic.target',     // KH
  'series.previous': 'semantic.reference', // CK
}
```

## Khi tạo / sửa chart JSON

1. TH → `"colorToken": "series.actual"`
2. KH / Mục tiêu → `"colorToken": "series.target"`
3. CK → `"colorToken": "series.previous"` + line dashed
4. Series khác → `"colorToken": "data.…"` (catalog) — **không** dùng 3 token khóa

Rule: `.cursor/rules/ceo-kms-palette.mdc`, `rule-chart.mdc`.
