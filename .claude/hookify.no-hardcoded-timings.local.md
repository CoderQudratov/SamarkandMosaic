---
name: no-hardcoded-timings
enabled: true
event: file
pattern: duration:\s*0\.\d+|duration:\s*\d+\.\d+
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/(?!constants/).*\.(ts|tsx)$
---

🚫 **Architecture Violation: Hardcoded animation duration**

A numeric duration was written outside `src/constants/timings.ts`.

**Rule:** No hardcoded animation durations anywhere except `src/constants/timings.ts`.

**Fix:**
```ts
// ❌ Wrong
gsap.to(sprite, { duration: 0.18 });

// ✅ Correct
import { TIMINGS } from '@/constants';
gsap.to(sprite, { duration: TIMINGS.snapEffect });
```
