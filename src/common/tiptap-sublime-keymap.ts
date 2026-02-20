import { Extension } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export const SublimeKeymap = Extension.create({
  name: 'sublimeKeymap',

  addKeyboardShortcuts() {
    return {
      // Duplicate Line: Shift + Ctrl + D (Windows/Linux)
      'Shift-Control-d': ({ editor }) => {
        const { state, view } = editor;
        const { selection, doc } = state;
        const { $from, $to } = selection;
        
        // Find start and end of the block(s) covered by selection
        // In ProseMirror, 'blocks' are usually paragraphs. This duplicates text blocks.
        // We use the depth of the selection start to find the enclosing block.
        // Usually depth 1 is the paragraph inside the doc.
        const start = $from.start(1);
        const end = $to.end(1);
        
        // Get the node at start (the paragraph/block)
        // We can create a slice of the document for this range
        // const slice = doc.slice(start, end);
        
        // Insert the slice content after the end of the block
        // The end position is inside the node, so end + 1 is after the node.
        const posAfter = end + 1; 
        
        // We need to insert a full block. slice.content is just the inline content.
        // If we want to duplicate the structure (e.g. paragraph), we need the wrapping node.
        // However, inserting content into a position between blocks will create a new block usually?
        // No, insert(pos, content) inserts content at pos. If pos is between blocks, it tries to fit content there.
        // If content is inline (text), it might merge with previous block? No, between blocks is block context.
        // If we insert inline content at block context, it wraps in default block.
        
        // Better approach: Get the full node at the position.
        const node = doc.nodeAt(start - 1);
        if (!node) return false;
        
        const nodeCopy = node.type.create(node.attrs, node.content);
        
        // Insert the node copy after the current node
        const tr = state.tr.insert(posAfter, nodeCopy);
        
        if (view.dispatch) {
            view.dispatch(tr);
            return true;
        }
        return false;
      },
      // Mac alias for Duplicate Line
      'Shift-Cmd-d': ({ editor }) => {
         // Re-use logic
         return editor.commands.keyboardShortcut('Shift-Control-d');
      },

      // Delete Line: Ctrl + Shift + K (Windows/Linux)
      'Control-Shift-k': ({ editor }) => {
         const { state, view } = editor;
         const { selection } = state;
         const { $from, $to } = selection;
         
         // Select the whole block(s)
         const start = $from.start(1) - 1; 
         const end = $to.end(1) + 1;
         
         if (view.dispatch) {
             view.dispatch(state.tr.delete(start, end));
             return true;
         }
         return false;
      },
       // Mac alias
      'Cmd-Shift-k': ({ editor }) => {
          return editor.commands.keyboardShortcut('Control-Shift-k');
      },

      // Select Line: Ctrl + L
      'Control-l': ({ editor }) => {
          const { state, view } = editor;
          const { selection, doc } = state;
          const { $from } = selection;
          
          const depth = 1; // Paragraph level
          // start of the block content
          const start = $from.start(depth);
          // end of the block content
          const end = $from.end(depth);
          
          if (view.dispatch) {
              const tr = state.tr.setSelection(TextSelection.create(doc, start, end));
              view.dispatch(tr);
              return true;
          }
          return false;
      },
       // Mac alias
      'Cmd-l': ({ editor }) => {
          return editor.commands.keyboardShortcut('Control-l');
      },
    };
  },
});
