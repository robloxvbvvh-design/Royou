import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { captions } from "./captions";

const FPS = 30;
const DURATION = Math.ceil(44.6 * FPS);
const S = (s: number) => Math.round(s * FPS);
const FONT = "Arial, Helvetica, sans-serif";
const MONO = "'DejaVu Sans Mono', 'Courier New', monospace";

const typed = (text: string, frame: number, start = 0, cps = 14) =>
  text.slice(0, Math.max(0, Math.floor(((frame - start) / FPS) * cps)));

const useSpring = (delay = 0, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/* ---------------- Character ---------------- */

const TYPING: [number, number][] = [
  [7.3, 9.2],
  [23.1, 25.0],
  [31.4, 33.6],
  [35.0, 36.1],
  [41.5, 44.5],
];

const Character: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const typing = TYPING.some(([a, b]) => t >= a && t <= b);
  const speaking = captions.some((c) => t >= c.start && t <= c.end);
  const waving = t < 3.5;
  const blink = frame % 90 > 84 ? 0.1 : 1;
  const mouth = speaking ? 4 + Math.abs(Math.sin(frame * 0.9)) * 14 : 3;
  const bob = Math.sin(frame / 14) * 5;
  const tilt = t >= 11.3 && t <= 14.4 ? Math.sin(frame * 0.5) * 6 : 0; // shakes head "no"
  const celebrate = t >= 36.1 && t <= 38.5;

  const lh = typing ? Math.sin(frame * 1.2) * 14 : 0;
  const rh = typing ? Math.cos(frame * 1.2) * 14 : 0;
  const waveAngle = Math.sin(frame * 0.4) * 25;

  return (
    <svg width={560} height={620} viewBox="0 0 560 620">
      <g transform={`translate(0 ${bob + (celebrate ? -Math.abs(Math.sin(frame * 0.4)) * 30 : 0)})`}>
        {/* body */}
        <path d="M130 620 L150 380 Q280 330 410 380 L430 620 Z" fill="#3b82f6" />
        <path d="M230 360 L280 430 L330 360 Z" fill="#fde2c4" />
        {/* left arm (viewer's left) */}
        <path
          d={`M160 400 Q100 480 ${190 + lh} ${540 - lh}`}
          stroke="#3b82f6" strokeWidth={46} strokeLinecap="round" fill="none"
        />
        <circle cx={190 + lh} cy={545 - lh} r={26} fill="#fde2c4" />
        {/* right arm */}
        {waving || celebrate ? (
          <g transform={`rotate(${waveAngle} 410 400)`}>
            <path d="M410 400 Q470 330 450 230" stroke="#3b82f6" strokeWidth={46} strokeLinecap="round" fill="none" />
            <circle cx={450} cy={215} r={28} fill="#fde2c4" />
          </g>
        ) : (
          <>
            <path
              d={`M400 400 Q460 480 ${370 + rh} ${540 - rh}`}
              stroke="#3b82f6" strokeWidth={46} strokeLinecap="round" fill="none"
            />
            <circle cx={370 + rh} cy={545 - rh} r={26} fill="#fde2c4" />
          </>
        )}
        {/* head */}
        <g transform={`rotate(${tilt} 280 250)`}>
          <rect x={250} y={330} width={60} height={50} fill="#fde2c4" />
          <ellipse cx={280} cy={230} rx={115} ry={125} fill="#fde2c4" />
          <path d="M165 215 Q170 100 280 100 Q392 100 395 215 Q350 150 280 150 Q210 150 165 215Z" fill="#2b2118" />
          <ellipse cx={168} cy={240} rx={14} ry={24} fill="#f6d2a8" />
          <ellipse cx={392} cy={240} rx={14} ry={24} fill="#f6d2a8" />
          {/* glasses */}
          <circle cx={235} cy={235} r={34} fill="#fff" stroke="#222" strokeWidth={7} />
          <circle cx={325} cy={235} r={34} fill="#fff" stroke="#222" strokeWidth={7} />
          <line x1={269} y1={235} x2={291} y2={235} stroke="#222" strokeWidth={7} />
          <ellipse cx={238} cy={237} rx={11} ry={13 * blink} fill="#222" />
          <ellipse cx={322} cy={237} rx={11} ry={13 * blink} fill="#222" />
          <path d="M205 190 Q235 175 262 190" stroke="#2b2118" strokeWidth={8} fill="none" strokeLinecap="round" />
          <path d="M298 190 Q325 175 355 190" stroke="#2b2118" strokeWidth={8} fill="none" strokeLinecap="round" />
          {/* mouth */}
          <ellipse cx={280} cy={310} rx={26} ry={mouth} fill="#7a1f2b" />
          <ellipse cx={280} cy={310 + mouth * 0.5} rx={14} ry={mouth * 0.4} fill="#e76f7a" />
        </g>
      </g>
    </svg>
  );
};

