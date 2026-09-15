'use client';
/** Answer-type switcher + "add another option" for the question form. */
import { useEffect } from 'react';

export default function QuestionFormScripts() {
  useEffect(() => {
    const type = document.getElementById('qtype') as HTMLSelectElement | null;
    const optB = document.getElementById('options-block');
    const tfB = document.getElementById('tf-block');
    const list = document.getElementById('opt-list');
    const add = document.getElementById('add-opt');
    if (!type) return;

    const sync = () => { const tf = type.value === 'truefalse'; if (optB) optB.hidden = tf; if (tfB) tfB.hidden = !tf; };
    const onAdd = () => {
      if (!list) return;
      const i = list.children.length;
      const row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '10px';
      row.innerHTML = '<label class="check" style="flex:none"><input type="checkbox" name="correct[]" value="' + i + '"></label>' +
                      '<input class="input" name="options[]" placeholder="Option ' + (i + 1) + '">';
      list.appendChild(row);
    };
    type.addEventListener('change', sync);
    add?.addEventListener('click', onAdd);
    sync();
    return () => { type.removeEventListener('change', sync); add?.removeEventListener('click', onAdd); };
  }, []);
  return null;
}
