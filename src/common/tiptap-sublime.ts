import { Extension } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export const SublimeKeymap = Extension.create({
  name: 'sublimeKeymap',

  addKeyboardShortcuts() {
    return {
      // Duplicate Line: Ctrl+Shift+D (Cmd+Shift+D on Mac)
      'Mod-Shift-d': ({ editor }) => {
        const { state, dispatch } = editor.view;
        const { selection } = state;
        const { $from } = selection;
        
        if ($from.depth < 1) return false;

        const pos = $from.before(1);
        const node = state.doc.nodeAt(pos);
        
        if (node && dispatch) {
            // Insert a copy of the node after itself
            const tr = state.tr.insert(pos + node.nodeSize, node); 
            dispatch(tr);
            return true;
        }
        return false;
      },

      // Delete Line: Ctrl+Shift+K (Cmd+Shift+K on Mac)
      'Mod-Shift-k': ({ editor }) => {
        const { state, dispatch } = editor.view;
        const { selection } = state;
        const { $from } = selection;
        
        if ($from.depth < 1) return false;

        // Delete the entire node at current depth 1 (block)
        const start = $from.before(1);
        const end = $from.after(1);
        
        if (dispatch) {
            dispatch(state.tr.delete(start, end));
            return true;
        }
        return false;
      },

      // Select Line: Ctrl+L (Cmd+L on Mac)
      'Mod-l': ({ editor }) => {
        const { state, dispatch } = editor.view;
        const { selection } = state;
        const { $from } = selection;
        
        if ($from.depth < 1) return false;

        // Select the text content of the block
        const start = $from.start(1);
        const end = $from.end(1);
        
        if (dispatch) {
            const tr = state.tr.setSelection(TextSelection.create(state.doc, start, end));
            dispatch(tr);
            return true;
        }
        return false;
      }
    };
  },
});