const Laptop: React.FC = () => (
  <svg width={720} height={200} viewBox="0 0 720 200">
    <rect x={150} y={0} width={420} height={20} rx={10} fill="#9aa4b2" opacity={0} />
    <path d="M60 60 L660 60 L700 150 L20 150 Z" fill="#cbd5e1" />
    <rect x={20} y={150} width={680} height={22} rx={11} fill="#94a3b8" />
    <circle cx={360} cy={110} r={10} fill="#64748b" />
  </svg>
);

/* ---------------- Shared UI ---------------- */

const Panel: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const p = useSpring(0, 16);
  return (
    <div
      style={{
        width: 900, height: 780, borderRadius: 36, background: "#0f172a",
        border: "4px solid #334155", overflow: "hidden",
        transform: `scale(${interpolate(p, [0, 1], [0.85, 1])})`, opacity: p,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)", position: "relative",
      }}
    >
      <div style={{ height: 64, background: "#1e293b", display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
        {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
          <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
        ))}
        <div style={{ color: "#94a3b8", fontFamily: FONT, fontSize: 28, marginLeft: 16 }}>{title}</div>
      </div>
      <div style={{ padding: 36, height: 716, boxSizing: "border-box", position: "relative" }}>{children}</div>
    </div>
  );
};

const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  return <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>▌</span>;
};

const Bubble: React.FC<{ text: string; me?: boolean; mono?: boolean; cursor?: boolean }> = ({ text, me, mono, cursor }) => (
  <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", marginBottom: 24 }}>
    <div
      style={{
        maxWidth: 700, padding: "22px 32px", borderRadius: 32,
        background: me ? "#2563eb" : "#334155", color: "#fff",
        fontFamily: mono ? MONO : FONT, fontSize: 46,
      }}
    >
      {text}
      {cursor && <Cursor />}
    </div>
  </div>
);

const FileCard: React.FC<{ name: string; color: string; label: string }> = ({ name, color, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 28, background: "#1e293b", borderRadius: 28, padding: 28 }}>
    <div style={{ width: 110, height: 130, borderRadius: 16, background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 36 }}>
      {label}
    </div>
    <div style={{ color: "#fff", fontFamily: FONT, fontSize: 48, fontWeight: 700 }}>{name}</div>
  </div>
);

