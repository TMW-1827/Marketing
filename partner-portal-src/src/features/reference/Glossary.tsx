import { GLOSSARY } from '@/data/glossary'

export function Glossary() {
  return (
    <dl className="definitions definitions--wide">
      {GLOSSARY.map((entry) => (
        <div key={entry.term} style={{ display: 'contents' }}>
          <dt>{entry.term}</dt>
          <dd>{entry.definition}</dd>
        </div>
      ))}
    </dl>
  )
}
