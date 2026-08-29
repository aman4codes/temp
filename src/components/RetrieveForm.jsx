import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Download, FileText, Lock, Clock, ShieldAlert, ArrowRight, File, Copy, Check } from 'lucide-react';
import { formatFileSize, formatMinutesSeconds, getFileIcon } from '../utils/fileHelpers';
import { fetchFileMetadata as apiGetMetadata, downloadShareableItem } from '../services/apiService';
import { useCountdown } from '../hooks/useCountdown';

export function RetrieveForm({ initialCode, showToast }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  
  const [isLoading, setIsLoading] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [password, setPassword] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const { remainingSeconds, isExpired } = useCountdown(fileData?.expiresAt);

  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      const codeArray = initialCode.split('');
      setDigits(codeArray);
      fetchFileMetadata(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    if (isExpired && fileData) {
      setErrorMsg('This file has expired and been automatically purged.');
      setFileData(null);
    }
  }, [isExpired, fileData]);

  const handleDigitChange = (index, value) => {
    const val = value.toUpperCase().slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

    if (val && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      fetchFileMetadata(fullCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (pasted.length >= 6) {
      const newDigits = pasted.slice(0, 6).split('');
      setDigits(newDigits);
      fetchFileMetadata(newDigits.join(''));
    }
  };

  const fetchFileMetadata = async (codeToFetch) => {
    const code = codeToFetch || digits.join('');
    if (code.length < 6) {
      showToast('Please enter full 6-digit passcode.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setFileData(null);

    try {
      const result = await apiGetMetadata(code);

      if (!result.expired) {
        setFileData(result);
      } else {
        setErrorMsg(result.error || 'File not found or expired.');
      }
    } catch (err) {
      console.error('Fetch file error:', err);
      setErrorMsg('Server connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fileData) return;

    if (fileData.hasPassword && !password) {
      showToast('Please enter the password set by the sender.');
      return;
    }

    setIsDownloading(true);

    try {
      const response = await downloadShareableItem(fileData.code, password);

      if (!response.ok) {
        const errorResult = await response.json();
        showToast(errorResult.error || 'Download failed.');
        setIsDownloading(false);
        return;
      }

      if (fileData.type === 'text') {
        const textResult = await response.json();
        setFileData((prev) => ({ ...prev, textContent: textResult.textContent }));
        showToast('Text content unlocked!');
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileData.originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast(`Downloading ${fileData.originalName}...`);
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('Error downloading file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyTextSnippet = () => {
    if (fileData?.textContent) {
      navigator.clipboard.writeText(fileData.textContent);
      setCopiedText(true);
      showToast('Text snippet copied to clipboard!');
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  return (
    <div className="glass-panel">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', padding: '0.85rem', borderRadius: '16px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-cyan)', marginBottom: '1rem' }}>
          <KeyRound size={32} />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Enter Share Passcode
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Type the 6-digit code provided by the sender to claim file or text snippet
        </p>
      </div>

      {/* 6 Digit Inputs */}
      <div className="code-input-wrapper" onPaste={handlePaste}>
        {digits.map((digit, idx) => (
          <React.Fragment key={idx}>
            <input
              ref={inputRefs[idx]}
              type="text"
              className="single-digit-input"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              placeholder="•"
            />
            {idx === 2 && <span style={{ alignSelf: 'center', fontSize: '1.5rem', color: 'var(--text-dim)' }}>-</span>}
          </React.Fragment>
        ))}
      </div>

      <button
        className="btn-primary"
        onClick={() => fetchFileMetadata()}
        disabled={isLoading || digits.join('').length < 6}
      >
        {isLoading ? 'Accessing Secure Vault...' : 'Access Shared Content'} <ArrowRight size={18} />
      </button>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '14px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: 'var(--accent-rose)', textAlign: 'center', fontWeight: 600 }}>
          <ShieldAlert size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {errorMsg}
        </div>
      )}

      {/* File Found Result Card */}
      {fileData && (
        <div style={{ marginTop: '2rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-glass)', animation: 'slideInRight 0.3s ease' }}>
          <div className="file-selected-box" style={{ background: 'rgba(10, 16, 30, 0.8)' }}>
            <div className="file-info">
              <div className="file-icon">
                {fileData.type === 'text' ? <FileText size={26} /> : getFileIcon(fileData.mimeType, 26)}
              </div>
              <div>
                <div className="file-meta-name" title={fileData.originalName}>
                  {fileData.originalName}
                </div>
                <div className="file-meta-size">
                  {formatFileSize(fileData.size)} • {fileData.mimeType}
                </div>
              </div>
            </div>
            <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--primary-cyan)' }}>
              {fileData.type}
            </div>
          </div>

          {/* Countdown Clock for Recipient */}
          <div className={`countdown-box ${remainingSeconds < 180 ? 'urgent' : ''}`}>
            <Clock size={20} />
            <span>Expires in {formatMinutesSeconds(remainingSeconds)}</span>
          </div>

          {/* Password field if protected */}
          {fileData.hasPassword && !fileData.textContent && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)' }}>
                <Lock size={15} /> Password Protected File
              </label>
              <input
                type="password"
                className="text-input"
                placeholder="Enter password to unlock download"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {/* Text Snippet Display if unlocked */}
          {fileData.type === 'text' && fileData.textContent && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label">Shared Text Content</label>
                <button className="btn-secondary" onClick={handleCopyTextSnippet} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                  {copiedText ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedText ? 'Copied' : 'Copy Text'}
                </button>
              </div>
              <textarea
                className="text-area-input"
                readOnly
                value={fileData.textContent}
                rows={7}
              />
            </div>
          )}

          {/* Action Button */}
          {fileData.type === 'file' && (
            <button
              className="btn-primary"
              onClick={handleDownload}
              disabled={isDownloading}
              style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, var(--accent-emerald), var(--primary-blue))' }}
            >
              <Download size={20} /> {isDownloading ? 'Preparing File...' : 'Download File'}
            </button>
          )}

          {fileData.type === 'text' && fileData.hasPassword && !fileData.textContent && (
            <button
              className="btn-primary"
              onClick={handleDownload}
              disabled={isDownloading}
              style={{ marginTop: '1.5rem' }}
            >
              <Lock size={20} /> {isDownloading ? 'Unlocking...' : 'Unlock Text Snippet'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