const Play: React.FC<{ size?: number }> = ({ size = 160 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx={50} cy={50} r={48} fill="#22c55e" />
    <path d="M40 28 L74 50 L40 72Z" fill="#fff" />
  </svg>
);

/* ---------------- Scenes ---------------- */

const Intro: React.FC = () => {
  const p = useSpring(0, 10);
  const frame = useCurrentFrame();
  return (
    <div style={{ textAlign: "center", fontFamily: FONT, transform: `scale(${p})` }}>
      <div style={{ fontSize: 120, fontWeight: 900, color: "#7cf" }}>Claude Code</div>
      <div style={{ fontSize: 90, fontWeight: 900, color: "#fff", marginTop: 10 }}>создаёт видео</div>
      <div style={{ marginTop: 60, display: "flex", justifyContent: "center", transform: `rotate(${Math.sin(frame / 10) * 6}deg)` }}>
        <Play size={220} />
      </div>
    </div>
  );
};

const PhoneScene: React.FC = () => {
  const frame = useCurrentFrame();
  const msg = typed("создать видео", frame, S(2.8), 7);
  const sent = frame > S(5.0);
  const reply = frame > S(5.6);
  const slide = useSpring(0, 16);
  return (
    <div style={{ width: 520, height: 800, borderRadius: 64, background: "#0f172a", border: "10px solid #475569", padding: 30, boxSizing: "border-box", transform: `translateY(${interpolate(slide, [0, 1], [200, 0])}px)`, opacity: slide, position: "relative", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
      <div style={{ color: "#94a3b8", fontFamily: FONT, fontSize: 30, textAlign: "center", marginBottom: 24 }}>Claude</div>
      <div style={{ transform: "scale(0.62)", transformOrigin: "top left", width: 800 }}>
        {sent && <Bubble me text="создать видео" />}
        {reply && (
          <>
            <Bubble text="Готово! Вот твоё видео в формате mp4:" />
            <FileCard name="video.mp4" color="#22c55e" label="MP4" />
          </>
        )}
      </div>
      {!sent && (
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 28, background: "#1e293b", borderRadius: 36, padding: "20px 26px", color: "#fff", fontFamily: FONT, fontSize: 32 }}>
          {msg}<Cursor />
        </div>
      )}
    </div>
  );
};

const HollywoodScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useSpring(0, 14);
  const x = useSpring(S(1.0), 8);
  const code = useSpring(S(2.6), 12);
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "center", fontFamily: FONT, transform: `scale(${p})` }}>
      <div style={{ width: 400, height: 500, borderRadius: 36, background: "#1e293b", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <svg width={200} height={160} viewBox="0 0 200 160">
          <rect x={10} y={40} width={130} height={90} rx={14} fill="#94a3b8" />
          <path d="M140 70 L190 40 L190 130 L140 100Z" fill="#94a3b8" />
          <circle cx={50} cy={25} r={22} fill="#64748b" /><circle cx={105} cy={25} r={22} fill="#64748b" />
        </svg>
        <div style={{ color: "#fff", fontSize: 50, fontWeight: 800 }}>Голливуд</div>
        <svg width={400} height={500} style={{ position: "absolute", inset: 0, opacity: x }}>
          <line x1={40} y1={60} x2={360} y2={440} stroke="#ef4444" strokeWidth={22} strokeLinecap="round" />
          <line x1={360} y1={60} x2={40} y2={440} stroke="#ef4444" strokeWidth={22} strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ width: 400, height: 500, borderRadius: 36, background: "#0b3b2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, transform: `scale(${code})` }}>
        <div style={{ color: "#4ade80", fontFamily: MONO, fontSize: 40 }}>{"<Анимация />"}</div>
        <div style={{ position: "relative", width: 300, height: 200 }}>
          <div style={{ position: "absolute", left: 30 + Math.sin(frame / 6) * 40, top: 70, width: 90, height: 90, borderRadius: 20, background: "#38bdf8" }} />
          <div style={{ position: "absolute", left: 170 - Math.sin(frame / 6) * 40, top: 70 + Math.cos(frame / 6) * 30, width: 90, height: 90, borderRadius: 45, background: "#f472b6" }} />
        </div>
        <div style={{ color: "#fff", fontSize: 50, fontWeight: 800 }}>код → mp4</div>
      </div>
    </div>
  );
};

