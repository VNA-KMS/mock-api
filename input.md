# CPM — Quy tắc phân quyền xem KPI

## Đối tượng sử dụng

| Mã đối tượng | Tên | Dashboard |
|--------------|-----|-----------|
| `HDQT` | Hội đồng quản trị | UI_CPM_001 |
| `BGD` | Ban Giám đốc | UI_CPM_002 |
| `KHTTHH` | Ban Kế hoạch và Tiếp thị Hàng hóa | UI_CPM_003 |

## Ma trận quyền xem KPI

| STT | Mã KPI | Tên chỉ số | Đơn vị | HDQT | BGD | KHTTHH |
|-----|--------|------------|--------|:----:|:---:|:------:|
| 1 | CPM-001 | Thị phần hàng hóa vận chuyển | % | ✓ | ✓ | ✓ |
| 2 | CPM-002 | Sản lượng hàng hóa, bưu kiện | Tấn | ✓ | ✓ | ✓ |
| 3 | CPM-003 | Hàng hóa, bưu kiện luân chuyển (RFTK) | Nghìn tấn.km | ✗ | ✗ | ✓ |
| 4 | CPM-004 | Hệ số sử dụng tải hàng | % | ✓ | ✓ | ✓ |
| 5 | CPM-005 | Doanh thu hàng hóa, bưu kiện | VNĐ | ✗ | ✗ | ✓ |

## Rule áp dụng

### HDQT (`UI_CPM_001`)

- **Được xem**: CPM-001, CPM-002, CPM-004 (3 KPI)
- **Không được xem**: CPM-003, CPM-005
- **Drill-down**: Theo thời gian, Network

### Ban Giám đốc (`UI_CPM_002`)

- **Được xem**: CPM-001, CPM-002, CPM-004 (3 KPI)
- **Không được xem**: CPM-003, CPM-005
- **Drill-down**: Theo thời gian, Network

### Ban KH&TTHH (`UI_CPM_003`)

- **Được xem**: CPM-001, CPM-002, CPM-003, CPM-004, CPM-005 (đủ 5 KPI)
- **Drill-down**: Theo thời gian, Network / Area / Country / Sector

## Mapping `metricCode` → quyền

```
CPM_001 → HDQT, BGD, KHTTHH
CPM_002 → HDQT, BGD, KHTTHH
CPM_003 → KHTTHH
CPM_004 → HDQT, BGD, KHTTHH
CPM_005 → KHTTHH
```

## Ghi chú triển khai mock API

- `ApiV2/CPM/HDQT/` — chỉ mock `kpis/` và `board/` cho CPM-001, CPM-002, CPM-004
- `ApiV2/CPM/BGD/` — chỉ mock `kpis/` và `board/` cho CPM-001, CPM-002, CPM-004
- `ApiV2/CPM/KHTTHH/` — mock đủ 5 KPI
- `overview/index.json` và `filter` phải phản ánh đúng số KPI theo từng org (HDQT/BGD: 3; KHTTHH: 5)
