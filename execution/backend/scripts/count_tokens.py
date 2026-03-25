#!/usr/bin/env python3
"""Count tokens in Sarah's system prompt using tiktoken.

Usage:
    python scripts/count_tokens.py                    # Count and report
    python scripts/count_tokens.py --check             # Exit 1 if over 8000
    python scripts/count_tokens.py --check --limit 7500  # Custom limit
"""
import argparse
import os
import sys


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    import tiktoken
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))


def main():
    parser = argparse.ArgumentParser(description="Count tokens in system prompt")
    parser.add_argument("--check", action="store_true", help="Exit 1 if over limit")
    parser.add_argument("--limit", type=int, default=8000, help="Token limit (default: 8000)")
    parser.add_argument("--file", default=None, help="Prompt file path (auto-detected if omitted)")
    args = parser.parse_args()

    # Auto-detect prompt file location
    if args.file:
        prompt_path = args.file
    else:
        # Try relative paths from different working directories
        candidates = [
            "prompts/sarah_system_prompt.txt",
            "execution/backend/prompts/sarah_system_prompt.txt",
            os.path.join(os.path.dirname(__file__), "..", "prompts", "sarah_system_prompt.txt"),
        ]
        prompt_path = None
        for c in candidates:
            if os.path.exists(c):
                prompt_path = c
                break
        if not prompt_path:
            print("ERROR: Could not find sarah_system_prompt.txt")
            sys.exit(1)

    with open(prompt_path) as f:
        content = f.read()

    token_count = count_tokens(content)
    pct = token_count / args.limit * 100

    print(f"File: {prompt_path}")
    print(f"Characters: {len(content):,}")
    print(f"Tokens: {token_count:,} / {args.limit:,} ({pct:.1f}%)")

    if token_count > args.limit:
        print(f"OVER LIMIT by {token_count - args.limit} tokens")
        if args.check:
            sys.exit(1)
    elif token_count > args.limit * 0.9:
        print(f"WARNING: Within 10% of limit ({args.limit - token_count} tokens remaining)")
    else:
        print(f"OK: {args.limit - token_count} tokens remaining")

    return token_count


if __name__ == "__main__":
    main()
