#!/usr/bin/env python3
"""Conservatively flag destructive or non-transactional migration SQL."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def strip_comments(sql: str) -> str:
    output: list[str] = []
    index = 0
    block_depth = 0
    line_comment = False
    quote = ""
    dollar_quote = ""
    backslash_escapes = False

    while index < len(sql):
        if dollar_quote:
            if sql.startswith(dollar_quote, index):
                output.append(dollar_quote)
                index += len(dollar_quote)
                dollar_quote = ""
            else:
                output.append(sql[index])
                index += 1
            continue
        if quote:
            char = sql[index]
            output.append(char)
            if quote == "'" and backslash_escapes and char == "\\" and index + 1 < len(sql):
                output.append(sql[index + 1])
                index += 2
                continue
            if char == quote:
                if index + 1 < len(sql) and sql[index + 1] == quote:
                    output.append(sql[index + 1])
                    index += 2
                    continue
                quote = ""
                backslash_escapes = False
            index += 1
            continue
        if line_comment:
            if sql[index] == "\n":
                line_comment = False
                output.append("\n")
            index += 1
            continue
        if block_depth:
            if sql.startswith("/*", index):
                block_depth += 1
                index += 2
            elif sql.startswith("*/", index):
                block_depth -= 1
                index += 2
            else:
                if sql[index] == "\n":
                    output.append("\n")
                index += 1
            continue
        if sql.startswith("--", index):
            line_comment = True
            index += 2
        elif sql.startswith("/*", index):
            block_depth = 1
            index += 2
        else:
            if sql[index] in "'\"":
                quote = sql[index]
                backslash_escapes = quote == "'" and index > 0 and sql[index - 1] in "eE" and (
                    index < 2 or not (sql[index - 2].isalnum() or sql[index - 2] in "_$")
                )
            elif sql[index] == "$":
                delimiter = re.match(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$", sql[index:])
                if delimiter:
                    dollar_quote = delimiter.group(0)
                    output.append(dollar_quote)
                    index += len(dollar_quote)
                    continue
            output.append(sql[index])
            index += 1

    if block_depth or quote or dollar_quote:
        raise ValueError("unterminated SQL comment or quoted value")
    return "".join(output)


RISK_PATTERNS = (
    re.compile(r"\bDROP\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\b", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
    re.compile(r"\bUPDATE\b", re.IGNORECASE),
    re.compile(r"\bALTER\s+TABLE\b[\s\S]*?\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b", re.IGNORECASE),
    re.compile(r"\bVACUUM\b", re.IGNORECASE),
    re.compile(r"\bALTER\s+SYSTEM\b", re.IGNORECASE),
    re.compile(r"\b(?:CREATE|DROP)\s+DATABASE\b", re.IGNORECASE),
    re.compile(r"\b(?:CREATE|DROP)\s+TABLESPACE\b", re.IGNORECASE),
    re.compile(r"\b(?:CREATE|DROP|REINDEX)\s+INDEX\s+CONCURRENTLY\b", re.IGNORECASE),
    re.compile(r"\bREFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\b", re.IGNORECASE),
    re.compile(r"\bCONCURRENTLY\b", re.IGNORECASE),
)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: migration-release-risk.py MIGRATION.sql", file=sys.stderr)
        return 2
    try:
        sql = strip_comments(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as error:
        print(f"migration SQL risk analysis failed: {error}", file=sys.stderr)
        return 2
    print("REVIEW_REQUIRED" if any(pattern.search(sql) for pattern in RISK_PATTERNS) else "SAFE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
