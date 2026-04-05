import { useState } from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'overview', icon: '~' },
  { id: 'me', label: 'me', icon: '>' },
  { id: 'activity', label: 'activity', icon: '$' },
];

export default function Sidebar({ active, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? 'x' : '='}
      </button>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo">gsync</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">// nav</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar-link ${active === item.id ? 'sidebar-link--active' : ''}`}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-section-label">// status</div>
          <div className="sidebar-status">
            <span className="sidebar-status-dot" />
            <span>connected</span>
          </div>
        </div>
      </aside>
    </>
  );
}
