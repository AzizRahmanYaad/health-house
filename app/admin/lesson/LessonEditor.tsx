/**
 * The lesson editor screen — shared by /admin/lesson (new) and
 * /admin/lesson/[id] (edit). Ported from admin/lesson_edit.php.
 */
import Link from 'next/link';
import Icon from '@/components/Icon';
import RichEditor from '@/components/RichEditor';
import Shell from '@/components/Shell';
import Uploader from '@/components/Uploader';
import { AlertBox } from '@/components/ui';
import type { User } from '@/lib/auth';
import { MAX_UPLOAD_SIZE } from '@/lib/config';
import { fetchAll, fetchOne, fetchValue, toInt } from '@/lib/db';
import { lessonSubtitle, vttCueCount } from '@/lib/lms';
import { uploadUrl, videoSource } from '@/lib/media';
import { dirOf, humanSize, isRtlText, plainText } from '@/lib/text';
import LessonEditorScripts from './LessonEditorScripts';
import { addMaterial, clearVideo, deleteMaterial, saveLesson, saveSubtitle } from './actions';

export interface LessonRow {
  id: number; subject_id: number; title: string; description: string | null; content: string | null; direction: string;
  video_type: string; video_url: string | null; video_file: string | null; duration_minutes: number; difficulty: string;
  recommended_day: number; is_required: boolean; sort_order: number; is_active: boolean;
}
interface SubjectOpt { id: number; title: string; semester_number: number }
interface Material { id: number; type: string; title: string; file_path: string | null; external_url: string | null; file_size: number }
interface Quiz { id: number; title: string; passing_score: number }

