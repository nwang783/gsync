import { useState } from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'overview', icon: '~' },
  { id: 'me', label: 'me', icon: '>' },
];

export default function Sidebar({ active, onNavigate, onLogout, seatName, role }) {
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

        {(seatName || role) && (
          <div className="sidebar-identity sidebar-identity--footer">
            <div className="sidebar-identity-card">
              <div className="sidebar-identity-kicker">current seat</div>
              {seatName && <div className="sidebar-seat-name">{seatName}</div>}
              {role && <div className="sidebar-role-label">{role}</div>}
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          {onLogout && (
            <button className="sidebar-link sidebar-logout" onClick={onLogout}>
              <span className="sidebar-link-icon">×</span>
              <span className="sidebar-link-label">logout</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
