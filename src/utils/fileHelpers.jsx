import React from 'react';
import { File, Image, Music, Video, Archive, Code } from 'lucide-react';

export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatMinutesSeconds = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const getFileIcon = (mimeType, size = 28) => {
  if (!mimeType) return <File size={size} />;
  if (mimeType.startsWith('image/')) return <Image size={size} />;
  if (mimeType.startsWith('audio/')) return <Music size={size} />;
  if (mimeType.startsWith('video/')) return <Video size={size} />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <Archive size={size} />;
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html') || mimeType.includes('css')) return <Code size={size} />;
  return <File size={size} />;
};
