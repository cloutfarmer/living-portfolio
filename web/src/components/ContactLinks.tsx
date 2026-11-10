// Where a recruiter goes next. The résumé ships with the personal site's build under /projects/. No email here: this
// repository is public, so the address lives only on the site. Keep in step with the plain copy in index.html.
export const CONTACTS = [
  { label: 'GitHub', href: 'https://github.com/cloutfarmer' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/alexsigua' },
  { label: 'Résumé', href: `${import.meta.env.BASE_URL}projects/alex-sigua-resume.pdf` },
]

export function ContactLinks({ className = '', inert = false }: { className?: string; inert?: boolean }) {
  return (
    <ul className={`contact-links ${className}`} aria-label="Contact" inert={inert}>
      {CONTACTS.map(({ label, href }) => (
        <li key={label}>
          <a href={href}>{label}</a>
        </li>
      ))}
    </ul>
  )
}
