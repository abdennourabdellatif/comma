import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl: string;
  isMe: boolean;
}

export default function WaveformPlayer({ audioUrl, isMe }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isMe ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.2)',
      progressColor: isMe ? 'rgba(255, 255, 255, 1)' : 'rgba(59, 130, 246, 1)',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 30,
      url: audioUrl,
      cursorWidth: 0,
    });

    ws.on('ready', () => setIsReady(true));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [audioUrl, isMe]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <div className="flex items-center space-x-2 w-48 sm:w-64 mb-2" dir="ltr">
      <button
        onClick={togglePlay}
        disabled={!isReady}
        className={`p-2 rounded-full flex-shrink-0 ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} transition-colors disabled:opacity-50`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
