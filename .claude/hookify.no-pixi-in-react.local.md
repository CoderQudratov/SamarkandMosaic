---
name: no-pixi-in-react
enabled: true
event: file
pattern: from ['"]pixi\.js['"]
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/components/|src/app/App\.tsx
---

🚫 **Architecture Violation: Pixi import in React layer**

You are importing from `pixi.js` inside a React component or the App shell.

**Rule:** React must never touch Pixi objects directly.

**Fix:**
- Move Pixi logic to `src/game/` (board, pieces, systems, scenes, effects)
- React components only read from Zustand stores
- Use `gameManager`, `effectManager`, or `audioManager` methods from `src/game/`

**The React layer only:** reads stores, renders DOM, calls manager methods.
