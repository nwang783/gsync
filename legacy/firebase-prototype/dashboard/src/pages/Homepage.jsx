import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const INSTALL_CMD = 'Install the gsync skill from https://github.com/nwang783/gsync/blob/main/SKILL.md and tell me how it works';

/* ── Intersection Observer hook ── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ── Terminal script lines ── */
const TERMINAL_LINES = [
  { type: 'cmd', text: '$ gsync sync --last 20' },
  { type: 'out', text: 'syncing team context...' },
  { type: 'out', text: '✓ 2-week goal: ship agent coordination v2', cls: 'term-success' },
  { type: 'out', text: '✓ 3-day target: merge auth + plan visibility', cls: 'term-success' },
  { type: 'out', text: '✓ 4 active plans across 3 agents', cls: 'term-success' },
  { type: 'blank' },
  { type: 'cmd', text: '$ gsync status' },
  { type: 'out', text: 'AGENT          PLAN                    STATUS       FILES', cls: 'term-header' },
  { type: 'out', text: '─────────────────────────────────────────────────────────', cls: 'term-dim' },
  { type: 'out', text: 'agent-1        feature-auth.md         in progress  src/auth/*' },
  { type: 'out', text: 'agent-2        fix-dashboard.md        in review    src/ui/*' },
  { type: 'out', text: 'agent-3        api-refactor.md         draft        src/api/*' },
  { type: 'blank' },
  { type: 'out', text: '⚠ agent-1 and agent-3 touch src/api/routes.ts', cls: 'term-warn' },
  { type: 'out', text: '→ coordination surface detected. plans aligned.', cls: 'term-accent' },
  { type: 'blank' },
  { type: 'cmd', text: '$ gsync plan push feature-auth.md' },
  { type: 'out', text: '✓ plan published — 2 agents notified', cls: 'term-success' },
];

/* ── Step data for timeline ── */
const STEPS = [
  {
    num: '01',
    title: 'Sync context',
    cmd: 'gsync sync --last 20',
    desc: 'Agent reads a shared context file — it now knows the 2-week goal, 3-day target, and every active plan on the team.',
    terminalLines: [
      '$ gsync sync --last 20',
      'syncing team context...',
      '✓ 2-week goal: ship agent coordination v2',
      '✓ 3 active plans across 3 agents',
    ],
  },
  {
    num: '02',
    title: 'Publish plan',
    cmd: 'gsync plan push my-plan.md',
    desc: 'Teammates and their agents instantly see intent, scope, alignment, and touched surfaces.',
    terminalLines: [
      '$ gsync plan push feature-auth.md',
      '✓ plan published',
      '→ 2 agents notified',
      '→ coordination surface: src/api/*',
    ],
  },
  {
    num: '03',
    title: 'Ship & close',
    cmd: 'gsync plan merged <id>',
    desc: 'The coordination loop closes so the next agent starts with accurate context.',
    terminalLines: [
      '$ gsync plan merged plan-042',
      '✓ plan closed — context updated',
      '→ 3 agents now in sync',
      '✓ no merge conflicts detected',
    ],
  },
];

/* ── Mini terminal animation for step cards ── */
function StepTerminal({ lines, active }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!active) { setVisibleCount(0); return; }
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= lines.length) clearInterval(interval);
    }, 300);
    return () => clearInterval(interval);
  }, [active, lines.length]);

  return (
    <div className="hp-step-terminal">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={`hp-step-term-line ${idx < visibleCount ? 'hp-step-term-line--visible' : ''} ${line.startsWith('$') ? 'term-cmd' : line.startsWith('✓') ? 'term-success' : line.startsWith('→') ? 'term-accent' : ''}`}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

/* ── Coordination network (canvas node visualization) ── */
function CoordinationNetwork() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const nodesRef = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const nodeCount = 18;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init nodes
    if (nodesRef.current.length === 0) {
      nodesRef.current = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.002 + Math.random() * 0.003,
        orbitRadius: 20 + Math.random() * 40,
        baseX: Math.random() * canvas.width,
        baseY: Math.random() * canvas.height,
      }));
    }

    const nodes = nodesRef.current;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      for (const node of nodes) {
        node.phase += node.orbitSpeed;
        node.x = node.baseX + Math.sin(node.phase) * node.orbitRadius;
        node.y = node.baseY + Math.cos(node.phase * 0.7) * node.orbitRadius;

        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120 * 0.015;
          node.baseX += dx * force;
          node.baseY += dy * force;
        }

        if (node.baseX < -20) node.baseX = canvas.width + 20;
        if (node.baseX > canvas.width + 20) node.baseX = -20;
        if (node.baseY < -20) node.baseY = canvas.height + 20;
        if (node.baseY > canvas.height + 20) node.baseY = -20;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            const alpha = (1 - dist / 160) * 0.15;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(212, 91, 43, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(212, 91, 43, 0.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(212, 91, 43, 0.06)';
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.parentElement?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
  }, []);

  return (
    <div
      className="hp-network-bg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="hp-network-canvas" />
    </div>
  );
}

