import type { ReactNode } from 'react';
import Icon from './Icon';

/**
 * Chunked file uploader (drop zone + progress bar). public/js/hh-uploader.js
 * sends the file in 2 MB pieces to /api/upload and writes the finished
 * file name into the hidden input named by `target`.
 */
export default function Uploader({ kind, target, nameOut, id, inputName, accept, zone, preview, compact = false, cancel = false }:
  { kind: 'videos' | 'pdfs' | 'slides' | 'resources'; target: string; nameOut?: string; id?: string;
    inputName: string; accept?: string; zone: ReactNode; preview?: ReactNode; compact?: boolean; cancel?: boolean }) {
  return (
    <div className="uploader" data-uploader data-endpoint="/api/upload" data-kind={kind}
         data-target={target} data-name-out={nameOut} id={id}>
      <input type="file" name={inputName} accept={accept} hidden />
      <div className="uploader__zone" data-drop style={compact ? { padding: 18 } : undefined}>{zone}</div>
      <div className="uploader__bar" data-bar hidden>
        <div className={compact ? 'bar' : 'bar bar-lg'}><div className="bar__fill" data-fill style={{ width: 0 }}></div></div>
      </div>
      <div className="uploader__status" data-status></div>
      {cancel ? (
        <button className="btn btn-ghost btn-sm" type="button" data-cancel hidden style={{ marginTop: 10 }}>
          <Icon name="x" className="icon-sm" /> Cancel upload
        </button>
      ) : null}
      {preview}
    </div>
  );
}
