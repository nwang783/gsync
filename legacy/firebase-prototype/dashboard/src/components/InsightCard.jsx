export default function InsightCard({
  title,
  statusLabel = null,
  loading = false,
  error = null,
  emptyText = 'No insight available yet.',
  headline = null,
  bullets = [],
  riskFlags = [],
  nextActions = [],
  meta = null,
}) {
  if (loading) {
    return (
      <section className="insight-card" aria-live="polite">
        <div className="insight-card__header">
          <h3>{title}</h3>
        </div>
        <div className="insight-card__loading">loading summary...</div>
      </section>
    );
  }

  if (error && !headline) {
    return (
      <section className="insight-card" aria-live="polite">
        <div className="insight-card__header">
          <h3>{title}</h3>
          {statusLabel && <span className="insight-card__status">{statusLabel}</span>}
        </div>
        <div className="insight-card__error">{error}</div>
      </section>
    );
  }

  if (!headline && bullets.length === 0 && riskFlags.length === 0 && nextActions.length === 0) {
    return (
      <section className="insight-card" aria-live="polite">
        <div className="insight-card__header">
          <h3>{title}</h3>
          {statusLabel && <span className="insight-card__status">{statusLabel}</span>}
        </div>
        <div className="insight-card__empty">{emptyText}</div>
      </section>
    );
  }

  return (
    <section className="insight-card" aria-live="polite">
      <div className="insight-card__header">
        <h3>{title}</h3>
        {statusLabel && <span className="insight-card__status">{statusLabel}</span>}
      </div>
      {headline && <p className="insight-card__headline">{headline}</p>}
      {bullets.length > 0 && (
        <ul className="insight-card__list">
          {bullets.map((bullet, index) => (
            <li key={`${index}-${bullet}`}>{bullet}</li>
          ))}
        </ul>
      )}
      {(riskFlags.length > 0 || nextActions.length > 0) && (
        <div className="insight-card__split">
          {riskFlags.length > 0 && (
            <div className="insight-card__group">
              <div className="insight-card__group-label">risks</div>
              <ul className="insight-card__list insight-card__list--compact">
                {riskFlags.map((flag, index) => (
                  <li key={`${index}-${flag}`}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
          {nextActions.length > 0 && (
            <div className="insight-card__group">
              <div className="insight-card__group-label">next</div>
              <ul className="insight-card__list insight-card__list--compact">
                {nextActions.map((action, index) => (
                  <li key={`${index}-${action}`}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {meta && <div className="insight-card__meta">{meta}</div>}
    </section>
  );
}
