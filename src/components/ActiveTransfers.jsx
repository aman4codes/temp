import React, { useState } from 'react';
import { Clock, Copy, Trash2, Check, ExternalLink } from 'lucide-react';
import { formatFileSize, formatMinutesSeconds } from '../utils/fileHelpers';
import { useCountdown } from '../hooks/useCountdown';

export function ActiveTransfers({ activeItems, onDeleteItem, showToast }) {
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyLink = (code) => {
    const url = `${window.location.origin}${window.location.pathname}?code=${code}`;
    navigator.clipboard.writeText(url);
    showToast('Direct Share Link copied!');
  };

  if (!activeItems || activeItems.length === 0) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          <Clock size={32} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Active Files in Session</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Files you upload in this browser session will appear here with live self-destruct timers.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Active Session Uploads</h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--primary-cyan)', fontWeight: 600 }}>
          {activeItems.length} {activeItems.length === 1 ? 'file' : 'files'} active
        </span>
      </div>

      <div className="transfers-grid">
        {activeItems.map((item) => (
          <TransferCardItem
            key={item.code}
            item={item}
            copiedCode={copiedCode}
            onCopy={handleCopy}
            onCopyLink={handleCopyLink}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>
    </div>
  );
}

function TransferCardItem({ item, copiedCode, onCopy, onCopyLink, onDeleteItem }) {
  const { remainingSeconds, isExpired, isUrgent } = useCountdown(item.expiresAt);

  return (
    <div className="transfer-card">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.originalName}>
            {item.originalName}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-cyan)', fontWeight: 700 }}>
            {item.code}
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Size: {formatFileSize(item.size)} • Type: {item.type}
        </div>

        {/* Live Expiration Clock */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: isUrgent ? 'var(--accent-rose)' : 'var(--accent-amber)',
          padding: '0.4rem 0.75rem',
          borderRadius: '8px',
          background: isUrgent ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)'
        }}>
          <Clock size={14} />
          <span>{isExpired ? 'PURGED' : `Purges in ${formatMinutesSeconds(remainingSeconds)}`}</span>
        </div>
      </div>

      {/* Card Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => onCopy(item.code)}>
          {copiedCode === item.code ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          {copiedCode === item.code ? 'Copied' : 'Code'}
        </button>

        <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => onCopyLink(item.code)} title="Copy shareable link">
          <ExternalLink size={14} />
        </button>

        <button className="btn-danger" style={{ padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => onDeleteItem(item.code, item.deleteToken)} title="Destroy immediately">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
