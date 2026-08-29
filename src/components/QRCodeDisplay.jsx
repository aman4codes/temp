import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode, Copy } from 'lucide-react';

export function QRCodeDisplay({ url, code, onCopyLink, showToast }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(
        canvasRef.current,
        url,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('Error rendering QR Code:', error);
        }
      );
    }
  }, [url]);

  const handleDownloadQR = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `ChronoShare-QR-${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) showToast('QR Code saved as image!');
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
      <div className="qr-container">
        <canvas ref={canvasRef} className="qr-canvas" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button className="btn-secondary" onClick={handleDownloadQR} title="Download PNG image of this QR code">
          <Download size={16} /> Save QR Image
        </button>
        <button className="btn-secondary" onClick={onCopyLink} title="Copy shareable direct URL">
          <Copy size={16} /> Copy Share Link
        </button>
      </div>
    </div>
  );
}
