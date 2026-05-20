---
name: visual-baseline-debug
description: Triage WinUI screenshot or visual mismatches for WSA Manager, with a bias toward deterministic evidence instead of blind refreshes.
---

# Visual Baseline Debug

1. Validate against the unpacked build only. Do not compare the installed app copy.
2. Build with `dotnet build WsaManager.Native.sln -p:Platform=x64` before visual review.
3. Reproduce in the WinUI app before updating any screenshots or mock references.
4. Treat mismatches as determinism issues first. Check for:
   - timestamps or relative-time labels
   - build labels or version strings
   - diagnostics log clocks
   - endpoint text and other live machine data
   - font or text-density drift on GitHub Windows runners
5. Prefer targeted masks and narrow page-specific tolerances for dynamic regions over full-page baseline refreshes.
6. Use stronger DOM assertions when a screenshot gets a higher tolerance so layout intent stays covered.
7. Refresh a baseline only after proving the visual change is intentional and stable.
8. Report which screenshot failed, whether the drift was local-only or GitHub-only, and what determinism fix was chosen.
