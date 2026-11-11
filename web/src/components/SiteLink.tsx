import type { CSSProperties } from 'react'

// Pops out of the room into the full portfolio site, in the same tab. The site reads
// `from=room` and shows a "Back to the room" button. A real link, so Cmd-click and
// middle-click still open a new tab.
export const SITE_URL = `${import.meta.env.BASE_URL}projects/index.html?from=room`

// `expand` is for the computer view, where the site is already on screen: there it reads as
// making that page full screen rather than going somewhere new. Otherwise (the load-error screen) it reads
// "Skip to portfolio".
export function SiteLink({
  className = '',
  expand = false,
  style,
}: {
  className?: string
  expand?: boolean
  style?: CSSProperties
}) {
  return (
    <span className={`site-link panel-cast ${className}`} style={style}>
      <a className="panel site-link-button" href={SITE_URL} aria-label={expand ? 'Open the website full screen' : undefined}>
        {expand ? (
          <>
            <span className="site-link-icon" aria-hidden="true">⤢</span> Full screen
          </>
        ) : (
          <>
            Skip to portfolio <span aria-hidden="true">→</span>
          </>
        )}
      </a>
    </span>
  )
}
