import { ACCOUNTS } from './Phone'

const { SIGUA, RONDO } = ACCOUNTS

// Edit the guide's words here. The accounts' names and links live in Phone.tsx.
const COPY = {
  title: 'Two notifications',
  sigua: 'My training page: strength and mobility for athletes.',
  rondo: 'The soccer club I play for. Their page, not mine.',
  tap: 'Tap either one to open it on Instagram, in a new tab ↗',
  // Narrow windows have no room beside the phone, so this one line stands in.
  short: 'Tap a notification to open it on Instagram ↗ · Rondo FC is the club I play for, not my page.',
}

// A museum label beside the phone, a brass-framed plaque like the landing's. Only words: the notifications are what click.
export function PhoneGuide({ visible }: { visible: boolean }) {
  return (
    <aside className={`phone-guide panel-cast${visible ? ' phone-guide-visible' : ''}`} aria-hidden={!visible}>
      <div className="panel phone-guide-full">
        <p className="panel-label">{COPY.title}</p>
        <p>
          <strong>{SIGUA.name}</strong>
          <br />
          {COPY.sigua}
        </p>
        <p>
          <strong>{RONDO.name}</strong>
          <br />
          {COPY.rondo}
        </p>
        <p className="phone-guide-tap">{COPY.tap}</p>
      </div>
      <p className="panel phone-guide-short">{COPY.short}</p>
    </aside>
  )
}
