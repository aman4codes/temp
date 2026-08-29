import React, { useState } from 'react';
import { Copy, Clock, ShieldAlert, Trash2, Check, RefreshCw } from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { useCountdown } from '../hooks/useCountdown';
import { formatMinutesSeconds } from '../utils/fileHelpers';
import { deleteShareableItem } from '../services/apiService';

export function ShareResultCard({ shareData, onReset, showToast, onDeleteSuccess }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { remainingSeconds, isExpired, isUrgent } = useCountdown(shareData.expiresAt);

  const shareUrl = `${window.location.origin}${window.location.pathname}?code=${shareData.code}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareData.code);
    setCopiedCode(true);
    showToast(`Access Code ${shareData.code} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    showToast('Direct Share Link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSelfDestruct = async () => {
    if (!window.confirm('Are you sure you want to delete this file immediately? It will be erased permanently for all users.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteShareableItem(shareData.code, shareData.deleteToken);

      if (result.success) {
        showToast('File self-destructed successfully!');
        if (onDeleteSuccess) onDeleteSuccess(shareData.code);
        onReset();
      } else {
        showToast(result.error || 'Failed to delete file.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Error sending delete command.');
    } finally {
      setIsDeleting(false);
    }
  };

  const digits = shareData.code.split('');

  return (
    <div className="glass-panel code-display-card">
      <div className="code-title-badge">
        <ShieldAlert size={16} /> File Active • Auto Self-Destruct in 15 Mins
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
        {shareData.originalName}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Share using the <strong>6-digit passcode</strong> or scan the <strong>QR Code</strong> below.
      </p>

      {/* 6-Digit Code Display */}
      <div style={{ background: 'rgba(10, 16, 30, 0.7)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border-glass)' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Recipient Access Passcode
        </div>

        <div className="big-code-boxes">
          <div className="digit-box">{digits[0]}</div>
          <div className="digit-box">{digits[1]}</div>
          <div className="digit-box">{digits[2]}</div>
          <div className="code-dash">-</div>
          <div className="digit-box">{digits[3]}</div>
          <div className="digit-box">{digits[4]}</div>
          <div className="digit-box">{digits[5]}</div>
        </div>

        <button className="btn-secondary" onClick={handleCopyCode} style={{ marginTop: '0.5rem' }}>
          {copiedCode ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
          {copiedCode ? 'Code Copied!' : 'Copy 6-Digit Code'}
        </button>
      </div>

      {/* Live Countdown Timer */}
      <div className={`countdown-box ${isUrgent ? 'urgent' : ''}`}>
        <Clock size={22} className={isUrgent ? 'animate-pulse' : ''} />
        <span>
          {isExpired ? 'FILE EXPIRED & PURGED' : `Self-Destruct in ${formatMinutesSeconds(remainingSeconds)}`}
        </span>
      </div>

      {/* QR Code Section */}
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Scan QR Code to Download</h3>
        <QRCodeDisplay url={shareUrl} code={shareData.code} onCopyLink={handleCopyLink} showToast={showToast} />
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
        <button className="btn-secondary" onClick={onReset}>
          <RefreshCw size={16} /> Share Another File
        </button>
        <button className="btn-danger" onClick={handleSelfDestruct} disabled={isDeleting}>
          <Trash2 size={16} /> {isDeleting ? 'Purging...' : 'Destroy Immediately'}
        </button>
      </div>
    </div>
  );
}
