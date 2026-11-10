// Edit the landing's words here.
const COPY = {
  name: 'Alex Sigua',
  work: 'The Living Portfolio',
  year: '2026',
  materials: 'Blender, WebGL, one candle, live weather from central NJ',
  blurb: 'Alex Sigua is a software engineer taking full-time roles and freelance projects. Look around: the sun and rain in the window are real, right now.',
}

// A museum wall label for the room, in a brass-framed panel like the desk bubbles. Only words: nothing here clicks or routes.
export function Placard({ visible }: { visible: boolean }) {
  return (
    <header className={`placard panel-cast${visible ? ' placard-visible' : ''}`}>
      <div className="panel placard-panel">
        <h1>
          <span className="panel-label">{COPY.name}</span>
          <span className="placard-work">
            <cite>{COPY.work}</cite>, {COPY.year}
          </span>
        </h1>
        <p className="placard-materials">{COPY.materials}</p>
        <p className="placard-blurb">{COPY.blurb}</p>
      </div>
    </header>
  )
}
