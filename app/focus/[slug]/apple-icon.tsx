import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: 40,
          background:
            "radial-gradient(circle at 18% 18%, rgba(0,245,212,0.35), transparent 24%), radial-gradient(circle at 82% 18%, rgba(255,77,202,0.35), transparent 24%), radial-gradient(circle at 50% 84%, rgba(149,255,74,0.28), transparent 28%), linear-gradient(180deg, #04040c 0%, #090816 55%, #10051d 100%)",
        }}
      >
        <svg
          viewBox="0 0 280 260"
          width="154"
          height="143"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="monsterAppleGradient" x1="58" y1="49" x2="230" y2="205" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF4DCA" />
              <stop offset="1" stopColor="#8E5DFF" />
            </linearGradient>
          </defs>
          <path d="M56 73C56 36 88 10 126 14L154 17C196 22 226 57 226 100V150C226 191 193 224 152 224H128C88 224 56 192 56 152V73Z" fill="url(#monsterAppleGradient)" stroke="#111111" strokeWidth="8" />
          <circle cx="107" cy="106" r="18" fill="#FFF7FF" stroke="#111111" strokeWidth="8" />
          <circle cx="176" cy="106" r="18" fill="#FFF7FF" stroke="#111111" strokeWidth="8" />
          <circle cx="107" cy="106" r="7" fill="#111111" />
          <circle cx="176" cy="106" r="7" fill="#111111" />
          <path d="M109 145C125 159 157 159 173 145" stroke="#111111" strokeWidth="8" strokeLinecap="round" />
          <path d="M92 21L104 53" stroke="#FFD84D" strokeWidth="10" strokeLinecap="round" />
          <path d="M194 21L182 53" stroke="#FFD84D" strokeWidth="10" strokeLinecap="round" />
          <path d="M140 0L140 36" stroke="#FFD84D" strokeWidth="10" strokeLinecap="round" />
          <path d="M84 191L70 225" stroke="#111111" strokeWidth="8" strokeLinecap="round" />
          <path d="M198 191L212 225" stroke="#111111" strokeWidth="8" strokeLinecap="round" />
          <path d="M45 154L14 166L31 190" stroke="#00F5D4" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M238 152L266 171L248 191" stroke="#95FF4A" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