export default async function LessonEditor({ user, lesson, subjectId }: { user: User; lesson: LessonRow | null; subjectId: number }) {
  const lessonId = lesson?.id ?? 0;

  const subjects = await fetchAll<SubjectOpt>(
    `SELECT s.*, sem.number AS semester_number FROM subjects s
       JOIN semesters sem ON sem.id = s.semester_id
      ORDER BY sem.sort_order, sem.number, s.sort_order`);

  const subPs = lessonId ? await lessonSubtitle(lessonId, 'ps') : null;
  const materials = lessonId ? await fetchAll<Material>('SELECT * FROM lesson_materials WHERE lesson_id = ? ORDER BY sort_order, id', [lessonId]) : [];
  const quizzes = lessonId ? await fetchAll<Quiz>('SELECT * FROM quizzes WHERE lesson_id = ? ORDER BY id', [lessonId]) : [];
  const quizQuestionCounts: Record<number, number> = {};
  for (const qz of quizzes) {
    quizQuestionCounts[qz.id] = toInt(await fetchValue('SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=?', [qz.id], 0));
  }
  const nextOrder = toInt(await fetchValue('SELECT COALESCE(MAX(sort_order),0)+1 FROM lessons WHERE subject_id = ?', [subjectId], 1));

  /* which of the three video modes is currently selected */
  const curType = lesson?.video_type ?? 'none';
  let vSource = 'none';
  if (curType === 'file' || (lesson?.video_file && !lesson?.video_url)) vSource = 'file';
  else if (['url', 'youtube', 'vimeo', 'link'].includes(curType) && lesson?.video_url) vSource = 'link';
  const vProbe = lesson ? videoSource(lesson) : { kind: 'none' as const, src: '', provider: '' };

  const dirNow = lesson?.direction ?? 'auto';
  const editorDir: 'auto' | 'ltr' | 'rtl' = dirNow === 'auto'
    ? (isRtlText(`${lesson?.content ?? ''} ${lesson?.title ?? ''}`) ? 'rtl' : 'auto')
    : (dirNow as 'ltr' | 'rtl');

  const stats = lessonId ? (await fetchOne(
    `SELECT COUNT(*) FILTER (WHERE status='completed') AS done, COUNT(*) FILTER (WHERE status='in_progress') AS doing, COUNT(*) AS touched
       FROM lesson_progress WHERE lesson_id = ?`, [lessonId])) ?? { done: 0, doing: 0, touched: 0 } : { done: 0, doing: 0, touched: 0 };

  const materialIcon = (t: string) => ({ pdf: 'file-text', slides: 'slides', document: 'file', link: 'link', audio: 'activity' } as Record<string, string>)[t] ?? 'file';

  return (
    <Shell user={user} title={lesson ? 'Edit lesson' : 'New lesson'} subtitle={lesson ? plainText(lesson.title, 70) : 'Add a lesson to the sequence'}>
      <LessonEditorScripts />

      <Link className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} href={`/admin/lessons?subject=${subjectId}`}>
        <Icon name="arrow-left" className="icon-sm" /> Back to the lesson list
      </Link>

      <div className="split">
        <div className="stack">

          {/* ============ MAIN FORM ============ */}
          <form className="card card--pad-lg" action={saveLesson} encType="multipart/form-data" id="lesson-form">
            <input type="hidden" name="id" value={lessonId || ''} />
            <input type="hidden" name="video_file_name" id="video_file_name" defaultValue={lesson?.video_file ?? ''} />

            <div className="card__head"><h2 className="card__title">Lesson details</h2></div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="subject_id">Subject</label>
                <select className="select" id="subject_id" name="subject_id" required defaultValue={lesson?.subject_id ?? subjectId}>
                  {subjects.map(s => <option key={s.id} value={s.id}>S{s.semester_number} · {s.title}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="direction">Text direction for students</label>
                <select className="select" id="direction" name="direction" defaultValue={dirNow}>
                  <option value="auto">Automatic — detect from the text</option>
                  <option value="rtl">Right to left — پښتو / دری / عربي</option>
                  <option value="ltr">Left to right — English</option>
                </select>
                <div className="hint">Controls how the lesson is displayed in the student portal.</div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="title">Lesson title</label>
              <input className="input" id="title" name="title" dir="auto" defaultValue={lesson?.title ?? ''}
                     placeholder="The Skeletal System / د هډوکو سیسټم" required />
            </div>

            <div className="field">
              <label>Introduction <span className="dim" style={{ fontWeight: 500 }}>— a short summary shown in lesson lists</span></label>
              <RichEditor name="description" value={lesson?.description ?? ''} toolbar="mini" dir={editorDir} counter={false}
                          placeholder="One or two sentences introducing this lesson…" />
            </div>

            <div className="field">
              <label>Lesson details <span className="dim" style={{ fontWeight: 500 }}>— the full text students read</span></label>
              <RichEditor name="content" value={lesson?.content ?? ''} toolbar="full" dir={editorDir}
                          placeholder="Write the full lesson here. Use the toolbar for headings, bold, colours, lists and right-to-left paragraphs…" />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="duration_minutes">Duration (minutes)</label>
                <input className="input" type="number" id="duration_minutes" name="duration_minutes" min={0} defaultValue={lesson?.duration_minutes ?? 20} />
              </div>
              <div className="field">
                <label htmlFor="recommended_day">Recommended day</label>
                <input className="input" type="number" id="recommended_day" name="recommended_day" min={1} defaultValue={lesson?.recommended_day ?? 1} />
                <div className="hint">Guidance only — never blocks access.</div>
              </div>
              <div className="field">
                <label htmlFor="sort_order">Order in sequence</label>
                <input className="input" type="number" id="sort_order" name="sort_order" defaultValue={lesson?.sort_order ?? nextOrder} />
              </div>
            </div>

            <div className="row" style={{ gap: 22, marginBottom: 20 }}>
              <label className="check"><input type="checkbox" name="is_required" value="1" defaultChecked={!lesson || lesson.is_required} /> Required lesson</label>
              <label className="check"><input type="checkbox" name="is_active" value="1" defaultChecked={!lesson || lesson.is_active} /> Visible to students</label>
            </div>

            {/* ------------------------- VIDEO ------------------------- */}
            <h3 style={{ fontSize: '1.05rem', margin: '28px 0 16px', paddingTop: 22, borderTop: '1px solid var(--line)' }}>
              <Icon name="video" className="icon-sm" /> Lesson video
            </h3>

            <div className="field">
              <label htmlFor="video_source">Where does the video come from?</label>
              <select className="select" id="video_source" name="video_source" defaultValue={vSource}>
                <option value="none">No video for this lesson</option>
                <option value="file">Upload a video file to this server</option>
                <option value="link">Use a link (YouTube, Vimeo, Google Drive, direct .mp4)</option>
              </select>
            </div>

            <div className="field" id="video-link-field" hidden>
              <label htmlFor="video_url">Video address</label>
              <div className="input-icon">
                <Icon name="link" />
                <input className="input" id="video_url" name="video_url" dir="ltr" defaultValue={lesson?.video_url ?? ''} placeholder="https://www.youtube.com/watch?v=…" />
              </div>
              <div className="hint" id="link-hint">
                Paste the address exactly as you copied it. YouTube (including <code>youtu.be</code> and Shorts), Vimeo, Google Drive share links
                and direct <code>.mp4</code> / <code>.webm</code> addresses all play inside the student portal — you do not need to choose the provider.
              </div>
              <div id="link-preview" style={{ marginTop: 14 }}></div>
            </div>

            <div id="video-upload-field" hidden>
              <Uploader kind="videos" target="#video_file_name" nameOut="#video-current-name" inputName="video_file"
                        accept="video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi" cancel
                        zone={<>
                          <div className="uploader__icon"><Icon name="upload" /></div>
                          <b>Click to choose a video, or drag it here</b>
                          <span className="small">MP4, WebM, MOV, M4V, MKV or AVI — up to {humanSize(MAX_UPLOAD_SIZE)}</span>
                        </>}
                        preview={<>
                          <div className="uploader__preview" data-preview hidden={!lesson?.video_file}>
                            {lesson?.video_file ? <video controls preload="metadata" playsInline src={uploadUrl('videos/' + lesson.video_file)} style={{ width: '100%', borderRadius: 14, background: '#000' }}></video> : null}
                          </div>
                          {lesson?.video_file ? (
                            <div className="alert alert-success" style={{ margin: '14px 0 0' }}>
                              <Icon name="check-circle" />
                              <div>Current file: <b id="video-current-name">{lesson.video_file}</b><br /><span className="tiny">Upload another file to replace it.</span></div>
                            </div>
                          ) : <div className="hidden-name" hidden><span id="video-current-name"></span></div>}
                        </>} />

              <div className="alert alert-info" style={{ marginTop: 14 }}>
                <Icon name="info" />
                <div>The file is sent in <b>2 MB pieces</b>, so large videos are not affected by request-size limits. Wait for <b>Uploaded ✓</b> before saving the lesson.</div>
              </div>
            </div>

            <div className="row between" style={{ marginTop: 24 }}>
              <button className="btn btn-primary btn-lg" type="submit">
                <Icon name="save" className="icon-sm" /> {lesson ? 'Save lesson' : 'Create lesson'}
              </button>
              {lesson && (lesson.video_file || lesson.video_url) ? (
                <button className="btn btn-danger btn-sm" type="submit" form="clear-video" data-confirm="Remove the video from this lesson?">
                  <Icon name="trash" className="icon-sm" /> Remove video
                </button>
              ) : null}
            </div>
          </form>

          {lesson ? (
            <>
              <form action={clearVideo} id="clear-video" style={{ display: 'none' }}><input type="hidden" name="id" value={lessonId} /></form>

              {/* ============ PASHTO SUBTITLES ============ */}
              <section className="card card--pad-lg">
                <div className="card__head">
                  <h2 className="card__title"><Icon name="message" className="icon-sm" /> Pashto subtitles</h2>
                  {subPs ? <span className="badge badge-teal">{vttCueCount(subPs.vtt)} caption lines</span> : <span className="badge badge-amber">None yet</span>}
                </div>

                {vProbe.kind === 'video' ? (
                  <AlertBox type="success"><b>This lesson uses a video file, so Pashto captions appear inside the player itself</b> (a real <code>&lt;track&gt;</code> element), and also as a clickable transcript under the video.</AlertBox>
                ) : vProbe.kind === 'iframe' ? (
                  <AlertBox type="warning"><b>This lesson uses an embedded player (YouTube, Vimeo or Drive).</b> A third-party player will not accept a caption file from us — only the video owner can add captions there. The portal therefore shows your Pashto text as a <b>synchronised caption bar over the video plus a clickable transcript</b>, and asks YouTube to switch on Pashto captions if the owner published any. To get captions burned into the player itself, upload the video file to this server instead.</AlertBox>
                ) : (
                  <AlertBox type="info">Add a video to this lesson first — captions need something to play against.</AlertBox>
                )}

                <form action={saveSubtitle} encType="multipart/form-data" style={{ marginTop: 6 }}>
                  <input type="hidden" name="id" value={lessonId} />
                  <input type="hidden" name="sub_lang" value="ps" />
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="sub_label">Track name shown to students</label>
                      <input className="input" id="sub_label" name="sub_label" dir="auto" defaultValue={subPs?.label ?? 'پښتو'} />
                    </div>
                    <div className="field">
                      <label>Or upload a .vtt / .srt file</label>
                      <input className="input" type="file" name="sub_file" accept=".vtt,.srt,.txt" />
                      <div className="hint">A SubRip (.srt) file is converted to WebVTT automatically.</div>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="sub_vtt">Caption text (WebVTT)</label>
                    <textarea className="input vtt-editor" id="sub_vtt" name="sub_vtt" defaultValue={subPs?.vtt ?? ''}
                              placeholder={'WEBVTT\n\n00:00:00.000 --> 00:00:06.000\nسلام، په دې لوست کې به د هډوکو سیسټم زده کړو.\n\n00:00:06.000 --> 00:00:12.500\nلومړی به د لګن جوړښت وګورو.'}></textarea>
                    <div className="hint vtt-hint">
                      One block per caption: a timing line <code>00:00:05.000 --&gt; 00:00:09.000</code>, the Pashto text on the next line, then a blank line. Leave the box empty and save to remove the track.
                    </div>
                  </div>
                  <div className="row between">
                    <button className="btn btn-primary" type="submit"><Icon name="save" className="icon-sm" /> Save Pashto subtitles</button>
                    {subPs ? <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener" href={`/api/subtitle?lesson=${lessonId}&lang=ps`}><Icon name="external" className="icon-sm" /> View the .vtt file</a> : null}
                  </div>
                </form>
              </section>

              {/* ============ MATERIALS ============ */}
              <section className="card card--pad-lg">
                <div className="card__head"><h2 className="card__title">Learning materials</h2><span className="badge badge-brand">{materials.length}</span></div>

                {materials.length ? (
                  <div className="stack" style={{ gap: 9, marginBottom: 22 }}>
                    {materials.map(m => (
                      <div key={m.id} className="material">
                        <span className={`material__icon ${m.type}`}><Icon name={materialIcon(m.type)} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: '.9rem', display: 'block' }} dir={dirOf(m.title)}>{m.title}</b>
                          <span className="tiny dim">{m.type.toUpperCase()}{m.file_size ? ' · ' + humanSize(m.file_size) : ''}</span>
                        </span>
                        <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener" href={m.external_url || uploadUrl(m.file_path)}><Icon name="eye" className="icon-sm" /></a>
                        <form action={deleteMaterial} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={lessonId} />
                          <input type="hidden" name="material_id" value={m.id} />
                          <button className="btn btn-danger btn-sm" type="submit" data-confirm="Remove this material?"><Icon name="trash" className="icon-sm" /></button>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : null}

                <form action={addMaterial} encType="multipart/form-data" style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
                  <input type="hidden" name="id" value={lessonId} />
                  <input type="hidden" name="material_file_name" id="material_file_name" />
                  <input type="hidden" name="material_folder" id="material_folder" defaultValue="pdfs" />

                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="material_type">Type</label>
                      <select className="select" id="material_type" name="material_type" defaultValue="pdf">
                        <option value="pdf">PDF</option>
                        <option value="slides">Slides (PPT / PPTX)</option>
                        <option value="document">Document</option>
                        <option value="audio">Audio</option>
                        <option value="link">External link</option>
                        <option value="other">Other file</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="material_title">Title</label>
                      <input className="input" id="material_title" name="material_title" dir="auto" placeholder="Skeletal system handout" />
                    </div>
                  </div>

                  <div className="field" id="material-file-field">
                    <label>File</label>
                    <Uploader kind="pdfs" target="#material_file_name" id="material-uploader" inputName="material_file" compact
                              zone={<div className="row" style={{ gap: 10, justifyContent: 'center' }}><Icon name="upload" className="icon-sm" /><span>Click or drop a file here</span></div>} />
                  </div>

                  <div className="field" id="material-url-field" hidden>
                    <label htmlFor="material_url">Link address</label>
                    <input className="input" id="material_url" name="material_url" dir="ltr" placeholder="https://…" />
                  </div>

                  <button className="btn btn-dark" type="submit"><Icon name="plus" className="icon-sm" /> Attach material</button>
                </form>
              </section>
            </>
          ) : null}
        </div>

        {/* ============ SIDE ============ */}
        <aside className="stack">
          {lesson ? (
            <>
              <div className="card">
                <div className="card__head"><h3 className="card__title">Current video</h3></div>
                {vProbe.kind === 'none' ? <p className="small muted">No video attached to this lesson.</p> : (
                  <>
                    <div className="row row-tight" style={{ marginBottom: 12 }}>
                      <span className="badge badge-brand">{vProbe.provider || 'Video'}</span>
                      <span className={`badge ${vProbe.kind === 'link' ? 'badge-amber' : 'badge-teal'}`}>{vProbe.kind === 'link' ? 'Opens as a link' : 'Plays in the portal'}</span>
                    </div>
                    <div className="player" style={{ aspectRatio: '16/9', borderRadius: 'var(--r-md)' }}>
                      {vProbe.kind === 'iframe' ? (
                        <iframe src={vProbe.src} allowFullScreen loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"></iframe>
                      ) : vProbe.kind === 'video' ? (
                        <video controls preload="metadata" playsInline src={vProbe.src}></video>
                      ) : (
                        <div className="player__link">
                          <Icon name="link" /><b>Unrecognised host</b>
                          <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener" href={vProbe.src}>Open</a>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="card">
                <div className="card__head"><h3 className="card__title">Quizzes on this lesson</h3></div>
                {quizzes.length ? (
                  <div className="stack" style={{ gap: 9 }}>
                    {quizzes.map(qz => (
                      <Link key={qz.id} className="row between" href={`/admin/quiz/${qz.id}`} style={{ gap: 10 }}>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ fontSize: '.87rem', display: 'block' }}>{qz.title}</b>
                          <span className="tiny dim">Pass {qz.passing_score}% · {quizQuestionCounts[qz.id] ?? 0} questions</span>
                        </span>
                        <Icon name="chevron-right" className="icon-sm" />
                      </Link>
                    ))}
                  </div>
                ) : <p className="small muted">No quiz attached yet.</p>}
                <Link className="btn btn-soft btn-sm btn-block" style={{ marginTop: 14 }} href={`/admin/quiz?lesson=${lesson.id}`}><Icon name="plus" className="icon-sm" /> Add a quiz</Link>
              </div>

              <div className="card">
                <div className="card__head"><h3 className="card__title">Student progress</h3></div>
                <div className="stack" style={{ gap: 11 }}>
                  <div className="row between"><span className="small muted">Completed by</span><b>{toInt(stats.done)} students</b></div>
                  <div className="row between"><span className="small muted">Currently studying</span><b>{toInt(stats.doing)}</b></div>
                  <div className="row between"><span className="small muted">Ever opened</span><b>{toInt(stats.touched)}</b></div>
                </div>
                <a className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 14 }} target="_blank" href={`/student/lesson/${lesson.id}`}><Icon name="external" className="icon-sm" /> Preview as student</a>
              </div>
            </>
          ) : null}

          <div className="card" style={{ borderLeft: '4px solid var(--brand)' }}>
            <b style={{ fontSize: '.9rem' }}>Writing in Pashto or Dari</b>
            <ul className="small muted" style={{ paddingLeft: '1.1em', margin: '10px 0 0', lineHeight: 1.85 }}>
              <li>Type normally — the editor detects the script automatically.</li>
              <li>Use the <b>⇤ / ⇥</b> toolbar buttons to force a single paragraph right-to-left or left-to-right.</li>
              <li>Set <b>Text direction</b> above to <b>Right to left</b> to force the whole lesson RTL for students.</li>
              <li>Bold, colours, headings, lists and alignment all work in both directions.</li>
            </ul>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
            <b style={{ fontSize: '.9rem' }}>Sequence tips</b>
            <ul className="small muted" style={{ paddingLeft: '1.1em', margin: '10px 0 0', lineHeight: 1.85 }}>
              <li><b>Order</b> decides what students see next.</li>
              <li><b>Recommended day</b> builds the daily plan.</li>
              <li>Hidden lessons disappear from the student view and from all progress calculations.</li>
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
