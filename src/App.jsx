import React, { useState, useEffect } from 'react';
import { UploadCloud, KeyRound, Clock, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { UploadForm } from './components/UploadForm';
import { ShareResultCard } from './components/ShareResultCard';
import { RetrieveForm } from './components/RetrieveForm';
import { ActiveTransfers } from './components/ActiveTransfers';
import { Toast } from './components/Toast';

export default function App() {
  const [activeTab, setActiveTab] = useState('send'); // 'send', 'receive', 'active'
  const [currentResult, setCurrentResult] = useState(null);
  const [sessionUploads, setSessionUploads] = useState([]);
  const [urlCode, setUrlCode] = useState('');
  const [stats, setStats] = useState({ activeFiles: 0, totalPurged: 0 });
  const [toasts, setToasts] = useState([]);

  // Check URL query parameters for ?code=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setUrlCode(code.trim().toUpperCase());
      setActiveTab('receive');
    }

    // Load saved session uploads from localStorage
    const saved = localStorage.getItem('chronoshare_session_uploads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out expired items
        const valid = parsed.filter((item) => Date.now() < item.expiresAt);
        setSessionUploads(valid);
      } catch (e) {}
    }

    fetchStats();
    const statsInterval = setInterval(fetchStats, 10000);
    return () => clearInterval(statsInterval);
  }, []);

  // Sync session uploads to localStorage
  useEffect(() => {
    localStorage.setItem('chronoshare_session_uploads', JSON.stringify(sessionUploads));
  }, [sessionUploads]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (e) {}
  };

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleUploadSuccess = (result) => {
    setCurrentResult(result);
    setSessionUploads((prev) => [result, ...prev]);
    fetchStats();
    showToast(`Upload complete! Share code: ${result.code}`);
  };

  const handleResetUpload = () => {
    setCurrentResult(null);
  };

  const handleDeleteItem = async (code, deleteToken) => {
    try {
      const response = await fetch(`/api/delete/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken }),
      });

      const res = await response.json();
      if (response.ok && res.success) {
        showToast('File destroyed permanently.');
        setSessionUploads((prev) => prev.filter((item) => item.code !== code));
        if (currentResult?.code === code) {
          setCurrentResult(null);
        }
        fetchStats();
      } else {
        showToast(res.error || 'Failed to destroy file.');
      }
    } catch (e) {
      showToast('Error sending delete request.');
    }
  };

  return (
    <div className="app-wrapper">
      <Navbar stats={stats} onRefreshStats={fetchStats} />

      {/* Hero Header */}
      <div className="hero-title">
        <h1>
          Instant Ephemeral File Sharing with <span className="gradient-text">15-Min Threshold</span>
        </h1>
        <p>
          Upload files or text snippets securely. Files auto-destruct in 15 minutes.
          Share effortlessly via <strong>6-digit passcode</strong> or <strong>QR Code</strong>.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => { setActiveTab('send'); setCurrentResult(null); }}
        >
          <UploadCloud size={18} /> Send File / Snippet
        </button>
        <button
          className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
          onClick={() => setActiveTab('receive')}
        >
          <KeyRound size={18} /> Receive with Code
        </button>
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <Clock size={18} /> Session Uploads ({sessionUploads.length})
        </button>
      </div>

      {/* Main Tab Content */}
      <main style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'send' && (
          <>
            {!currentResult ? (
              <UploadForm onUploadSuccess={handleUploadSuccess} showToast={showToast} />
            ) : (
              <ShareResultCard
                shareData={currentResult}
                onReset={handleResetUpload}
                showToast={showToast}
                onDeleteSuccess={(code) => setSessionUploads((prev) => prev.filter((i) => i.code !== code))}
              />
            )}
          </>
        )}

        {activeTab === 'receive' && (
          <RetrieveForm initialCode={urlCode} showToast={showToast} />
        )}

        {activeTab === 'active' && (
          <ActiveTransfers
            activeItems={sessionUploads}
            onDeleteItem={handleDeleteItem}
            showToast={showToast}
          />
        )}
      </main>

      {/* Features Grid Footer */}
      <footer style={{ marginTop: 'auto', paddingTop: '4rem', paddingBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '2.5rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: 'var(--primary-cyan)', marginBottom: '0.5rem' }}><Clock size={24} /></div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Strict 15-Min TTL</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Automated server cleanup worker purges files from storage immediately after 15 minutes.
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: 'var(--primary-purple)', marginBottom: '0.5rem' }}><Sparkles size={24} /></div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>QR Code & Passcode</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Generate instant 6-digit access codes or high-res scan QR codes for direct mobile downloads.
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}><ShieldCheck size={24} /></div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Instant Self-Destruct</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Senders can manually self-destruct shared files anytime before the 15-minute expiration timer.
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          ChronoShare 15m • Secure Ephemeral Storage & Zero Trace Transfer Service
        </div>
      </footer>

      {/* Toast Feedback Banner */}
      <Toast toasts={toasts} />
    </div>
  );
}
