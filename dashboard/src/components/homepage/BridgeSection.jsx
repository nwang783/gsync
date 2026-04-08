import { useReveal } from '../../hooks/useReveal.js';

export default function BridgeSection({ sectionRef }) {
  const [contentRef, visible] = useReveal(0.2);

  return (
    <section className="landing-bridge" ref={sectionRef}>
      <div
        ref={contentRef}
        className={`landing-bridge__inner ${visible ? 'is-visible' : ''}`}
      >
        <p className="landing-section-head__label">why this exists</p>
        <h2 className="landing-bridge__title">Something between a long-term roadmap and raw Git history.</h2>
        <div className="landing-bridge__ledger" aria-label="Git and gsync roles">
          <div className="landing-bridge__ledger-item">
            <span className="landing-bridge__ledger-label">Git</span>
            <p className="landing-bridge__ledger-value">What code changed?</p>
          </div>
          <div className="landing-bridge__ledger-item">
            <span className="landing-bridge__ledger-label">gsync</span>
            <p className="landing-bridge__ledger-value">What is the team trying to do, why, and who is touching what right now?</p>
          </div>
        </div>
      </div>
    </section>
  );
}
