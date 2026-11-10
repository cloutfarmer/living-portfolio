import { ContactLinks } from './ContactLinks'

// Edit the landing's words here. The blurb ends on where the work is, because that's what most visitors came for.
const COPY = {
  name: 'Alex Sigua',
  work: 'The Living Portfolio',
  year: '2026',
  materials: 'Blender, WebGL, one candle, live weather from central NJ',
  blurb: 'Alex Sigua is a software engineer, open to full-time roles and freelance projects. His projects run live on the computer at the desk.',
  action: 'See my projects',
}

// A museum wall label for the room, in a brass-framed panel like the desk bubbles, under the view menu where the eye
// lands first. Its button goes straight to the computer. The words let the pointer through to the scene; only the
// button and contact links take clicks. They're inert while it's hidden, so keyboard focus can't land on them; the
// heading stays readable.
export function Placard({ visible, onProjects }: { visible: boolean; onProjects: () => void }) {
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
        <button className="panel placard-action" onClick={onProjects} inert={!visible}>
          {COPY.action} <span aria-hidden="true">→</span>
        </button>
        <ContactLinks className="placard-contact" inert={!visible} />
      </div>
    </header>
  )
}