/* ── Coordination rain background ── */
function CoordinationRain() {
  const words = ['plan', 'sync', 'merge', 'agent', '✓', '→', 'src/*', 'push', 'pull', 'ctx', 'aligned', 'surface'];
  const columns = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: `${(i * 7.3 + Math.random() * 5) % 100}%`,
    duration: `${15 + Math.random() * 15}s`,
    delay: `${-Math.random() * 15}s`,
    opacity: 0.03 + Math.random() * 0.04,
    text: Array.from({ length: 12 }, () => words[Math.floor(Math.random() * words.length)]).join(' '),
  }));

  return (
    <div className="hp-coordination-rain" aria-hidden="true">
      {columns.map(col => (
        <span
          key={col.id}
          className="hp-rain-column"
          style={{
            left: col.left,
            animationDuration: col.duration,
            animationDelay: col.delay,
            opacity: col.opacity,
          }}
        >
          {col.text}
        </span>
      ))}
    </div>
  );
}

export default function Homepage() {
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState('typing'); // typing → revealing → revealed
  const [visibleLines, setVisibleLines] = useState([]);
  const [easterEgg, setEasterEgg] = useState(false);

  // Scroll reveal refs
  const [taglineRef, taglineVisible] = useReveal(0.2);
  const timelineRef = useRef(null);

  /* ── Timeline stack pull: one shared overlap curve so each handoff feels the same,
      with a longer ramp to keep the cards readable. ── */
  useEffect(() => {
    if (phase !== 'revealed') return;

    const el = timelineRef.current;
    if (!el) return;

    const updateStackPull = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.style.setProperty('--stack-pull', '0');
        return;
      }

      const rect = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      const vh = window.innerHeight || 1;
      const topAbs = rect.top + scrollY;

      const start = topAbs - vh * 0.48;
      const end = topAbs + vh * 1.72;

      let pull = 0;
      if (scrollY <= start) pull = 0;
      else if (scrollY >= end) pull = 1;
      else pull = (scrollY - start) / (end - start);

      el.style.setProperty('--stack-pull', Math.min(1, Math.max(0, pull)).toFixed(4));
    };

    updateStackPull();
    window.addEventListener('scroll', updateStackPull, { passive: true });
    window.addEventListener('resize', updateStackPull, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateStackPull);
      window.removeEventListener('resize', updateStackPull);
    };
  }, [phase]);

  /* ── Parallax: hero + timeline label (timeline steps use sticky stack, not parallax) ── */
  useEffect(() => {
    if (phase !== 'revealed') return;

    const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const updateParallax = () => {
      const y = window.scrollY;
      const tag = document.querySelector('.hp-hero-parallax-target');
      const label = document.querySelector('.hp-timeline-label');
      if (tag) tag.style.transform = `translateY(${y * -0.028}px)`;
      if (label) label.style.transform = `translateY(${y * -0.014}px)`;

      if (reduceMotion()) {
        return;
      }
      /* Timeline uses sticky stacking cards — no parallax on step content */
    };

    window.addEventListener('scroll', updateParallax, { passive: true });
    window.addEventListener('resize', updateParallax, { passive: true });
    updateParallax();
    return () => {
      window.removeEventListener('scroll', updateParallax);
      window.removeEventListener('resize', updateParallax);
    };
  }, [phase]);

  /* ── Keyboard Easter egg ── */
  useEffect(() => {
    const target = 'gsync';
    let buffer = '';
    const onKey = (e) => {
      buffer += e.key.toLowerCase();
      if (buffer.length > target.length) buffer = buffer.slice(-target.length);
      if (buffer === target) {
        setEasterEgg(true);
        buffer = '';
        setTimeout(() => setEasterEgg(false), 3000);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── Terminal typing sequence ── */
  useEffect(() => {
    if (phase !== 'typing') return;
    let idx = 0;
    let timeouts = [];

    const addLine = () => {
      if (idx >= TERMINAL_LINES.length) {
        const t = setTimeout(() => setPhase('revealing'), 300);
        timeouts.push(t);
        return;
      }
      const line = TERMINAL_LINES[idx];
      const delay = line.type === 'cmd' ? 80 : line.type === 'blank' ? 150 : 40;

      if (line.type === 'cmd') {
        let charIdx = 0;
        const chars = line.text;
        const typingId = setInterval(() => {
          charIdx++;
          setVisibleLines(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...line, text: chars.slice(0, charIdx) };
            return updated;
          });
          if (charIdx >= chars.length) {
            clearInterval(typingId);
            idx++;
            const t = setTimeout(addLine, 200);
            timeouts.push(t);
          }
        }, 20);
        timeouts.push(typingId);
        setVisibleLines(prev => [...prev, { ...line, text: chars.slice(0, 1) }]);
      } else {
        setVisibleLines(prev => [...prev, line]);
        idx++;
        const t = setTimeout(addLine, delay);
        timeouts.push(t);
      }
    };

    const startDelay = setTimeout(addLine, 300);
    timeouts.push(startDelay);

    return () => timeouts.forEach(t => { clearTimeout(t); clearInterval(t); });
  }, [phase]);

  /* ── Transition from revealing → revealed ── */
  useEffect(() => {
    if (phase !== 'revealing') return;
    const t = setTimeout(() => setPhase('revealed'), 900);
    return () => clearTimeout(t);
  }, [phase]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const skipTerminal = useCallback(() => {
    if (phase === 'typing') {
      setVisibleLines(TERMINAL_LINES);
      setPhase('revealing');
    }
  }, [phase]);

  return (
    <div className={`homepage ${phase === 'revealed' ? 'homepage--revealed' : ''}`}>
      <CoordinationRain />

      {/* ── Scanline overlay ── */}
      <div className="hp-scanline" aria-hidden="true" />

      {/* ── Easter egg overlay ── */}
      {easterEgg && (
        <div className="hp-easter-egg" aria-hidden="true">
          <div className="hp-easter-egg-text">
            <div className="hp-ee-line">$ gsync</div>
            <div className="hp-ee-line hp-ee-reveal">you found the secret_</div>
            <div className="hp-ee-line hp-ee-sub">happy hacking ✦</div>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className={`hp-nav ${phase === 'revealed' ? 'hp-nav--solid' : ''}`}>
        <div className="hp-nav-brand">~/gsync $</div>
        <div className="hp-nav-links">
          <a href="https://github.com/nwang783/nomergeconflicts" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <Link to="/login" className="hp-nav-cta">Log in</Link>
        </div>
      </nav>

      {/* ── Terminal hero ── */}
      <div
        className={`hp-terminal-hero ${phase === 'revealing' ? 'hp-terminal--shatter' : ''} ${phase === 'revealed' ? 'hp-terminal--gone' : ''}`}
        onClick={skipTerminal}
      >
        <div className="hp-terminal-window">
          <div className="hp-terminal-header">
            <span className="hp-terminal-dots"><span /><span /><span /></span>
            <span className="hp-terminal-title">gsync — coordination layer</span>
          </div>
          <div className="hp-terminal-body">
            {visibleLines.map((line, i) => {
              if (line.type === 'blank') return <div key={i} className="hp-term-line hp-term-blank">&nbsp;</div>;
              return (
                <div key={i} className={`hp-term-line ${line.cls || ''} ${line.type === 'cmd' ? 'term-cmd' : ''}`}>
                  {line.text}
                  {line.type === 'cmd' && i === visibleLines.length - 1 && phase === 'typing' && (
                    <span className="hp-cursor">▊</span>
                  )}
                </div>
              );
            })}
            {phase === 'typing' && visibleLines.length > 0 && visibleLines[visibleLines.length - 1].type !== 'cmd' && (
              <div className="hp-term-line term-cmd">
                <span className="hp-cursor">▊</span>
              </div>
            )}
            {phase === 'typing' && visibleLines.length === 0 && (
              <div className="hp-term-line term-cmd">
                <span className="hp-cursor">▊</span>
              </div>
            )}
          </div>
        </div>
        {phase === 'typing' && (
          <button className="hp-skip-btn" onClick={skipTerminal}>skip →</button>
        )}
      </div>

      {/* ── Main content (behind terminal) ── */}
      <div className={`hp-content ${phase === 'revealed' ? 'hp-content--visible' : ''}`}>

        {/* ── Network visualization ── */}
        <CoordinationNetwork />

        {/* ── Hero: left copy + CTAs, right terminal ── */}
        <section className="hp-tagline-section" ref={taglineRef}>
          <div className={`hp-hero hp-hero-parallax-target ${taglineVisible ? 'hp-fadeInUp' : ''}`}>
            <div className="hp-hero-copy">
              <p className="hp-hero-kicker">// beta</p>
              <h1 className="hp-hero-title">
                Coordination for teams coding with AI agents.
              </h1>
              <p className="hp-hero-lede">
                Shared goals, active plans, and touched surfaces — visible to every human and agent on the team
                before a single line of code is written.
              </p>
              <div className="hp-hero-actions">
                <a
                  href="https://github.com/nwang783/gsync/blob/main/SKILL.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hp-btn hp-btn--primary"
                >
                  Read the SKILL.md
                </a>
                <a
                  href="https://github.com/nwang783/nomergeconflicts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hp-btn hp-btn--ghost"
                >
                  GitHub →
                </a>
              </div>
            </div>

            <div className="hp-hero-terminal-col">
              <div className="hp-terminal-window hp-hero-terminal">
                <div className="hp-terminal-header">
                  <span className="hp-terminal-dots">
                    <span /><span /><span />
                  </span>
                  <span className="hp-terminal-title">gsync — tell your agents</span>
                </div>
                <div className="hp-terminal-cta-footer">
                  <div className="hp-terminal-cta-label">paste into your agent</div>
                  <div className="hp-terminal-cta-row">
                    <code className="hp-terminal-cta-cmd">{INSTALL_CMD}</code>
                    <button
                      type="button"
                      className={`hp-copy-btn ${copied ? 'hp-copy-btn--copied' : ''}`}
                      onClick={handleCopy}
                    >
                      {copied ? '✓ copied' : 'copy'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Steps timeline ── */}
        <section className="hp-timeline" ref={timelineRef}>
          <div className="hp-timeline-label">// how it works</div>
          <div className="hp-timeline-track">
            {STEPS.map((step, i) => (
              <div key={step.num} className="hp-timeline-step-wrap">
                <TimelineStep step={step} index={i} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="hp-footer">
          <div className="hp-footer-brand">~/gsync</div>
          <div className="hp-footer-links">
            <a href="https://github.com/nwang783/nomergeconflicts" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/nwang783/gsync/blob/main/SKILL.md" target="_blank" rel="noopener noreferrer">SKILL.md</a>
          </div>
          <div className="hp-footer-copy">Coordination for teams coding with AI agents.</div>
        </footer>
      </div>
    </div>
  );
}

/* ── Timeline step component ── */
function TimelineStep({ step, index }) {
  const [stepRef, stepVisible] = useReveal(0.08);

  return (
    <div
      ref={stepRef}
      className={`hp-timeline-step ${stepVisible ? 'hp-timeline-step--visible' : ''}`}
      style={{
        transitionDelay: stepVisible ? `${index * 120}ms` : '0ms',
        zIndex: index + 1,
        /* Same stick line + z-index = full overlap; margin between wraps does the stack */
        '--hp-sticky-top': '84px',
      }}
    >
      <div className="hp-timeline-node">
        <div className={`hp-timeline-dot ${stepVisible ? 'hp-timeline-dot--active' : ''}`} style={{ transitionDelay: `${index * 200 + 200}ms` }} />
      </div>
      <div className="hp-timeline-content">
        <div className="hp-timeline-num">{step.num}</div>
        <h3 className="hp-timeline-title">{step.title}</h3>
        <code className="hp-timeline-cmd">{step.cmd}</code>
        <p className="hp-timeline-desc">{step.desc}</p>
        <StepTerminal lines={step.terminalLines} active={stepVisible} />
      </div>
    </div>
  );
}
