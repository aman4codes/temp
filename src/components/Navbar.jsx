import React from 'react';
import { Clock, ShieldCheck, HardDrive, RefreshCw } from 'lucide-react';

export function Navbar({ stats, onRefreshStats }) {
  return (
    <header className="app-header">
      <a href="#" className="brand-logo" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
        <div className="brand-icon-wrapper">
          <Clock size={24} color="#ffffff" />
        </div>
        <div>
          <div className="brand-title">ChronoShare</div>
          <span className="brand-badge">⚡ 15-Min TTL Vault</span>
        </div>
      </a>

      <div className="header-stats">
        <div className="stat-pill" title="Current active files live on server">
          <HardDrive size={15} color="#00f2fe" />
          <span>Active Vault Files: <strong>{stats?.activeFiles ?? 0}</strong></span>
        </div>
        <div className="stat-pill" title="Total files automatically purged after 15 mins">
          <ShieldCheck size={15} color="#10b981" />
          <span>Self-Destructed: <strong>{stats?.totalPurged ?? 0}</strong></span>
        </div>
        <button 
          className="btn-secondary" 
          onClick={onRefreshStats}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '10px' }}
          title="Refresh statistics"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
}
