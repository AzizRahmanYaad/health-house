/**
 * Rich text editor field — the richEditor() component of the PHP portal.
 * public/js/hh-editor.js builds the toolbar and keeps the hidden textarea
 * (which carries the form field name) in sync with the contenteditable area.
 */
export default function RichEditor({ name, value, toolbar = 'full', dir = 'auto', placeholder = '', height, counter = true }:
  { name: string; value?: string | null; toolbar?: 'full' | 'mini'; dir?: 'auto' | 'ltr' | 'rtl'; placeholder?: string; height?: number; counter?: boolean }) {
  return (
    <div className={`rte${toolbar === 'mini' ? ' rte--mini' : ''}`} data-rte data-toolbar={toolbar}>
      <div className="rte__bar"></div>
      <div className="rte__area" contentEditable suppressContentEditableWarning spellCheck dir={dir}
           data-placeholder={placeholder} style={height ? { minHeight: height } : undefined}></div>
      <textarea className="rte__src" name={name} hidden defaultValue={value ?? ''}></textarea>
      {counter ? (
        <div className="rte__foot">
          <span data-rte-count>0 characters</span>
          <span>Use the ⇤ / ⇥ buttons for Pashto (right-to-left) paragraphs</span>
        </div>
      ) : null}
    </div>
  );
}
