---
name: badge-parity
description: Keep the extension's safety badges, warning texts and scan wording the same as the DeckyHub plugin and deckyhub.com. Use when adding or changing a badge, audit warning code, or scan label.
---

# Badge parity

The extension, the plugin pages on deckyhub.com (`deckyhub-site/devtools/plugin_badges.py` and `scan_format.py`: `badges_of`, `SCAN_LABELS`, `SCAN_RESULTS`) and the app show the same facts in the same words. When one changes, check the others.

- Audit warning codes and their titles live in the `warnings` table in `extension/src/content/badges.ts`; the registry's `audit_rules.py` defines the codes. An unknown code must still render (generic text), never throw.
- Scan wording: Nothing flagged / Threat found / Not fully scanned; "Pre-release:" prefix; every scan badge but Threat found ends "A clean scan isn't proof of safety". Never call a missing report clean.
- Badges: Runs as root, Fork, In Decky store, AI, Rust, audit warnings, scan result. `blocked` is the only danger-level warning.
- The extension adds nothing the site doesn't say, and nothing stronger.

Registry data it reads is described in [registry-data](../registry-data/SKILL.md). Wording changes go through the user, since they speak for the whole project.
