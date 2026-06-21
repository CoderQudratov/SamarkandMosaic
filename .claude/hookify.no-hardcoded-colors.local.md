---
name: no-hardcoded-colors
enabled: true
event: file
pattern: "#[0-9A-Fa-f]{3,6}(?![0-9A-Fa-f])|0x[0-9A-Fa-f]{6}"
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/(?!constants/).*\.(ts|tsx)$
---

🚫 **Architecture Violation: Hardcoded color value**

A hex color was written outside `src/constants/colors.ts`.

**Rule:** No hardcoded colors anywhere except `src/constants/colors.ts`.

**Fix:**
```ts
// ❌ Wrong
sprite.tint = 0xd4af37;
style={{ color: '#D4AF37' }}

// ✅ Correct
import { COLORS_HEX } from '@/constants';
sprite.tint = COLORS_HEX.gold;
style={{ color: COLORS.gold }}
```
