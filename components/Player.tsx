'use client';
// One renderer for preview and export. Rendered clips are drawn as video; scenes
// without a clip are drawn as a storyboard animatic and labelled as such.
import { useEffect, useRef, useState } from 'react';

export interface PScene { id: string; n: number; beat?: string; title: string; seconds: number; visual: string; camera?: string; narration?: string; onscreen?: string; lower_third?: string; status?: string; clip_url?: string | null; voice_url?: string | null; has_audio?: boolean }
const SIZE: Record<string, [number, number]> = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080] };
const PALETTES = [['#1b2a52', '#e3b24c'], ['#3a1d4e', '#f08a5d'], ['#0f3b46', '#7fd6c2'], ['#40201d', '#f0c466'], ['#1d2f25', '#b8d67a'], ['#27224f', '#8fa8ff']];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/), lines: string[] = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\W*\w+$/, '…'); }
  return lines;
}

export default function Player({ scenes, aspect = '16:9', title, synthetic = true, onScene, music }: { scenes: PScene[]; aspect?: string; title: string; synthetic?: boolean; onScene?: (id: string) => void; music?: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const st = useRef({ i: 0, t: 0, last: 0, playing: false, spoke: -1 });
  const vids = useRef<Record<string, HTMLVideoElement>>({}), audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false), [idx, setIdx] = useState(0), [captions, setCaptions] = useState(true), [voice, setVoice] = useState(true), [rec, setRec] = useState<'idle' | 'recording' | 'done'>('idle'), [file, setFile] = useState('');
  const opts = useRef({ captions, voice, scenes }); opts.current = { captions, voice, scenes };
  const [W, H] = SIZE[aspect] || SIZE['16:9'];
  const recorder = useRef<MediaRecorder | null>(null);
  // Web Audio graph: every sound goes to the speakers and, while exporting, into the recording.
  const mix = useRef<{ ctx: AudioContext; out: GainNode; rec: MediaStreamAudioDestinationNode | null; wired: WeakSet<HTMLMediaElement> } | null>(null);
  const tune = useRef<HTMLAudioElement | null>(null);
  function graph() {
    if (!mix.current) { try { const ctx = new AudioContext(), out = ctx.createGain(); out.connect(ctx.destination); mix.current = { ctx, out, rec: null, wired: new WeakSet() }; } catch { return null; } }
    mix.current.ctx.resume().catch(() => {});
    return mix.current;
  }
  function wire(el: HTMLMediaElement, gain = 1) {
    const g = graph(); if (!g || g.wired.has(el)) return;
    try { const src = g.ctx.createMediaElementSource(el), vol = g.ctx.createGain(); vol.gain.value = gain; src.connect(vol); vol.connect(g.out); g.wired.add(el); } catch { /* plays directly instead */ }
  }

  useEffect(() => { // preload rendered clips
    for (const s of scenes) if (s.clip_url && vids.current[s.id]?.src !== s.clip_url) { const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.muted = !s.has_audio; v.playsInline = true; v.preload = 'auto'; v.src = s.clip_url; vids.current[s.id] = v; }
  }, [scenes]);

  function draw(now: number) {
    const c = canvas.current, s = st.current, list = opts.current.scenes; if (!c || !list.length) return;
    const ctx = c.getContext('2d')!; const sc = list[Math.min(s.i, list.length - 1)];
    if (s.playing) { s.t += (now - s.last) / 1000; }
    s.last = now;
    if (s.t >= sc.seconds) {
      if (s.i < list.length - 1) { s.i++; s.t = 0; setIdx(s.i); onScene?.(list[s.i].id); }
      else { s.playing = false; s.t = sc.seconds; setPlaying(false); stopAudio(); tune.current?.pause(); if (recorder.current?.state === 'recording') recorder.current.stop(); }
    }
    const cur = list[s.i], p = Math.min(1, s.t / cur.seconds), u = (W / 1280) * (aspect === '9:16' ? 2.1 : aspect === '1:1' ? 1.5 : 1.4);
    const v = vids.current[cur.id];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (cur.clip_url && v && v.readyState >= 2) {
      if (s.playing && v.paused) { if (cur.has_audio) wire(v); v.currentTime = Math.min(s.t, Math.max(0, (v.duration || cur.seconds) - 0.1)); v.play().catch(() => {}); }
      if (!s.playing && !v.paused) v.pause();
      const r = Math.max(W / v.videoWidth, H / v.videoHeight), dw = v.videoWidth * r, dh = v.videoHeight * r; // cover fit; this is how square and vertical reframes are produced
      ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const [a, b] = PALETTES[hash(cur.id) % PALETTES.length], z = 1 + p * 0.08;
      const g = ctx.createRadialGradient(W * (0.3 + 0.4 * p), H * 0.35, 20, W / 2, H / 2, Math.max(W, H) * 0.8 * z); g.addColorStop(0, a); g.addColorStop(1, '#05070d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.16; ctx.strokeStyle = b; ctx.lineWidth = 2 * u; // slow light sweeps suggest camera motion
      for (let k = 0; k < 7; k++) { const y = H * (0.15 + k * 0.12) + Math.sin(now / 1900 + k) * 14 * u; ctx.beginPath(); ctx.moveTo(-50, y + 60 * u); ctx.bezierCurveTo(W * 0.3, y - 90 * u * z, W * 0.6, y + 90 * u, W + 50, y - 40 * u); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const pad = 64 * u; ctx.textBaseline = 'top'; ctx.fillStyle = b; ctx.font = `700 ${15 * u}px Manrope, sans-serif`;
      ctx.fillText(`SCENE ${cur.n}${cur.beat ? '  ·  ' + cur.beat.toUpperCase() : ''}`, pad, pad);
      ctx.fillStyle = '#f3f4f8'; ctx.font = `${44 * u}px Marcellus, Georgia, serif`;
      let y = pad + 34 * u; for (const l of wrap(ctx, cur.title, W - pad * 2, 2)) { ctx.fillText(l, pad, y); y += 54 * u; }
      ctx.fillStyle = 'rgba(232,235,245,0.78)'; ctx.font = `${21 * u}px Manrope, sans-serif`; y += 10 * u;
      for (const l of wrap(ctx, cur.visual, W - pad * 2, aspect === '16:9' ? 4 : 8)) { ctx.fillText(l, pad, y); y += 31 * u; }
      if (cur.camera) { ctx.fillStyle = b; ctx.font = `600 ${16 * u}px Manrope, sans-serif`; ctx.fillText(`Camera: ${cur.camera}`.slice(0, 90), pad, y + 12 * u); }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `600 ${13 * u}px Manrope, sans-serif`; ctx.textAlign = 'right'; ctx.fillText('STORYBOARD ANIMATIC', W - pad, pad); ctx.textAlign = 'left';
    }
    const vg = ctx.createLinearGradient(0, H * 0.55, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)'); ctx.fillStyle = vg; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.textBaseline = 'alphabetic';
    if (cur.lower_third) { const pad = 48 * u, bw = Math.min(W - pad * 2, 640 * u), by = H - 190 * u; ctx.fillStyle = 'rgba(9,12,22,0.86)'; ctx.fillRect(pad, by, bw, 50 * u); ctx.fillStyle = '#e3b24c'; ctx.fillRect(pad, by, 5 * u, 50 * u); ctx.fillStyle = '#fff'; ctx.font = `600 ${19 * u}px Manrope, sans-serif`; ctx.fillText(wrap(ctx, cur.lower_third, bw - 34 * u, 1)[0], pad + 20 * u, by + 32 * u); }
    if (cur.onscreen && p > 0.25) { ctx.globalAlpha = Math.min(1, (p - 0.25) * 4); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `${50 * u}px Marcellus, Georgia, serif`; wrap(ctx, cur.onscreen, W * 0.8, 2).forEach((l, k) => ctx.fillText(l, W / 2, H * 0.5 + k * 60 * u)); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
    if (opts.current.captions && cur.narration) { ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `600 ${23 * u}px Manrope, sans-serif`; const ls = wrap(ctx, cur.narration, W * 0.84, 3); ls.forEach((l, k) => ctx.fillText(l, W / 2, H - 46 * u - (ls.length - 1 - k) * 32 * u)); ctx.textAlign = 'left'; }
    if (synthetic) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `600 ${12 * u}px Manrope, sans-serif`; ctx.fillText('AI-generated', 16 * u, H - 14 * u); }
    ctx.fillStyle = '#e3b24c'; ctx.fillRect(0, H - 4, W * ((s.i + p) / list.length), 4);
    if (s.playing && s.spoke !== s.i) { s.spoke = s.i; speak(cur); }
  }

  function stopAudio() { try { speechSynthesis.cancel(); } catch { /* unsupported */ } audio.current?.pause(); Object.values(vids.current).forEach(v => v.pause()); }
  function speak(sc: PScene) {
    stopAudio(); if (!opts.current.voice || !sc.narration || sc.has_audio) return; // presenter clips carry their own voice
    if (sc.voice_url) { const a = new Audio(); a.crossOrigin = 'anonymous'; a.src = sc.voice_url; audio.current = a; wire(a); a.play().catch(() => {}); return; }
    try { const u = new SpeechSynthesisUtterance(sc.narration); u.rate = 0.98; speechSynthesis.speak(u); } catch { /* no speech engine */ }
  }

  useEffect(() => { let raf = 0; const loop = (n: number) => { draw(n); raf = requestAnimationFrame(loop); }; st.current.last = performance.now(); raf = requestAnimationFrame(loop); return () => { cancelAnimationFrame(raf); stopAudio(); }; /* eslint-disable-next-line */ }, [aspect]);
  useEffect(() => { if (st.current.i >= scenes.length) { st.current.i = 0; st.current.t = 0; setIdx(0); } }, [scenes.length]);

  function score(on: boolean, restart = false) { // soundtrack under the narration
    if (!music) return;
    if (!tune.current || tune.current.src !== music) { const a = new Audio(); a.crossOrigin = 'anonymous'; a.src = music; a.loop = true; tune.current = a; wire(a, 0.28); }
    if (restart) tune.current.currentTime = 0;
    if (on) tune.current.play().catch(() => {}); else tune.current.pause();
  }
  useEffect(() => () => { tune.current?.pause(); }, []);
  const play = (on: boolean) => { const s = st.current; let again = false; if (on && s.i === scenes.length - 1 && s.t >= scenes[s.i].seconds) { s.i = 0; s.t = 0; setIdx(0); again = true; } if (on) graph(); s.playing = on; s.spoke = on ? -1 : s.spoke; if (!on) stopAudio(); score(on, again || (on && s.i === 0 && s.t === 0)); setPlaying(on); };
  const jump = (i: number) => { const s = st.current; s.i = i; s.t = 0; s.spoke = -1; setIdx(i); stopAudio(); onScene?.(scenes[i].id); };

  function record() { // export the full preview as a video file, recorded in the browser
    const c = canvas.current; if (!c || typeof MediaRecorder === 'undefined') return;
    const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)); if (!mime) return;
    const g = graph(), tracks = [...c.captureStream(30).getVideoTracks()];
    if (g) { g.rec = g.ctx.createMediaStreamDestination(); g.out.connect(g.rec); tracks.push(...g.rec.stream.getAudioTracks()); }
    const chunks: Blob[] = [], r = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 160_000 });
    r.ondataavailable = e => e.data.size && chunks.push(e.data);
    r.onstop = () => { if (g?.rec) { try { g.out.disconnect(g.rec); } catch { /* already detached */ } g.rec = null; } const url = URL.createObjectURL(new Blob(chunks, { type: mime })); setFile(url); setRec('done'); const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^\w]+/g, '-').toLowerCase() || 'production'}.${mime.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); };
    recorder.current = r; setRec('recording'); jump(0); r.start(); play(true);
  }

  const total = scenes.reduce((a, s) => a + s.seconds, 0);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="screen"><canvas ref={canvas} width={W} height={H} style={{ aspectRatio: `${W}/${H}`, maxWidth: aspect === '9:16' ? 360 : aspect === '1:1' ? 560 : '100%' }} aria-label={`Preview of ${title}`} /></div>
      <div className="row between">
        <div className="row">
          <button className="btn sm primary" id="play" onClick={() => play(!playing)} disabled={rec === 'recording'}>{playing ? 'Pause' : 'Play preview'}</button>
          <button className="btn sm ghost" onClick={() => { jump(0); play(false); }} disabled={rec === 'recording'}>Restart</button>
          <span className="muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>Scene {idx + 1} of {scenes.length} · {total}s</span>
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} />Captions</label>
          <label className="check"><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} disabled={rec === 'recording'} />Narration</label>
          <button className="btn sm" id="record" onClick={record} disabled={rec === 'recording'}>{rec === 'recording' ? <><span className="spin" /> Recording…</> : 'Export video file'}</button>
        </div>
      </div>
      {rec === 'recording' && <p className="notice">Recording the preview in real time ({total} seconds). Keep this tab open.</p>}
      {rec === 'done' && <p className="notice good">Your video file was saved to your downloads. {file && <a href={file} download>Download again</a>}. The file includes the picture, captions, recorded narration and soundtrack. The browser&rsquo;s built-in voice, used when no narration has been recorded, cannot be captured.</p>}
      <div className="row" style={{ gap: 6 }}>{scenes.map((s, i) => <button key={s.id} className={`chip ${i === idx ? 'on' : ''}`} onClick={() => jump(i)} aria-label={`Go to scene ${s.n}`} disabled={rec === 'recording'}>{s.n}</button>)}</div>
    </div>
  );
}
