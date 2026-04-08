import { Link } from 'react-router-dom';
import { useReveal } from '../../hooks/useReveal.js';

export default function ClosingSection({ sectionRef }) {
  const [contentRef, visible] = useReveal(0.2);

  return (
    <section className="landing-close" ref={sectionRef}>
      <div
        ref={contentRef}
        className={`landing-close__inner ${visible ? 'is-visible' : ''}`}
      >
        <p className="landing-close__label">final pass</p>
        <h2 className="landing-close__title">Let Git answer what changed. Let gsync answer what the team is trying to do.</h2>
        <p className="landing-close__body">
          When the context is visible before coding starts, agents stop amplifying stale assumptions into incompatible implementations.
        </p>
        <div className="landing-close__actions">
          <Link className="landing-button landing-button--primary" to="/login">
            Log in with a seat key
          </Link>
          <a
            className="landing-button landing-button--ghost"
            href="https://github.com/nwang783/nomergeconflicts"
            target="_blank"
            rel="noopener noreferrer"
          >
            View the repo
          </a>
        </div>
      </div>
    </section>
  );
}
