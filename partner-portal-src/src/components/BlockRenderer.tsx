import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Block } from '@/types/content'
import { renderRich } from '@/lib/rich'
import { WIDGETS } from '@/features/widgets'
import { DriveImage } from '@/components/DriveImage'
import { driveDownload } from '@/lib/drive'

/**
 * Рендерить дерево блоків розділу.
 *
 * Кожен вид блока — окрема гілка switch, тому додати новий вид можна,
 * не чіпаючи наявні. Інтерактивні модулі підключаються через реєстр
 * WIDGETS: контент лишається чистими даними й не імпортує React-компоненти.
 */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView block={block} key={i} />
      ))}
    </>
  )
}

/**
 * Плитка галереї. Зображення з Drive може не завантажитись — тоді замість
 * порожньої плашки лишається підпис: файл усе одно доступний за посиланням
 * у переліку нижче.
 */
function GalleryItem({
  item,
}: {
  item: Extract<Block, { kind: 'gallery' }>['items'][number]
}) {
  const [failed, setFailed] = useState(false)

  return (
    <figure className={item.tone === 'dark' ? 'gallery--dark' : undefined}>
      <span className="gallery__plate">
        {item.driveId ? (
          failed ? (
            <span className="gallery__missing">Прев’ю недоступне</span>
          ) : (
            <DriveImage
              id={item.driveId}
              width={600}
              alt={item.alt}
              onGiveUp={() => setFailed(true)}
            />
          )
        ) : (
          <img src={item.src} alt={item.alt} loading="lazy" />
        )}
      </span>
      {item.caption && <figcaption>{renderRich(item.caption)}</figcaption>}

      {item.files && item.files.length > 0 && (
        <div className="gallery__files">
          {item.files.map((f) => (
            <a
              className="filechip"
              href={driveDownload(f.driveId)}
              key={f.format}
              title={`Завантажити ${f.format}${f.size ? `, ${f.size}` : ''}`}
            >
              <b>{f.format}</b>
              {f.size && <i>{f.size}</i>}
            </a>
          ))}
        </div>
      )}
    </figure>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'paragraph':
      return <p>{renderRich(block.text)}</p>

    case 'lede':
      return <p className="lede">{renderRich(block.text)}</p>

    case 'heading':
      return block.level === 4 ? (
        <h4>{block.text}</h4>
      ) : (
        <h3 style={{ marginTop: 28, marginBottom: 8 }}>{block.text}</h3>
      )

    case 'display':
      return (
        <div>
          <p
            className={`display display--${block.tone ?? 'primary'}`}
          >
            {block.text}
          </p>
          {block.caption && (
            <p className="display__caption">{renderRich(block.caption)}</p>
          )}
        </div>
      )

    case 'tags':
      return (
        <div className="tags">
          {block.items.map((tag, i) => (
            <span className={`tag tag--${tag.tone}`} key={i}>
              {tag.text}
            </span>
          ))}
        </div>
      )

    case 'list':
      return (
        <ul className={`list${block.style ? ` list--${block.style}` : ''}`}>
          {block.items.map((item, i) => (
            <li key={i}>{renderRich(item)}</li>
          ))}
        </ul>
      )

    case 'steps':
      return (
        <ol className="steps">
          {block.items.map((step, i) => (
            <li key={i}>
              <b>{step.title}.</b> {renderRich(step.text)}
            </li>
          ))}
        </ol>
      )

    case 'note':
      return (
        <div className={`note note--${block.tone}`}>
          {block.title && <b>{block.title}</b>}
          {renderRich(block.text)}
        </div>
      )

    case 'stats':
      return (
        <div className="stats">
          {block.items.map((stat, i) => (
            <div
              className={`stat${stat.tone === 'green' ? ' stat--green' : ''}`}
              key={i}
            >
              <div className="stat__value">
                {stat.value}
                {stat.unit && <small> {stat.unit}</small>}
              </div>
              <div className="stat__label">{renderRich(stat.label)}</div>
            </div>
          ))}
        </div>
      )

    case 'table':
      return (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {block.columns.map((col, i) => (
                  <th
                    key={i}
                    className={col.numeric ? 'num' : undefined}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={
                        block.columns[ci]?.numeric
                          ? 'num'
                          : block.commentColumns?.includes(ci)
                            ? 'comment'
                            : undefined
                      }
                    >
                      {renderRich(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'definitions':
      return (
        <dl className={`definitions${block.wide ? ' definitions--wide' : ''}`}>
          {block.items.map((item, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <dt>{renderRich(item.term)}</dt>
              <dd className={item.mono ? 'mono' : undefined}>
                {renderRich(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      )

    case 'code':
      return <div className="codeblock">{block.text}</div>

    case 'swatches':
      return (
        <div className="swatches">
          {block.items.map((sw, i) => (
            <div key={i}>
              <div
                className="swatch__chip"
                style={{ background: sw.css ?? sw.hex }}
              />
              <div className="swatch__label">
                <b>{sw.name}</b>
                <br />
                {sw.hex}
              </div>
            </div>
          ))}
        </div>
      )

    case 'card':
      return (
        <section
          className={`card${block.accent ? ` card--${block.accent}` : ''}`}
        >
          {block.title && (
            <h3
              className={
                block.titleTone ? `card__title--${block.titleTone}` : undefined
              }
            >
              {block.title}
            </h3>
          )}
          <Blocks blocks={block.blocks} />
        </section>
      )

    case 'columns':
      return (
        <div className="columns">
          <Blocks blocks={block.blocks} />
        </div>
      )

    case 'faq':
      return (
        <div className="faq">
          {block.items.map((item, i) => (
            <details key={i}>
              <summary>{item.q}</summary>
              <p>{renderRich(item.a)}</p>
            </details>
          ))}
        </div>
      )

    case 'links':
      return (
        <div className="linkgrid">
          {block.items.map((item, i) => (
            <Link
              className={`linkcard${item.tone ? ` linkcard--${item.tone}` : ''}`}
              to={item.to}
              key={i}
            >
              <b>{item.title}</b>
              <span>{renderRich(item.text)}</span>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
        </div>
      )

    case 'assets':
      return (
        <div className="assets">
          {block.items.map((item, i) => (
            <a
              className="asset"
              href={item.href}
              target="_blank"
              rel="noreferrer"
              key={i}
            >
              <span className="asset__head">
                <b>{item.title}</b>
                {item.format && <i className="asset__format">{item.format}</i>}
              </span>
              {item.note && (
                <span className="asset__note">{renderRich(item.note)}</span>
              )}
              {item.size && <span className="asset__size">{item.size}</span>}
            </a>
          ))}
        </div>
      )

    case 'gallery':
      return (
        <div className="gallery">
          {block.items.map((item, i) => (
            <GalleryItem item={item} key={i} />
          ))}
        </div>
      )

    case 'contacts':
      return (
        <div className="contacts">
          {block.items.map((item, i) => (
            <div className="contact" key={i}>
              <span className="contact__label">{item.label}</span>
              {item.href ? (
                <a
                  className="contact__value"
                  href={item.href}
                  {...(item.href.startsWith('http')
                    ? { target: '_blank', rel: 'noreferrer' }
                    : {})}
                >
                  {item.value}
                </a>
              ) : (
                <span className="contact__value">{item.value}</span>
              )}
              {item.note && (
                <span className="contact__note">{renderRich(item.note)}</span>
              )}
            </div>
          ))}
        </div>
      )

    case 'widget': {
      const Widget = WIDGETS[block.widget]
      return <Widget />
    }
  }
}
