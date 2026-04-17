import { useEffect, useMemo, useRef, useState } from 'react';
import { useReveal } from '../../hooks/useReveal.js';
import TerminalPanel from './TerminalPanel.jsx';

export default function WorkflowSection({ sectionRef, steps }) {
  const [introRef, introVisible] = useReveal(0.15);
  const itemRefs = useRef([]);
  const [activeId, setActiveId] = useState(steps[0]?.id ?? null);

  useEffect(() => {
    const elements = itemRefs.current.filter(Boolean);
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top - window.innerHeight * 0.36) -
              Math.abs(right.boundingClientRect.top - window.innerHeight * 0.36)
          );

        if (visibleEntries[0]) {
          setActiveId(visibleEntries[0].target.dataset.stepId);
        }
      },
      {
        threshold: [0.15, 0.35, 0.6],
        rootMargin: '-15% 0px -45% 0px',
      }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [steps]);

  const activeStep = useMemo(
    () => steps.find((step) => step.id === activeId) ?? steps[0],
    [activeId, steps]
  );

  return (
    <section className="landing-workflow" ref={sectionRef}>
      <div
        ref={introRef}
        className={`landing-section-head ${introVisible ? 'is-visible' : ''}`}
      >
        <p className="landing-section-head__label">how it works</p>
        <h2 className="landing-section-head__title">A tighter loop between planning, coding, and the rest of the team.</h2>
        <p className="landing-section-head__body">
          The point is not to flood everyone with documents. The point is to make the current intent legible at the exact moment a human or agent is about to act on the repo.
        </p>
      </div>

      <div className="landing-workflow__grid">
        <aside className="landing-workflow__sticky">
          <div className="landing-workflow__sticky-frame">
            <h3 className="landing-workflow__sticky-title">{activeStep.title}</h3>
            <div className="landing-workflow__step-nav" aria-label="workflow steps">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`landing-workflow__step-pill ${activeId === step.id ? 'is-active' : ''}`}
                >
                  <span>{step.number}</span>
                </div>
              ))}
            </div>
            <TerminalPanel
              title={activeStep.previewTitle}
              lines={activeStep.previewLines}
              footer={activeStep.footer}
              className="landing-terminal--sticky"
            />
          </div>
        </aside>

        <div className="landing-workflow__steps">
          {steps.map((step, index) => (
            <article
              key={step.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              data-step-id={step.id}
              className={`landing-step ${activeId === step.id ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveId(step.id)}
            >
              <div className="landing-step__index">{step.number}</div>
              <div className="landing-step__content">
                <p className="landing-step__kicker">{step.kicker}</p>
                <h3 className="landing-step__title">{step.title}</h3>
                <p className="landing-step__body">{step.body}</p>
                <p className="landing-step__detail">{step.detail}</p>
                <div className="landing-step__tags" aria-label={`${step.title} tags`}>
                  {step.tags.map((tag) => (
                    <span key={tag} className="landing-step__tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
