import { Component, type ReactNode } from 'react'
import { ContactLinks } from './ContactLinks'
import { SiteLink } from './SiteLink'

// What visitors see when the 3D room can't start: no WebGL, or a download failed. They still reach the portfolio.
function RoomUnavailable({ error }: { error: Error }) {
  return (
    <div className="message" role="alert">
      <p className="message-name">Alex Sigua · Software Engineer</p>
      <p>The 3D room couldn’t load on this device. The portfolio works without it.</p>
      <SiteLink />
      <ContactLinks />
      {import.meta.env.DEV && (
        <p className="message-dev">
          {error.message}. If the scene is missing, run npm run export-scene, then reload.
        </p>
      )}
    </div>
  )
}

// Catches a failed load below it: shows the fallback if given (the pinboard's also tells the loader to stop waiting),
// otherwise RoomUnavailable.
export class LoadBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return this.props.fallback !== undefined ? this.props.fallback : <RoomUnavailable error={error} />
  }
}
