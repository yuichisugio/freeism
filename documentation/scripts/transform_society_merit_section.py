#!/usr/bin/env python3
"""Transform 「社会の仕組み改善」 section to N. + indented - list format."""

from __future__ import annotations

import re
from pathlib import Path


def strip_ordered_prefix(line: str) -> str:
    return re.sub(r"^\d+\.\s*", "", line.strip())


def is_blank(line: str) -> bool:
    return line.strip() == ""


def bare_title_at(lines: list[str], i: int) -> bool:
    if i >= len(lines):
        return False
    line = lines[i]
    if is_blank(line):
        return False
    if line.startswith("#") or line.startswith("-") or line.startswith(" "):
        return False
    if line.strip() == "↓":
        return False
    if "は、下記" in line or "は以下" in line:
        return False
    if "には、" in line:
        return False
    if line.startswith("「") and "」は、" in line:
        return False
    if line.startswith("※"):
        return False
    if re.match(r"^（[0-9０-９]+\）", line.strip()):
        return False
    j = i + 1
    while j < len(lines) and is_blank(lines[j]):
        j += 1
    if j >= len(lines):
        return False
    return lines[j].startswith("- ")


def top_level_bullet_at_col0(line: str) -> bool:
    return line.startswith("- ") and not line.startswith(" -")


def emit_body(out: list[str], body_lines: list[str], *, promote_one_level: bool = False) -> None:
    for raw in body_lines:
        if is_blank(raw):
            out.append("")
            continue
        line = raw.rstrip("\n")
        if line.strip() == "↓":
            out.append("    - ↓")
            continue
        m = re.match(r"^(\s*)", line)
        lead = len(m.group(1)) if m else 0
        rest = line[lead:]
        if rest.startswith("- "):
            level = lead // 2
            if promote_one_level:
                level = max(0, level - 1)
            new_lead = 4 + 2 * level
            out.append(" " * new_lead + rest)
            continue
        if re.match(r"^\d+\.\s", rest):
            out.append("      - " + strip_ordered_prefix(rest))
            continue
        if re.match(r"^（[0-9０-９]+\）", rest):
            out.append("    - " + rest.strip())
            continue
        if lead > 0:
            out.append(" " * (lead + 4) + rest)
            continue
        if rest.strip():
            out.append("    - " + rest.strip())


def split_etc_top_level_bullets(body_lines: list[str]) -> list[tuple[str, list[str]]]:
    chunks: list[tuple[str, list[str]]] = []
    i = 0
    while i < len(body_lines):
        line = body_lines[i]
        if is_blank(line):
            i += 1
            continue
        if top_level_bullet_at_col0(line):
            title = line[2:].strip()
            chunk: list[str] = []
            i += 1
            while i < len(body_lines):
                nxt = body_lines[i]
                if is_blank(nxt):
                    chunk.append(nxt)
                    i += 1
                    continue
                if top_level_bullet_at_col0(nxt):
                    break
                chunk.append(nxt)
                i += 1
            while chunk and is_blank(chunk[-1]):
                chunk.pop()
            chunks.append((title, chunk))
            continue
        i += 1
    return chunks


def transform(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    start_idx = None
    end_idx = None
    for i, ln in enumerate(lines):
        s = ln.rstrip("\n")
        if start_idx is None and s.startswith("#### 汎用的な法律を作れる"):
            start_idx = i
        elif start_idx is not None and end_idx is None:
            if s.startswith("### 「感情＆思想」関連のメリット") and not s.startswith("####"):
                end_idx = i
                break
    if start_idx is None or end_idx is None:
        raise SystemExit(f"markers not found: start={start_idx} end={end_idx}")

    prefix = lines[:start_idx]
    suffix = lines[end_idx:]
    section = [ln.rstrip("\n") for ln in lines[start_idx:end_idx]]

    out_items: list[tuple[str, list[str], bool]] = []
    i = 0
    while i < len(section):
        line = section[i]
        if is_blank(line):
            i += 1
            continue

        if line.startswith("#### "):
            title = line[5:].strip()
            i += 1
            body: list[str] = []
            while i < len(section):
                if section[i].startswith("#### "):
                    break
                if bare_title_at(section, i):
                    break
                body.append(section[i])
                i += 1
            while body and is_blank(body[-1]):
                body.pop()

            if title == "etc":
                for sub_title, sub_body in split_etc_top_level_bullets(body):
                    out_items.append((sub_title, sub_body, True))
            else:
                out_items.append((title, body, False))
            continue

        if bare_title_at(section, i):
            title = section[i].strip()
            i += 1
            body = []
            while i < len(section):
                if section[i].startswith("#### "):
                    break
                if bare_title_at(section, i):
                    break
                body.append(section[i])
                i += 1
            while body and is_blank(body[-1]):
                body.pop()
            out_items.append((title, body, False))
            continue

        i += 1

    rendered: list[str] = []
    for n, (title, body, promote_etc) in enumerate(out_items, start=1):
        rendered.append(f"{n}. {title}")
        emit_body(rendered, body, promote_one_level=promote_etc)
        rendered.append("")

    new_lines = prefix + [ln if ln.endswith("\n") else ln + "\n" for ln in rendered] + suffix
    path.write_text("".join(new_lines), encoding="utf-8")


if __name__ == "__main__":
    doc_root = Path(__file__).resolve().parent.parent
    transform(doc_root / "src" / "freeism" / "freeism.ja.md")
