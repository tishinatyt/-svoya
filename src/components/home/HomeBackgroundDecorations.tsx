type DoodleProps = {
  className: string
  children: React.ReactNode
  viewBox?: string
}

function Doodle({ className, children, viewBox = '0 0 64 64' }: DoodleProps) {
  return (
    <svg
      className={`home-decoration-doodle ${className}`}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export default function HomeBackgroundDecorations() {
  return (
    <div className="home-decorations" aria-hidden="true">
      <span className="home-decoration-glow home-decoration-glow-violet" />
      <span className="home-decoration-glow home-decoration-glow-pink" />
      <span className="home-decoration-glow home-decoration-glow-peach" />
      <span className="home-decoration-glow home-decoration-glow-mint" />

      <Doodle className="home-doodle-friends" viewBox="0 0 120 100">
        <circle cx="43" cy="29" r="11" />
        <circle cx="76" cy="26" r="10" />
        <path d="M23 78c2-21 9-34 21-34s19 13 20 34M59 76c2-20 8-32 18-32 12 0 18 14 20 35M52 50c8 9 16 10 24 2M33 22c4-7 15-9 22-2M67 20c5-6 15-7 21 0" />
      </Doodle>

      <Doodle className="home-doodle-pin">
        <path d="M45 25c0 13-13 27-13 27S19 38 19 25a13 13 0 1 1 26 0Z" />
        <circle cx="32" cy="25" r="4" />
      </Doodle>

      <Doodle className="home-doodle-coffee">
        <path d="M14 23h33v15a13 13 0 0 1-13 13h-7a13 13 0 0 1-13-13V23Z" />
        <path d="M47 28h3a8 8 0 0 1 0 16h-5M22 14c-4-5 4-7 0-12M34 14c-4-5 4-7 0-12" />
      </Doodle>

      <Doodle className="home-doodle-heart">
        <path d="M32 52S10 39 10 23c0-13 17-17 22-6 5-11 22-7 22 6 0 16-22 29-22 29Z" />
      </Doodle>

      <Doodle className="home-doodle-chat">
        <path d="M11 13h42v31H29L15 54l3-10h-7V13Z" />
        <path d="M22 26h20M22 33h13" />
      </Doodle>

      <Doodle className="home-doodle-music">
        <path d="M25 45V14l25-5v30M25 20l25-5" />
        <ellipse cx="18" cy="46" rx="7" ry="5" />
        <ellipse cx="43" cy="40" rx="7" ry="5" />
      </Doodle>

      <Doodle className="home-doodle-bike" viewBox="0 0 120 72">
        <circle cx="25" cy="49" r="17" />
        <circle cx="94" cy="49" r="17" />
        <path d="m25 49 19-29 20 29H25Zm39 0 18-34M48 20h-9M75 15h13M44 20l31 3 19 26" />
      </Doodle>

      <Doodle className="home-doodle-sparkles">
        <path d="m25 7 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9ZM47 32l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6ZM17 42l1.5 4.5L23 48l-4.5 1.5L17 54l-1.5-4.5L11 48l4.5-1.5L17 42Z" />
      </Doodle>
    </div>
  )
}
