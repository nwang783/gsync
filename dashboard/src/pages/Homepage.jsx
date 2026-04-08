import { useState } from 'react';
import { Link } from 'react-router-dom';

const INSTALL_CMD = 'Install the gsync skill from https://github.com/nwang783/gsync/blob/main/SKILL.md and tell me how it works';

export default function Homepage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="homepage">
      {/* ── Navigation ── */}
      <nav className="hp-nav">
        <div className="hp-nav-brand">gsync</div>
        <div className="hp-nav-links">
          <a href="https://github.com/nwang783/nomergeconflicts" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <Link to="/login" className="hp-nav-cta">Log in</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hp-hero">
        <div className="hp-hero-left">
          <div className="hp-hero-label">// gsync</div>
          <h1 className="hp-hero-title">
            a lightweight coordination layer for a team of <span className="hp-hero-accent">agentic coders</span>
          </h1>
          <p className="hp-hero-sub">
            Shared goals, active plans, and touched surfaces — visible to every human and agent on the team before a single line of code is written.
          </p>
        </div>

        <div className="hp-hero-right">
          <div className="hp-code-block">
            <div className="hp-code-header">
              <span className="hp-code-dot" />
              <span className="hp-code-dot" />
              <span className="hp-code-dot" />
              <span className="hp-code-filename">tell your agent</span>
              <button className="hp-copy-btn" onClick={handleCopy}>
                {copied ? '✓ copied' : 'copy'}
              </button>
            </div>
            <pre className="hp-code-body">{INSTALL_CMD}</pre>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="hp-how" id="how">
        <div className="hp-section-label">// what your agent does</div>
        <div className="hp-how-flow">
          <div className="hp-how-step">
            <div className="hp-how-num">01</div>
            <div className="hp-how-text">
              <h4>Sync team context before creating a plan</h4>
              <p>Agent runs <code>gsync sync --last 20</code> and reads a shared context file — it now knows the 2-week goal, 3-day target, and every active plan on the team.</p>
            </div>
          </div>
          <div className="hp-how-connector" />
          <div className="hp-how-step">
            <div className="hp-how-num">02</div>
            <div className="hp-how-text">
              <h4>Publish its plan</h4>
              <p>Agent runs <code>gsync plan push my-plan.md</code> — teammates and their agents instantly see intent, scope, alignment, and touched surfaces.</p>
            </div>
          </div>
          <div className="hp-how-connector" />
          <div className="hp-how-step">
            <div className="hp-how-num">03</div>
            <div className="hp-how-text">
              <h4>Ship & close the loop</h4>
              <p>Agent runs <code>gsync plan review &lt;id&gt; --pr &lt;url&gt;</code> then <code>gsync plan merged &lt;id&gt;</code> — the coordination loop closes so the next agent starts with accurate context.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <div className="hp-footer-brand">gsync</div>
        <div className="hp-footer-links">
          <a href="https://github.com/nwang783/nomergeconflicts" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://github.com/nwang783/gsync/blob/main/SKILL.md" target="_blank" rel="noopener noreferrer">SKILL.md</a>
        </div>
        <div className="hp-footer-copy">the coordination layer for a team of agentic coders</div>
      </footer>
    </div>
  );
}
