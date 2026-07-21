---
name: kms-palette
description: >-
  VNA KMS palette + chart colors for mock-api (ceo-command-center uses V4 fill).
  Use when editing apiV5 chart JSON color/colorToken or CEO domain accents.
---

# VNA KMS Palette (mock-api)

## Đọc trước

| File | Vai trò |
|------|---------|
| [`apiV5/domain/ceo-command-center/kms-palette.config.json`](../../../apiV5/domain/ceo-command-center/kms-palette.config.json) | CEO: **activeFillSet = v4** + series hex |
| `vna-demo/src/theme/kms/kms-palette.config.json` | SSOT đủ V1–V4 |
| `.cursor/rules/chart-colors.mdc` | Quy ước series TH/KH/CK |
| `vna-demo/.cursor/skills/kms-palette/SKILL.md` | Skill đầy đủ (chart P/CP từ color.html) |

## CEO Command Center

- **Fill set mặc định: V4** (`chartPaletteV4` / `fillSeq.v4`)
- Primary/Semantic/V1 objects: cố định — không thay bằng V4
- Series tự do / pie / multi-category: lần lượt V4 (ưu tiên bỏ `#EFE9D6` Kem khỏi CP)

| Vai trò | Hex |
|---------|-----|
| Thực hiện | `#006D88` |
| Kế hoạch / Mục tiêu | `#D3AC2B` |
| Cùng kỳ | `#9AA0A6` (line dashed) |
| Positive | `#22C55E` |
| Negative | `#EF4444` |

```json
"chartPaletteV4": ["#1D4857", "#479EB3", "#3D879B", "#C4A83A", "#889941", "#5E793D", "#C76449", "#A55C3E", "#B86A84", "#AE8655", "#476065", "#E28A81"]
```

V1 = object map only — **không** xoay domain colors cho series lạ.
