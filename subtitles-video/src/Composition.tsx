import {
  AbsoluteFill,
  Audio,
  Composition,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { captions } from "./captions";

const FPS = 30;
const DURATION = Math.ceil(44.6 * FPS);

const Caption: React.FC<{ text: string; from: number; to: number }> = ({
  text,
  from,
  to,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const pop = spring({ frame: frame - from, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top: 1100,
        textAlign: "center",
        transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`,
        opacity: pop,
      }}
    >
      <span
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1.2,
          color: "#fff",
          WebkitTextStroke: "6px #000",
          paintOrder: "stroke fill",
          textShadow: "0 6px 20px rgba(0,0,0,0.6)",
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const MyComponent: React.FC = () => {
  const frame = useCurrentFrame();
  const hue = interpolate(frame, [0, DURATION], [230, 290]);
  const scale = interpolate(frame, [0, DURATION], [1, 1.15]);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, hsl(${hue},70%,18%), hsl(${hue + 50},80%,8%))`,
      }}
    >
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", top: -250 }}
      >
        <div
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 900,
            fontSize: 150,
            color: "#7cf",
            transform: `scale(${scale})`,
            letterSpacing: 4,
          }}
        >
          {"</> Remotion"}
        </div>
        <div
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 60,
            color: "#fff",
            opacity: 0.8,
            marginTop: 20,
          }}
        >
          Claude Code создаёт видео
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("voice.mp3")} />
      {captions.map((c, i) => (
        <Caption
          key={i}
          text={c.text}
          from={Math.round(c.start * FPS)}
          to={Math.round(c.end * FPS)}
        />
      ))}
    </AbsoluteFill>
  );
};

export const MyComposition = () => (
  <Composition
    id="MyComp"
    component={MyComponent}
    durationInFrames={DURATION}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
