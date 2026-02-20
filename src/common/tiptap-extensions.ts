import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const TagHighlight = Extension.create<{ onTagClick: (tag: string) => void }>({
  name: 'tagHighlight',

  addProseMirrorPlugins() {
    const { onTagClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('tag-highlight'),
        props: {
            decorations(state) {
                const decorations: Decoration[] = [];
                const doc = state.doc;
            
                doc.descendants((node, pos) => {
                  if (node.isText) {
                    const text = node.text || '';
                    // Regex for #tag (supports unicode letters/numbers/underscore)
                    const regex = /#[\p{L}\p{N}_]+/gu;
                    let match;
    
                    while ((match = regex.exec(text)) !== null) {
                      const from = pos + match.index;
                      const to = from + match[0].length;
                      
                      decorations.push(
                        Decoration.inline(from, to, {
                          class: 'hashtag-highlight',
                          'data-tag': match[0],
                          style: 'color: var(--primary); font-weight: bold; background-color: var(--primary-bg-subtle); padding: 0 4px; border-radius: 4px; cursor: pointer;'
                        })
                      );
                    }
                  }
                });
            
                return DecorationSet.create(doc, decorations);
              },
              handleClick(_view, _pos, event) {
                 const target = event.target as HTMLElement;
                 // Check if clicked element is a hashtag
                 // Note: Tiptap/ProseMirror handles events. If we return true, other handlers might be blocked.
                 if (target && target.classList.contains('hashtag-highlight')) {
                    const tag = target.getAttribute('data-tag');
                    if (tag && onTagClick) {
                        onTagClick(tag);
                        return false; // Allow default behavior (cursor placement) but trigger action
                    }
                 }
                 return false;
              }
        },
      }),
    ];
  },
});
