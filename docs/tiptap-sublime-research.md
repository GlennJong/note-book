# Tiptap Sublime Text Keybindings Research

## 1. Existing Tiptap Extension for Sublime Text Keymaps
There is no official or widely-maintained "Sublime Text Keymap" extension for Tiptap or ProseMirror that provides a drop-in replacement for all Sublime Text shortcuts. 

However, Tiptap's `KeyboardShortcuts` extension (part of the core) allows you to easily define custom keybindings. ProseMirror also has a `prosemirror-keymap` package which is what Tiptap uses under the hood.

Most developers implement the specific shortcuts they need manually using `addKeyboardShortcuts()`.

## 2. Multi-Cursor Editing Support
**True multi-cursor editing (simultaneous typing at multiple locations) for a single user is NOT natively supported in Tiptap or ProseMirror.**

ProseMirror's state model assumes a single `Selection` object (which can be a `TextSelection` or `NodeSelection`). While you can create custom Selection classes, the entire editor ecosystem (transactions, steps, collaborative editing) is built around a single selection range.

Achieving multi-cursor behavior requires:
-   Creating a custom `Selection` class that holds multiple ranges.
-   Handling transactions to update all ranges simultaneously.
-   Handling extensive edge cases for typing, deletion, and navigation.

There are some experimental plugins in the ProseMirror community (e.g., `prosemirror-multiselect`), but they are often limited to block selection or specific use cases and are not production-ready for general multi-caret typing.

**Recommendation:** Do not attempt to implement full multi-cursor editing unless it is a critical requirement, as it involves fighting the core architecture of ProseMirror.

## 3. Implementing Sublime Text Shortcuts
While full multi-cursor is hard, many of Sublime Text's most useful line manipulation shortcuts can be easily implemented.

We have created a custom extension demonstrating this in `src/common/tiptap-sublime-keymap.ts`.

### Implemented Shortcuts:
-   **Duplicate Line**: `Shift-Ctrl-D` (Windows/Linux) / `Shift-Cmd-D` (Mac)
-   **Delete Line**: `Ctrl-Shift-K` (Windows/Linux) / `Cmd-Shift-K` (Mac)
-   **Select Line**: `Ctrl-L` (Windows/Linux) / `Cmd-L` (Mac)

### Usage
To use these shortcuts, add the exported `SublimeKeymap` extension to your editor configuration in `src/screen/MainLayout-note.tsx`:

```typescript
import { SublimeKeymap } from '../common/tiptap-sublime-keymap';

// ... inside useEditor
extensions: [
  // ... other extensions
  SublimeKeymap,
]
```

This will enable the Sublime-style line manipulation shortcuts in your editor.
