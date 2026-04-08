export default function TerminalPanel({
  title,
  eyebrow,
  lines,
  footer,
  className = '',
  lineClassName = '',
}) {
  return (
    <div className={`landing-terminal ${className}`.trim()}>
      <div className="landing-terminal__header">
        <div className="landing-terminal__lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="landing-terminal__meta">
          {eyebrow ? <span className="landing-terminal__eyebrow">{eyebrow}</span> : null}
          <span className="landing-terminal__title">{title}</span>
        </div>
      </div>

      <div className="landing-terminal__body">
        {lines.map((line, index) => (
          <div
            key={`${line.text}-${index}`}
            className={`landing-terminal__line landing-terminal__line--${line.tone || 'default'} ${lineClassName}`.trim()}
          >
            {line.text}
          </div>
        ))}
      </div>

      {footer ? <div className="landing-terminal__footer">{footer}</div> : null}
    </div>
  );
}
