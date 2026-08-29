import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Lock, X, CheckCircle2 } from 'lucide-react';
import { formatFileSize, getFileIcon } from '../utils/fileHelpers';
import { uploadShareableItem } from '../services/apiService';

export function UploadForm({ onUploadSuccess, showToast }) {
  const [mode, setMode] = useState('file'); // 'file' or 'text'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  
  // Text Mode state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Options state
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  
  // Upload status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'file' && !selectedFile) {
      showToast('Please select or drop a file first!');
      return;
    }

    if (mode === 'text' && !textContent.trim()) {
      showToast('Please enter text content to share.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('mode', mode);
    if (usePassword && password) {
      formData.append('password', password);
    }

    if (mode === 'file') {
      formData.append('file', selectedFile);
    } else {
      formData.append('title', textTitle || 'Untitled Snippet.txt');
      formData.append('textContent', textContent);
    }

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 15));
    }, 150);

    try {
      const result = await uploadShareableItem(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          onUploadSuccess(result);
        }, 400);
      } else {
        setIsUploading(false);
        setUploadProgress(0);
        showToast(result.error || 'Upload failed. Please try again.');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      console.error('Upload Error:', err);
      showToast('Network error while uploading.');
    }
  };

  return (
    <div className="glass-panel">
      {/* Mode Selector */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <button
          type="button"
          className={`tab-btn ${mode === 'file' ? 'active' : ''}`}
          onClick={() => setMode('file')}
        >
          <UploadCloud size={18} /> Upload File
        </button>
        <button
          type="button"
          className={`tab-btn ${mode === 'text' ? 'active' : ''}`}
          onClick={() => setMode('text')}
        >
          <FileText size={18} /> Paste Text / Snippet
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'file' ? (
          <div>
            {!selectedFile ? (
              <div
                className={`dropzone ${isDragActive ? 'drag-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-icon">
                  <UploadCloud size={32} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Drag & Drop your file here
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  or <span style={{ color: 'var(--primary-cyan)', textDecoration: 'underline' }}>browse from device</span>
                </p>
                <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Max file size: 100MB • Auto self-destructs after <strong>15 minutes</strong>
                </div>
              </div>
            ) : (
              <div className="file-selected-box">
                <div className="file-info">
                  <div className="file-icon">
                    {getFileIcon(selectedFile.type)}
                  </div>
                  <div>
                    <div className="file-meta-name" title={selectedFile.name}>
                      {selectedFile.name}
                    </div>
                    <div className="file-meta-size">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown format'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  style={{ padding: '0.5rem' }}
                  onClick={() => setSelectedFile(null)}
                  title="Remove file"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label className="form-label">Snippet Title (Optional)</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. WiFi Password, Confidential API Key, Code Snippet..."
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Text Content</label>
              <textarea
                className="text-area-input"
                placeholder="Type or paste secret text here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
              />
            </div>
          </div>
        )}

        {/* Security Options */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              style={{ accentColor: 'var(--primary-cyan)', width: '16px', height: '16px' }}
            />
            <Lock size={15} color={usePassword ? '#00f2fe' : '#64748b'} />
            Protect with Passcode
          </label>

          {usePassword && (
            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <input
                type="password"
                className="text-input"
                placeholder="Enter password required to open/download"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Upload Progress Bar */}
        {isUploading && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--primary-cyan)', fontWeight: 600, marginBottom: '0.35rem' }}>
              <span>Uploading & Encrypting...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary-cyan), var(--primary-purple))',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={isUploading}>
          <CheckCircle2 size={20} />
          {isUploading ? 'Securing File...' : 'Generate 15-Min Share Link & Code'}
        </button>
      </form>
    </div>
  );
}