const PluginScene: React.FC = () => {
  const frame = useCurrentFrame();
  const prog = interpolate(frame, [S(0.3), S(2.0)], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const folder = useSpring(S(2.2), 10);
  const plugins = [0, 1, 2].map((i) => useSpring(S(3.6) + i * 8, 8));
  const showTyping = frame > S(5.2);
  return (
    <Panel title="Remotion">
      <FileCard name="remotion plugin" color="#6366f1" label="R" />
      <div style={{ marginTop: 28, height: 36, background: "#1e293b", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ width: `${prog}%`, height: "100%", background: "#22c55e" }} />
      </div>
      <div style={{ color: "#94a3b8", fontFamily: FONT, fontSize: 36, marginTop: 14 }}>
        {prog < 100 ? `Скачиваем… ${Math.round(prog)}%` : "Установлено"}
      </div>
      <div style={{ display: "flex", gap: 36, marginTop: 40, alignItems: "flex-end", transform: `scale(${folder})`, transformOrigin: "left bottom" }}>
        <svg width={220} height={170} viewBox="0 0 220 170">
          <path d="M10 30 H80 L100 55 H210 V160 H10Z" fill="#f59e0b" />
          <rect x={10} y={65} width={200} height={95} fill="#fbbf24" />
        </svg>
        <div style={{ display: "flex", gap: 20 }}>
          {plugins.map((s, i) => (
            <div key={i} style={{ width: 90, height: 90, borderRadius: 22, background: ["#6366f1", "#ec4899", "#14b8a6"][i], transform: `scale(${s})` }} />
          ))}
        </div>
      </div>
      {showTyping && (
        <div style={{ position: "absolute", left: 36, right: 36, bottom: 30 }}>
          <Bubble me mono text={typed("создать видео", frame, S(5.3), 9)} cursor />
        </div>
      )}
    </Panel>
  );
};

const ZipScene: React.FC = () => {
  const frame = useCurrentFrame();
  const zip = useSpring(0, 12);
  const open = useSpring(S(1.8), 12);
  const term = frame > S(5.0);
  return (
    <Panel title={term ? "Терминал — my-video" : "Проводник"}>
      {!term ? (
        <>
          <div style={{ transform: `scale(${zip})`, transformOrigin: "left top" }}>
            <FileCard name="my-video.zip" color="#f59e0b" label="ZIP" />
          </div>
          <div style={{ marginTop: 40, opacity: open, transform: `translateY(${interpolate(open, [0, 1], [60, 0])}px)` }}>
            <div style={{ color: "#fff", fontFamily: FONT, fontSize: 40, marginBottom: 16 }}>Открываем в отдельную папку:</div>
            {["package.json", "src/", "public/"].map((n) => (
              <div key={n} style={{ color: "#7cf", fontFamily: MONO, fontSize: 44, padding: "6px 0" }}>▸ {n}</div>
            ))}
          </div>
        </>
      ) : (
        <TerminalContent frame={frame - S(5.0)} lines={[{ at: 0, cmd: "cd my-video" }]} />
      )}
    </Panel>
  );
};

type Line = { at: number; cmd: string };
const TerminalContent: React.FC<{ frame: number; lines: Line[] }> = ({ frame, lines }) => (
  <div style={{ fontFamily: MONO, fontSize: 44, color: "#e2e8f0", lineHeight: 1.6 }}>
    {lines.map((l, i) => (
      <div key={i}>
        <span style={{ color: "#22c55e" }}>$ </span>
        {typed(l.cmd, frame, l.at, 10)}
        {frame >= l.at && i === lines.length - 1 && <Cursor />}
      </div>
    ))}
  </div>
);

const NpmScene: React.FC = () => {
  const frame = useCurrentFrame();
  const prog = interpolate(frame, [S(1.8), S(4.2)], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = prog >= 100;
  const dev = frame > S(5.2);
  const ready = frame > S(6.6);
  const pv = useSpring(S(6.6), 12);
  return (
    <Panel title="Терминал">
      <div style={{ fontFamily: MONO, fontSize: 44, color: "#e2e8f0", lineHeight: 1.6 }}>
        <div><span style={{ color: "#22c55e" }}>$ </span>{typed("npm install", frame, 0, 8)}{frame < S(1.8) && <Cursor />}</div>
        {frame >= S(1.8) && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 30, background: "#1e293b", borderRadius: 15, overflow: "hidden" }}>
              <div style={{ width: `${prog}%`, height: "100%", background: "#38bdf8" }} />
            </div>
            {done && <div style={{ color: "#4ade80", marginTop: 10 }}>✓ всё установлено</div>}
          </div>
        )}
        {dev && (
          <div style={{ marginTop: 20 }}>
            <span style={{ color: "#22c55e" }}>$ </span>{typed("npm run dev", frame, S(5.2), 8)}
            {!ready && <Cursor />}
          </div>
        )}
        {ready && <div style={{ color: "#4ade80" }}>→ localhost:3000</div>}
      </div>
      {ready && (
        <div style={{ position: "absolute", right: 36, bottom: 30, width: 380, height: 240, borderRadius: 24, background: "#312e81", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pv})`, transformOrigin: "bottom right", border: "4px solid #6366f1" }}>
          <Play size={130} />
        </div>
      )}
    </Panel>
  );
};

const DoneScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useSpring(0, 10);
  const note = useSpring(S(1.2), 8);
  return (
    <div style={{ textAlign: "center", fontFamily: FONT, transform: `scale(${p})` }}>
      <div style={{ fontSize: 100, fontWeight: 900, color: "#4ade80" }}>Видео готово!</div>
      <div style={{ marginTop: 50, display: "flex", justifyContent: "center", gap: 40, alignItems: "center" }}>
        <Play size={200} />
        <div style={{ transform: `scale(${note}) rotate(${Math.sin(frame / 6) * 10}deg)` }}>
          <svg width={160} height={200} viewBox="0 0 80 100">
            <path d="M30 10 L70 0 V70 A14 14 0 1 1 62 58 V22 L38 28 V80 A14 14 0 1 1 30 68Z" fill="#fbbf24" />
          </svg>
        </div>
      </div>
      <div style={{ color: "#fff", fontSize: 54, marginTop: 24 }}>звук добавляем отдельно</div>
    </div>
  );
};

const RemotionCreateScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Panel title="Claude Code">
      <div style={{ color: "#94a3b8", fontFamily: FONT, fontSize: 40, marginBottom: 30 }}>Обязательно пишем:</div>
      <div style={{ background: "#1e293b", borderRadius: 28, padding: "36px 40px", fontFamily: MONO, fontSize: 56, color: "#fff" }}>
        <span style={{ color: "#7cf" }}>{typed("/remotion Create", frame, 0, 7)}</span>
        <Cursor />
      </div>
    </Panel>
  );
};

/* ---------------- Root composition ---------------- */

const stage = (from: number, to: number, el: React.ReactNode) => (
  <Sequence from={S(from)} durationInFrames={S(to - from)} layout="none">
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", top: -330, height: 1500 }}>{el}</AbsoluteFill>
  </Sequence>
);

const Caption: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const pop = spring({ frame: frame - from, fps, config: { damping: 14 } });
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top: 1560, height: 300, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`, opacity: pop }}>
      <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 88, lineHeight: 1.15, color: "#fff", WebkitTextStroke: "6px #000", paintOrder: "stroke fill" }}>
        {text}
      </span>
    </div>
  );
};

