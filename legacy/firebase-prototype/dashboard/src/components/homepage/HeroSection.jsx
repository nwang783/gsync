import { Link } from 'react-router-dom';
import TerminalPanel from './TerminalPanel.jsx';

export default function HeroSection({ sectionRef, facts, terminalLines, terminalReady }) {
  const stageNotes = [
    'before planning: gsync status + gsync sync --last 20',
    'after merge: gsync plan merged <id>',
  ];

  return (
    <section className="landing-hero" ref={sectionRef}>
      <div className="landing-hero__backdrop" aria-hidden="true">
        <div className="landing-hero__glow landing-hero__glow--left" />
        <div className="landing-hero__glow landing-hero__glow--right" />
        <div className="landing-hero__grain" />
      </div>

      <div className="landing-hero__inner">
        <div className="landing-hero__copy">
          <div className="landing-kicker">coordination layer for small teams coding with AI</div>
          <p className="landing-brand">gsync</p>
          <h1 className="landing-hero__title">Make intent visible before code forks.</h1>
          <p className="landing-hero__lede">
            The 2-week goal, the 3-day target, and the active plans touching the repo stay visible before a human or agent opens a new branch.
          </p>
          <div className="landing-hero__note">
            <span className="landing-hero__note-label">why it exists</span>
            <p className="landing-hero__note-copy">
              The goal is not just to avoid Git conflicts. It is to avoid directional drift.
            </p>
          </div>

          <div className="landing-hero__actions">
            <a
              className="landing-button landing-button--primary"
              href="https://github.com/nwang783/gsync/blob/main/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the SKILL.md
            </a>
            <Link className="landing-button landing-button--ghost" to="/login">
              Open the dashboard
            </Link>
          </div>

          <div className="landing-facts" aria-label="What gsync keeps aligned">
            {facts.map((fact) => (
              <div key={fact.label} className="landing-facts__item">
                <span className="landing-facts__label">{fact.label}</span>
                <p className="landing-facts__value">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-hero__terminal-shell">
          <div className="landing-hero__stage-notes" aria-hidden="true">
            {stageNotes.map((note, index) => (
              <div key={note} className={`landing-hero__stage-note landing-hero__stage-note--${index + 1}`}>
                {note}
              </div>
            ))}
          </div>

          <div className="landing-hero__terminal-stage">
            <TerminalPanel
              title="gsync session bootstrap"
              eyebrow="sample terminal"
              lines={terminalLines}
              footer="git stores code history. gsync stores the coordination layer."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
