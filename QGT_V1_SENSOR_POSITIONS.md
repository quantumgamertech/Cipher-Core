# QGT V1 LCD Layout

## Canvas and assets

- Target device: ASUS ROG Ryujin III LCD
- Canvas: 640 x 480 pixels
- Coordinate origin: top-left
- Master template: `C:\Users\Kevin\Downloads\2026-07-01.ralcd`
- Background source: `C:\Users\Kevin\Downloads\ChatGPT Image Jul 1, 2026, 12_37_54 AM.png`
- Import asset: `QGT_V1_background.png`, stored beside `QGT_V1.ralcd`
- Background behavior: pre-sized to 640 x 480; no runtime resize required
- Layer order: the background image is first; live sensors render above it

## Sensor positions

| Layer | HUD field | AIDA64 sensor ID | X | Y | Font | Size | Unit |
|---:|---|---|---:|---:|---|---:|---|
| 1 | Background | `IMG` | 0 | 0 | — | 640 x 480 | — |
| 2 | CPU Temperature | `TCPUPKG` | 104 | 210 | Segoe UI Bold | 24 | °C |
| 3 | GPU Temperature | `TGPU1` | 472 | 210 | Segoe UI Bold | 24 | °C |
| 4 | CPU Usage | `SCPUUTI` | 110 | 257 | Segoe UI Bold | 18 | % |
| 5 | GPU Usage | `SGPU1UTI` | 478 | 257 | Segoe UI Bold | 18 | % |
| 6 | RAM Used | `SUSEDMEM` | 35 | 349 | Segoe UI Bold | 13 | MB |
| 7 | RAM Free | `SFREEMEM` | 35 | 393 | Segoe UI Bold | 13 | MB |
| 8 | VRAM Used | `SGPU1USEDDEMEM` | 526 | 349 | Segoe UI Bold | 13 | MB |
| 9 | FPS | `SAIDAFPS` | 263 | 415 | Segoe UI Bold | 18 | none |
| 10 | Uptime without seconds | `SUPTIMENS` | 339 | 418 | Segoe UI Bold | 13 | none |

## Editable record format

Each item is one line inside `<LCDPAGE1>`. Coordinates are controlled by:

```xml
<ITMX>horizontal-position</ITMX><ITMY>vertical-position</ITMY>
```

Text size is controlled by `<TXTSIZ>`. Set `<SHWLBL>1</SHWLBL>` only if a label should be rendered; QGT V1 keeps labels hidden because the HUD artwork already contains them.

## Compatibility notes

- `SAIDAFPS` displays AIDA64 FPS when that data source is available. It can remain blank when no supported FPS provider is active.
- `TGPU1` and `SGPU1...` target the first detected GPU. Multi-GPU systems may require changing `GPU1` to the desired adapter index.
- The layout references the companion background by relative filename. Keep `QGT_V1_background.png` beside `QGT_V1.ralcd` when importing.
