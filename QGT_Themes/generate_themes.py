from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(r"C:\Cipher Core\QGT_Themes")
MASTER = ROOT / "Permanent_Master" / "QGT_Inferno_RedOrange.ralcd"
TARGETS = (
    "QGT_Neon_PurpleBlue",
    "QGT_Ice_WhiteCyan",
    "QGT_Matrix_Green",
    "QGT_Stealth_White",
)


def read_layout(path: Path) -> str:
    with path.open("r", encoding="utf-16", newline="") as stream:
        return stream.read()


def write_layout(path: Path, text: str) -> None:
    with path.open("w", encoding="utf-16", newline="") as stream:
        stream.write(text)


def image_fields(layout: str) -> tuple[str, str]:
    filename = re.search(r"<IMGFIL>.*?</IMGFIL>", layout)
    data = re.search(r"<IMGDAT>[0-9A-Fa-f]+</IMGDAT>", layout)
    if not filename or not data:
        raise RuntimeError("Layout is missing its embedded image fields.")
    return filename.group(0), data.group(0)


def label_colors(layout: str) -> dict[str, tuple[str, str]]:
    result: dict[str, tuple[str, str]] = {}
    for line in re.findall(r"(?m)^ .*?<ID>LBL</ID>.*$", layout):
        label = re.search(r"<LBL>(.*?)</LBL>", line)
        foreground = re.search(r"<LBLCOL>-?\d+</LBLCOL>", line)
        shadow = re.search(r"<SHDCOL>-?\d+</SHDCOL>", line)
        if label and foreground and shadow:
            result[label.group(1)] = (foreground.group(0), shadow.group(0))
    return result


def apply_label_colors(master: str, colors: dict[str, tuple[str, str]]) -> str:
    def update(match: re.Match[str]) -> str:
        line = match.group(0)
        label = re.search(r"<LBL>(.*?)</LBL>", line)
        if not label or label.group(1) not in colors:
            return line
        foreground, shadow = colors[label.group(1)]
        line = re.sub(r"<LBLCOL>-?\d+</LBLCOL>", foreground, line, count=1)
        return re.sub(r"<SHDCOL>-?\d+</SHDCOL>", shadow, line, count=1)

    return re.sub(r"(?m)^ .*?<ID>LBL</ID>.*$", update, master)


def main() -> None:
    master = read_layout(MASTER)

    for name in TARGETS:
        target_path = ROOT / f"{name}.ralcd"
        previous = read_layout(target_path)
        filename, data = image_fields(previous)
        colors = label_colors(previous)

        updated = re.sub(r"<IMGFIL>.*?</IMGFIL>", filename, master, count=1)
        updated = re.sub(r"<IMGDAT>[0-9A-Fa-f]+</IMGDAT>", data, updated, count=1)
        updated = apply_label_colors(updated, colors)
        write_layout(target_path, updated)


if __name__ == "__main__":
    main()
