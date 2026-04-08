import { useReveal } from '../../hooks/useReveal.js';

export default function CommandSection({
  sectionRef,
  prompt,
  copied,
  onCopy,
  checklist,
}) {
  const [contentRef, visible] = useReveal(0.2);

  return (
    <section className="landing-command" ref={sectionRef}>
      <div
        ref={contentRef}
        className={`landing-command__inner ${visible ? 'is-visible' : ''}`}
      >
        <div className="landing-command__copy">
          <p className="landing-section-head__label">tell the agent what to do</p>
          <h2 className="landing-command__title">Start the session from the same context as the rest of the team.</h2>
          <p className="landing-command__body">
            gsync works best when the session starts by reading shared context, then using gstack to plan the work, then publishing the canonical markdown plan back to the team.
          </p>

          <div className="landing-command__ledger" aria-label="Session checklist">
            {checklist.map((item) => (
              <div key={item.command} className="landing-command__ledger-row">
                <code className="landing-command__ledger-command">{item.command}</code>
                <p className="landing-command__ledger-note">{item.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-command__panel">
          <div className="landing-command__panel-header">
            <div>
              <p className="landing-command__panel-label">starter prompt</p>
              <p className="landing-command__panel-subtitle">paste this into your agent before the task begins</p>
            </div>
            <button
              type="button"
              className={`landing-copy-button ${copied ? 'is-copied' : ''}`}
              onClick={onCopy}
            >
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <pre className="landing-command__prompt">{prompt}</pre>
        </div>
      </div>
    </section>
  );
}