export const MyComponent: React.FC = () => {
  const frame = useCurrentFrame();
  const hue = interpolate(frame, [0, DURATION], [230, 290]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, hsl(${hue},70%,18%), hsl(${hue + 50},80%,8%))` }}>
      {stage(0, 4.5, <Intro />)}
      {stage(4.5, 11.3, <PhoneScene />)}
      {stage(11.3, 16.4, <HollywoodScene />)}
      {stage(16.4, 25.1, <PluginScene />)}
      {stage(25.1, 31.4, <ZipScene />)}
      {stage(31.4, 36.1, <NpmScene />)}
      {stage(36.1, 40.6, <DoneScene />)}
      {stage(40.6, 44.7, <RemotionCreateScene />)}

      {/* character + desk */}
      <div style={{ position: "absolute", left: 260, top: 640 + 330, }}>
        <Character />
      </div>
      <div style={{ position: "absolute", left: 180, top: 1330 }}>
        <Laptop />
      </div>
      <Audio src={staticFile("voice.mp3")} />
      {captions.map((c, i) => (
        <Caption key={i} text={c.text} from={S(c.start)} to={S(c.end)} />
      ))}
    </AbsoluteFill>
  );
};

export const MyComposition = () => (
  <Composition id="MyComp" component={MyComponent} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
);
