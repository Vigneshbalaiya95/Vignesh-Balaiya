import React, { useState, useEffect, useRef } from 'react';
import { AppIconConfig, ListingConfig, StoreListing } from '../types';
import { Download, Sparkles, Smartphone, Copy, Check, Info, FileCode, Hammer, Settings, Image as ImageIcon, Send, ArrowRight, Laptop } from 'lucide-react';

interface PlayStoreStudioProps {
  capturedScreenshots: string[];
  onRemoveScreenshot: (idx: number) => void;
}

export default function PlayStoreStudio({ capturedScreenshots, onRemoveScreenshot }: PlayStoreStudioProps) {
  // App Icon Creator States
  const [iconConfig, setIconConfig] = useState<AppIconConfig>({
    backgroundColor: '#0a0f1d',
    snakeColor: '#3cbfaf',
    styleType: 'snake-bit',
    textOverlay: 'SBIT',
    textColor: '#ffffff',
    borderColor: '#22d3ee',
    enableGridBackground: true,
  });

  // AI Listing Form States
  const [listingConfig, setListingConfig] = useState<ListingConfig>({
    appName: 'Snake Bit Games',
    gameModes: ['Classic Grid', 'Time Dash', 'Obstacle Maze', 'Chameleon Combo'],
    keyFeature: 'Buttery smooth neon physics with responsive digital sound effects',
    targetAudience: 'Indie arcade enthusiasts looking for instant offline high score action',
    tone: 'retro-arcade',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatedListing, setGeneratedListing] = useState<StoreListing | null>(null);
  const [apiNote, setApiNote] = useState<string | null>(null);

  // Editable screenshot labels
  const [screenshotLabels, setScreenshotLabels] = useState<string[]>([
    'ARCADE CLASSIC REDEFINED',
    'HIGH ENERGY VELOCITY BOOSTS',
    'NAVIGATE TRICKY DEFENSE MAZES',
    'COLOR MATCH SENSATIONAL PUZZLES',
  ]);

  // Canvas Refs
  const iconCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphicCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Copy to clipboard helper
  const handleCopyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Draw App Icon 512x512
  const drawAppIcon = () => {
    const canvas = iconCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;

    // Background
    ctx.fillStyle = iconConfig.backgroundColor;
    ctx.fillRect(0, 0, size, size);

    // Optional Grid pattern
    if (iconConfig.enableGridBackground) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const step = size / 16;
      for (let i = 0; i <= size; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    }

    // Outer Neon border
    ctx.strokeStyle = iconConfig.borderColor;
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, size - 12, size - 12);

    // Main Snake Icon graphics based on style selected
    ctx.save();
    ctx.shadowColor = iconConfig.snakeColor;
    ctx.shadowBlur = 15;

    if (iconConfig.styleType === 'classic-pixel') {
      ctx.fillStyle = iconConfig.snakeColor;
      // Draw pixel blocks
      const blockSize = size / 12;
      const points = [
        { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, 
        { x: 5, y: 6 }, { x: 5, y: 5 }, { x: 6, y: 5 },
        { x: 7, y: 5 }, { x: 7, y: 4 }, { x: 7, y: 3 },
      ];
      points.forEach(pt => {
        ctx.fillRect(pt.x * blockSize, pt.y * blockSize, blockSize - 2, blockSize - 2);
      });
      // Draw glowing apple
      ctx.fillStyle = '#ff2a5f';
      ctx.shadowColor = '#ff2a5f';
      ctx.fillRect(8 * blockSize, 3 * blockSize, blockSize - 2, blockSize - 2);

    } else if (iconConfig.styleType === 's-curve') {
      ctx.strokeStyle = iconConfig.snakeColor;
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(size * 0.25, size * 0.75);
      ctx.bezierCurveTo(size * 0.25, size * 0.3, size * 0.75, size * 0.7, size * 0.75, size * 0.25);
      ctx.stroke();

      // Shiny head eyes
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(size * 0.75, size * 0.25, 6, 0, Math.PI * 2);
      ctx.fill();

    } else if (iconConfig.styleType === 'eight-bit-fruit') {
      // Draw classic cherry / apple fruit shape
      ctx.fillStyle = '#ff2a5f';
      ctx.shadowColor = '#ff2a5f';
      ctx.beginPath();
      ctx.arc(center - 15, center + 10, 45, 0, Math.PI * 2);
      ctx.arc(center + 15, center + 10, 45, 0, Math.PI * 2);
      ctx.fill();
      
      // Stem
      ctx.strokeStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(center, center - 20);
      ctx.quadraticCurveTo(center + 20, center - 60, center + 30, center - 70);
      ctx.stroke();

    } else { // 'snake-bit'
      // Minimal modern circular layout path
      ctx.strokeStyle = iconConfig.snakeColor;
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(center, center, size * 0.28, 0.15 * Math.PI, 1.65 * Math.PI);
      ctx.stroke();

      // Eating small neon dot
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.beginPath();
      ctx.arc(center + size * 0.25, center - size * 0.12, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Text Overlay
    if (iconConfig.textOverlay) {
      ctx.fillStyle = iconConfig.textColor;
      ctx.font = '900 68px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Text shadow glow
      ctx.save();
      ctx.shadowColor = iconConfig.textColor;
      ctx.shadowBlur = 8;
      ctx.fillText(iconConfig.textOverlay.toUpperCase(), center, size - 75);
      ctx.restore();
    }
  };

  // Draw Feature Graphic 1024x500
  const drawFeatureGraphic = () => {
    const canvas = graphicCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Linear gradient background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.5, iconConfig.backgroundColor);
    grad.addColorStop(1, '#090d1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Neon Grid cells lines
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let i = 0; i < w; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
    }
    for (let j = 0; j < h; j += step) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
    }

    // Modern glowing design waves
    ctx.fillStyle = 'rgba(60, 191, 175, 0.05)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(w * 0.25, h * 0.4, w * 0.5, h * 0.8, w * 0.75, h * 0.3);
    ctx.lineTo(w, h * 0.1);
    ctx.lineTo(w, h);
    ctx.fill();

    // Giant glowing title
    ctx.save();
    ctx.shadowColor = iconConfig.snakeColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 84px "Space Grotesk", sans-serif';
    ctx.fillText((listingConfig.appName || 'SNAKE BIT').toUpperCase(), 120, h / 2 - 20);

    // Subtitle tagline
    ctx.shadowBlur = 10;
    ctx.fillStyle = iconConfig.snakeColor;
    ctx.font = '500 32px "JetBrains Mono", monospace';
    ctx.fillText('• 100% OFFLINE RETRO SENSATION', 124, h / 2 + h * 0.12);
    ctx.restore();

    // Simulated device mockup preview on the right
    ctx.strokeStyle = '#ffffff20';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#020617ee';
    ctx.beginPath();
    ctx.roundRect(w - 380, h / 2 - 170, 240, 340, 20);
    ctx.stroke();
    ctx.fill();

    // Draw snake character inside device preview
    ctx.save();
    ctx.shadowColor = iconConfig.snakeColor;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = iconConfig.snakeColor;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w - 260, h / 2 - 10, 50, 0.25 * Math.PI, 1.45 * Math.PI);
    ctx.stroke();

    // Food dot in mockup
    ctx.fillStyle = '#ff2a5f';
    ctx.beginPath();
    ctx.arc(w - 240, h / 2 + 50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Download trigger
  const triggerImageDownload = (canvasRef: React.RefObject<HTMLCanvasElement | null>, filename: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Re-draw when config parameters changes
  useEffect(() => {
    drawAppIcon();
    drawFeatureGraphic();
  }, [iconConfig, listingConfig.appName]);

  // Request high conversion listing from Express + Gemini
  const generateAIStoreListing = async () => {
    setIsLoading(true);
    setApiNote(null);
    try {
      const response = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: listingConfig }),
      });
      const data = await response.json();
      if (data.success) {
        setGeneratedListing(data.listing);
        if (data.note) {
          setApiNote(data.note);
        }
      } else {
        throw new Error(data.error || 'Server error generating listing copy');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Download custom screenshot frame
  const downloadScreenshotFrame = (dataUrl: string, label: string, index: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient canvas
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#090e1d');
    grad.addColorStop(1, '#0e172e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative futuristic background grid vectors
    ctx.strokeStyle = '#ffffff05';
    ctx.lineWidth = 2;
    for (let idx = 0; idx < 1080; idx += 80) {
      ctx.beginPath(); ctx.moveTo(idx, 0); ctx.lineTo(idx, 1920); ctx.stroke();
    }

    // Premium glowing heading
    ctx.shadowColor = iconConfig.snakeColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label.toUpperCase(), 540, 240);
    
    // Subtext title
    ctx.fillStyle = iconConfig.snakeColor;
    ctx.font = '500 28px "JetBrains Mono", monospace';
    ctx.fillText(`• ${listingConfig.appName.toUpperCase()} RETRO REMASTER •`, 540, 310);
    ctx.shadowBlur = 0;

    // Load actual game snapshot and draw it inside phone frame mockup
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      // Phone Frame drawing
      ctx.strokeStyle = '#ffffff25';
      ctx.lineWidth = 14;
      ctx.fillStyle = '#020617';
      
      // Coordinate layout values
      const fx = 120;
      const fy = 400;
      const fw = 840;
      const fh = 1320;
      const r = 40;

      ctx.beginPath();
      ctx.roundRect(fx, fy, fw, fh, r);
      ctx.stroke();
      ctx.fill();

      // Draw game content canvas clipped cleanly inside device
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(fx + 10, fy + 10, fw - 20, fh - 20, r - 10);
      ctx.clip();
      ctx.drawImage(img, fx + 10, fy + 10, fw - 20, fh - 20);
      ctx.restore();

      // Home indicator / speaker pill details
      ctx.fillStyle = '#ffffff15';
      ctx.beginPath();
      ctx.roundRect(540 - 80, fy + 40, 160, 25, 12);
      ctx.fill();

      // Draw shiny corner gloss
      ctx.strokeStyle = '#ffffff10';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(fx + 12, fy + 12, fw - 24, fh - 24, r - 12);
      ctx.stroke();

      // Trigger automatic file download
      const resultUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = resultUrl;
      a.download = `snakebit-playstore-screenshot-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
  };

  // Generated configuration boilerplate manifests for copy panel
  const customManifestJSON = `{
  "name": "${listingConfig.appName}",
  "short_name": "SnakeBit",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "${iconConfig.backgroundColor}",
  "theme_color": "${iconConfig.borderColor}",
  "icons": [
    {
      "src": "icon_512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}`;

  const customAndroidManifestXML = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.snakebit.games.retro">
    
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE"/>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${listingConfig.appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  // Export full raw Single-File Standalone HTML Game trigger!
  const downloadStandaloneHTML = () => {
    const rawHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${listingConfig.appName} - Standard Retro Release</title>
  <style>
    body {
      background: ${iconConfig.backgroundColor};
      color: #fafaf9;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      overflow: hidden;
    }
    #game-container {
      position: relative;
      border: 6px solid ${iconConfig.borderColor};
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    canvas {
      background: #0f172a;
      display: block;
      border-radius: 10px;
    }
    #hud {
      display: flex;
      justify-content: space-between;
      width: 400px;
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: bold;
    }
    .score-txt { color: ${iconConfig.snakeColor}; }
  </style>
</head>
<body>
  <h2>${listingConfig.appName}</h2>
  <div id="hud">
    <div>SCORE: <span id="score" class="score-txt">0</span></div>
    <div>READY: PRESS SPACE</div>
  </div>
  <div id="game-container">
    <canvas id="stage" width="400" height="400"></canvas>
  </div>
  <script>
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');
    const grid = 20;
    const tileCount = canvas.width / grid;
    
    let snake = [{x: 10, y: 10}, {x:10, y:11}, {x:10, y:12}];
    let dir = {x: 0, y: -1};
    let food = {x: 5, y: 5};
    let score = 0;
    let playing = false;

    function reset() {
      snake = [{x: 10, y: 10}, {x:10, y:11}, {x:10, y:12}];
      dir = {x: 0, y: -1};
      score = 0;
      document.getElementById('score').innerText = score;
      spawnFood();
      playing = true;
    }

    function spawnFood() {
      food.x = Math.floor(Math.random() * tileCount);
      food.y = Math.floor(Math.random() * tileCount);
    }

    document.addEventListener('keydown', e => {
      if (e.code === 'ArrowUp' && dir.y === 0) dir = {x:0, y:-1};
      if (e.code === 'ArrowDown' && dir.y === 0) dir = {x:0, y:1};
      if (e.code === 'ArrowLeft' && dir.x === 0) dir = {x:-1, y:0};
      if (e.code === 'ArrowRight' && dir.x === 0) dir = {x:1, y:0};
      if (e.code === 'Space') {
        if (!playing) reset();
      }
    });

    function loop() {
      if (!playing) {
        ctx.fillStyle = '#060b18';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS SPACE TO PLAY', canvas.width/2, canvas.height/2);
        return;
      }

      // Physics Move
      const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
      
      // Crashing
      if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        playing = false;
      }
      
      for(let part of snake) {
        if (part.x === head.x && part.y === head.y) playing = false;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('score').innerText = score;
        spawnFood();
      } else {
        snake.pop();
      }

      // Render Stage
      ctx.fillStyle = '#090d1f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Food
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(food.x * grid + 1, food.y * grid + 1, grid - 2, grid - 2);

      // Draw Snake
      snake.forEach((part, idx) => {
        ctx.fillStyle = idx === 0 ? "${iconConfig.snakeColor}" : "${iconConfig.snakeColor}bb";
        ctx.fillRect(part.x * grid + 1, part.y * grid + 1, grid - 2, grid - 2);
      });
    }

    setInterval(loop, 100);
  </script>
</body>
</html>`;

    const blob = new Blob([rawHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snakebit-standalone-export.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export all Play Store listing metadata and screenshot configurations as portable JSON schema
  const downloadPortabilityJSON = () => {
    const portabilityData = {
      exportedAt: new Date().toISOString(),
      generator: "Snake Bit Studio Portal Config System",
      developerEmail: "vigneshbalaiya08@gmail.com",
      appMetadata: {
        appName: listingConfig.appName,
        iconConfig: iconConfig,
        listingConfig: listingConfig,
        generatedListing: generatedListing,
      },
      screenshotCatalog: {
        totalScreenshots: capturedScreenshots.length,
        screenshotLabels: screenshotLabels,
        screenshots: capturedScreenshots.map((imgUrl, idx) => ({
          index: idx,
          suggestedLabel: screenshotLabels[idx] || `Captured Gameplay frame ${idx + 1}`,
          imageDataUrl: imgUrl,
        })),
      }
    };

    const jsonString = JSON.stringify(portabilityData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${listingConfig.appName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_playstore_portability.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. VISUAL ASSET CREATOR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Visual asset controls */}
        <div className="xl:col-span-4 bg-[#0D0D0D] border border-white/5 p-6 rounded flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-[#4ADE80] w-5 h-5" />
            <h3 className="font-serif italic text-white text-lg">Visual Asset Studio</h3>
          </div>
          <p className="text-xs text-white/40 font-sans leading-relaxed">
            Configure beautiful high-res icons and horizontal feature graphics needed by the Google Play Store console.
          </p>

          <div className="space-y-4">
            {/* Background Color */}
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5 font-bold">Asset Theme Fill</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { hex: '#0a0f1d', label: 'Obsidian' },
                  { hex: '#1c1917', label: 'Stone' },
                  { hex: '#0f172a', label: 'Slate' },
                  { hex: '#ff2a5f', label: 'Shocking' },
                  { hex: '#ff5e00', label: 'Lava' }
                ].map(col => (
                  <button
                    key={col.hex}
                    onClick={() => setIconConfig(prev => ({ ...prev, backgroundColor: col.hex }))}
                    className={`w-7 h-7 rounded border transition-all cursor-pointer ${
                      iconConfig.backgroundColor === col.hex ? 'border-[#4ADE80] scale-105' : 'border-white/10'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.label}
                  />
                ))}
              </div>
            </div>

            {/* Snake Character Color */}
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5 font-bold">Snake Glow Tint</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { hex: '#3cbfaf', label: 'Neon Teal' },
                  { hex: '#4ade80', label: 'Green Emerald' },
                  { hex: '#eab308', label: 'Star Yellow' },
                  { hex: '#ff2a5f', label: 'Neon Pink' },
                  { hex: '#a855f7', label: 'Wizard Purple' }
                ].map(col => (
                  <button
                    key={col.hex}
                    onClick={() => setIconConfig(prev => ({ ...prev, snakeColor: col.hex }))}
                    className={`w-7 h-7 rounded border transition-all cursor-pointer ${
                      iconConfig.snakeColor === col.hex ? 'border-[#4ADE80] scale-105' : 'border-white/10'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.label}
                  />
                ))}
              </div>
            </div>

            {/* Snake Character Style selector */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Snake Icon Layout</label>
              <select
                value={iconConfig.styleType}
                onChange={e => setIconConfig(prev => ({ ...prev, styleType: e.target.value as any }))}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 text-xs font-sans outline-none focus:border-teal-500/50"
              >
                <option value="classic-pixel">Classic 8-Bit Pixel Block</option>
                <option value="s-curve">Smooth Vector S-Curve</option>
                <option value="eight-bit-fruit">Giant Glossy Golden Fruit</option>
                <option value="snake-bit">Neon Orbital Hollow Snake</option>
              </select>
            </div>

            {/* Border glow configuration */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Icon Stroke Accent</label>
              <div className="flex gap-2">
                {['#22d3ee', '#ef4444', '#f59e0b', '#10b981', '#ffffff'].map(col => (
                  <button
                    key={col}
                    onClick={() => setIconConfig(prev => ({ ...prev, borderColor: col }))}
                    className={`w-6 h-6 rounded-full border cursor-pointer ${
                      iconConfig.borderColor === col ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Text Overlay Field */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Launch Badge Initials</label>
              <input
                type="text"
                maxLength={5}
                value={iconConfig.textOverlay}
                onChange={e => setIconConfig(prev => ({ ...prev, textOverlay: e.target.value }))}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs font-mono tracking-widest"
                placeholder="e.g. SBIT"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-850">
              <input
                id="enable-grid"
                type="checkbox"
                checked={iconConfig.enableGridBackground}
                onChange={e => setIconConfig(prev => ({ ...prev, enableGridBackground: e.target.checked }))}
                className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
              />
              <label htmlFor="enable-grid" className="text-xs text-slate-400 cursor-pointer select-none">
                Draw structural grids behind icon
              </label>
            </div>
          </div>
        </div>

        {/* Real-time Canvas Rendering output */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-950/60 p-6 rounded-2xl border border-slate-850">
            
            {/* The 512x512 High-Res App Icon drawing canvas */}
            <div className="md:col-span-5 flex flex-col items-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2.5">High-Res App Icon (512x512)</span>
              <div className="w-[180px] p-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-md">
                <canvas
                  ref={iconCanvasRef}
                  width={512}
                  height={512}
                  className="w-full aspect-square rounded-xl"
                />
              </div>
              
              <button
                onClick={() => triggerImageDownload(iconCanvasRef, 'playstore-icon-512.png')}
                className="mt-4 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Save Play Icon (PNG)
              </button>
            </div>

            {/* Giant Phone Home Screen Mockup preview layout */}
            <div className="md:col-span-7 flex flex-col items-center justify-center p-4 bg-slate-900/40 rounded-xl border border-slate-850">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Live Platform Launch Simulation</span>
              
              <div className="relative w-full max-w-[240px] bg-sky-900/10 p-5 rounded-4xl border-[5px] border-slate-850 aspect-[9/16] overflow-hidden">
                {/* Beautiful dynamic vector nodes home decor stars */}
                <div className="absolute top-4 left-4 bg-white/20 w-16 h-16 rounded-full blur-2 dry" />
                <div className="absolute bottom-16 right-4 bg-purple-900/10 w-24 h-24 rounded-full blur-xl" />
                
                {/* Interactive phone app items widgets */}
                <div className="h-full flex flex-col justify-end gap-6 relative z-10">
                  <div className="flex flex-col items-center gap-1">
                    {/* Simulated launch app icon bubble */}
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg p-0.5 border border-white/20" style={{ backgroundColor: iconConfig.backgroundColor }}>
                      <div className="w-full h-full rounded-xl overflow-hidden relative flex items-center justify-center" style={{ scale: '0.8' }}>
                        {/* We use mini icon representation */}
                        <div className="w-[8px] h-[36px] rounded-full" style={{ backgroundColor: iconConfig.snakeColor, transform: 'rotate(45deg)' }} />
                        <div className="absolute bottom-1 w-2 h-2 rounded-full bg-red-400" />
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-300 font-sans tracking-wide">
                      {listingConfig.appName.substring(0, 10)}
                    </span>
                  </div>

                  {/* Hotseat bar row */}
                  <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl flex justify-around w-full border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20" />
                    <div className="w-8 h-8 rounded-full bg-rose-500/20" />
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20" />
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20" />
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-sans mt-3">Mockup: Your compiled launcher icon live on Android 14 home screen.</span>
            </div>
          </div>

          {/* Large horizontal Feature promo Graphic (1024x500) canvas container */}
          <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-850 flex flex-col items-center">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3.5">Google Play Store Promo Graphic (1024x500)</span>
            <div className="w-full max-w-[560px] p-2 bg-slate-900 rounded-xl border border-slate-800">
              <canvas
                ref={graphicCanvasRef}
                width={1024}
                height={500}
                className="w-full aspect-[1024/500] rounded-lg bg-slate-950"
              />
            </div>
            
            <button
              onClick={() => triggerImageDownload(graphicCanvasRef, 'playstore-feature-graphic-1024.jpg')}
              className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Save Feature Promo Banner (JPEG)
            </button>
          </div>
        </div>
      </div>

      {/* 2. LIVE GAMEPLAY SCREENSHOT STUDIO */}
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="text-teal-400 w-5 h-5 animate-bounce" />
            <div>
              <h3 className="font-display font-bold text-slate-100 text-base">Store Screenshots Studio</h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Capture high-quality, framed snapshots with stylized promotional titles to uploading to your Store Listing.
              </p>
            </div>
          </div>
          
          <div className="bg-slate-950/50 px-3.5 py-1.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400">
            SLOTS: <span className="text-teal-400 font-bold">{capturedScreenshots.length}</span> / 4 SELECTION
          </div>
        </div>

        {capturedScreenshots.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center mb-3">
              <ImageIcon className="text-slate-500 w-5 h-5" />
            </div>
            <p className="text-slate-350 text-xs font-sans max-w-xs leading-relaxed">
              No live screenshots captured yet! Go to the <strong className="text-teal-400 font-semibold font-display">🎮 Arcade Station</strong> tab, launch a run, and tick the <strong className="text-emerald-400 font-semibold font-sans">Capture Play Screenshot</strong> button to fetch high-res visuals instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {capturedScreenshots.map((item, idx) => (
              <div key={idx} className="bg-slate-950/70 p-3 rounded-xl border border-slate-850 flex flex-col gap-2 relative group">
                {/* Close handle button */}
                <button
                  onClick={() => onRemoveScreenshot(idx)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 border border-white/10 hover:bg-rose-600 hover:text-white text-slate-400 text-[9px] flex items-center justify-center transition-colors z-20 cursor-pointer"
                  title="Remove Screenshot"
                >
                  ✕
                </button>

                <div className="relative w-full aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-inner">
                  {/* Decorative phone overlay screen */}
                  <img src={item} className="w-full h-full object-cover p-1 rounded-md" alt={`Captured screenshot ${idx + 1}`} />
                  <div className="absolute top-2 left-0 right-0 text-center px-1">
                    <span className="text-[7px] font-display font-medium text-slate-100 bg-black/60 px-1 py-0.5 rounded leading-none block border border-white/5 truncate">
                      {screenshotLabels[idx] || 'SENSATIONAL RETRO SNAKE APP'}
                    </span>
                  </div>
                </div>

                {/* Editable description tags frame */}
                <div>
                  <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Promotional Tagline:</label>
                  <input
                    type="text"
                    value={screenshotLabels[idx] || ''}
                    onChange={e => {
                      const shallow = [...screenshotLabels];
                      shallow[idx] = e.target.value;
                      setScreenshotLabels(shallow);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 mt-1 font-sans rounded px-2.5 py-1 outline-none focus:border-teal-400/50"
                  />
                </div>

                <button
                  onClick={() => downloadScreenshotFrame(item, screenshotLabels[idx] || 'SENSATIONAL ARCADE', idx)}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" /> Export Framed Screen (1080x1920)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. AI PLAY STORE LISTING COPYWRITER */}
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-teal-400 w-5 h-5" />
          <div>
            <h3 className="font-display font-bold text-slate-100 text-base">Gemini AI Play Store Listing Generator</h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Input game metrics, and Gemini will compile high-performing titles, CTR-optimized descriptions, keywords, and release notes!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* Listing inputs */}
          <div className="lg:col-span-5 space-y-4 bg-slate-950/40 p-5 rounded-xl border border-slate-850">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Game Title Reference</label>
              <input
                type="text"
                value={listingConfig.appName}
                onChange={e => setListingConfig(prev => ({ ...prev, appName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Core Hook / Feature Highlight</label>
              <textarea
                rows={2}
                value={listingConfig.keyFeature}
                onChange={e => setListingConfig(prev => ({ ...prev, keyFeature: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 outline-none focus:border-teal-500/50 resize-none"
                placeholder="Describe what makes your game unique..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Target Player Segment</label>
              <input
                type="text"
                value={listingConfig.targetAudience}
                onChange={e => setListingConfig(prev => ({ ...prev, targetAudience: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 outline-none focus:border-teal-500/50"
                placeholder="Target demographic..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Copywriting Voice Style</label>
              <select
                value={listingConfig.tone}
                onChange={e => setListingConfig(prev => ({ ...prev, tone: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 outline-none focus:border-teal-500/50"
              >
                <option value="retro-arcade">Classic Retro-Arcade Vibe (90s era)</option>
                <option value="excited">Explosive & Hyper Casual (CTR Boosted)</option>
                <option value="minimalist">Ultra Clean, Direct & Focused</option>
                <option value="playful">Witty, Cute & Slithery puns</option>
              </select>
            </div>

            <button
              onClick={generateAIStoreListing}
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-500 hover:to-emerald-500 text-slate-950 font-bold font-display rounded-xl tracking-tight transition-all shadow-[0_4px_16px_rgba(60,191,175,0.15)] disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Generating Listing copy...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Generate Store Copy via Gemini API
                </>
              )}
            </button>
          </div>

          {/* Listing copywriting Terminal outputs */}
          <div className="lg:col-span-7 bg-slate-950 p-6 rounded-xl border border-slate-850 relative">
            {apiNote && (
              <div className="bg-teal-950/40 p-3 rounded-lg border border-teal-900/60 text-[10px] text-teal-400 font-mono mb-4 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold">{apiNote}</h5>
                  <p className="mt-0.5 text-slate-400 font-sans leading-relaxed">
                    You can easily populate static values or configure your <strong>process.env.GEMINI_API_KEY</strong> secrets key inside the top-right AI Studio Settings menu whenever you're ready!
                  </p>
                </div>
              </div>
            )}

            {!generatedListing ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center">
                <Sparkles className="w-10 h-10 text-slate-700 mb-3" />
                <h4 className="font-display font-semibold text-slate-400 text-sm">Listing Output Terminal</h4>
                <p className="text-xs text-slate-600 font-sans max-w-xs mt-1 leading-relaxed">
                  Fill in the input details and click generate to invoke Gemini. Standard compiled descriptions will fall back here if keys are offline.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Title */}
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-850 flex justify-between items-center gap-4">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tight">App Name (1 - 30 Char Rule)</span>
                    <h5 className="text-sm font-semibold font-display text-white mt-0.5">{generatedListing.title}</h5>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(generatedListing.title, 'title')}
                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition-colors"
                  >
                    {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Short Description */}
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-850 flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tight">Short Promo Copy (1 - 80 Char Rule)</span>
                    <p className="text-xs text-slate-300 font-sans mt-0.5 leading-relaxed">{generatedListing.shortDescription}</p>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(generatedListing.shortDescription, 'short')}
                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition-colors"
                  >
                    {copiedField === 'short' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* General category/Meta indicators */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-850">
                    <span className="text-[8px] font-mono text-slate-500 uppercase">Suggested Category</span>
                    <span className="block text-xs font-medium text-slate-300 mt-0.5">{generatedListing.category}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-850">
                    <span className="text-[8px] font-mono text-slate-500 uppercase">Ideal Content Rating</span>
                    <span className="block text-xs font-medium text-slate-300 mt-0.5">{generatedListing.suggestedContentRating}</span>
                  </div>
                </div>

                {/* Search tags */}
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-850">
                  <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1.5">Optimization tags & keywords</span>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedListing.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-teal-950/40 text-teal-400 border border-teal-900/40 rounded-md text-[10px] font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Long Description and clipboard triggers */}
                <div className="p-3.5 bg-slate-900/50 rounded-lg border border-slate-850">
                  <div className="flex justify-between items-center mb-1.5 border-b border-slate-850 pb-1.5">
                    <span className="text-[9px] font-mono text-slate-500 uppercase">Full App Store Description (Markdown safe)</span>
                    <button
                      onClick={() => handleCopyToClipboard(generatedListing.longDescription, 'long')}
                      className="text-[10px] font-mono text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'long' ? 'Copied Full!' : 'Copy description text'}
                    </button>
                  </div>
                  <div className="max-h-[160px] overflow-y-auto text-xs text-slate-400 font-sans leading-relaxed whitespace-pre-wrap pr-1">
                    {generatedListing.longDescription}
                  </div>
                </div>

                {/* release info */}
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-850">
                  <span className="text-[9px] font-mono text-slate-500 uppercase">Publish release log (v1.0.0)</span>
                  <p className="text-xs text-slate-350 font-mono mt-0.5">{generatedListing.releaseNotes}</p>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. EXPORT PACKAGER WORKSPACE */}
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <FileCode className="text-teal-400 w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          <div>
            <h3 className="font-display font-bold text-slate-100 text-base">Developer Packager Blueprint</h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Acquire clean local configurations and standalone executable source files of your game modes to wrap quickly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* manifest panel */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-slate-200">manifest.json (Web PWA Manifest)</span>
              <button
                onClick={() => handleCopyToClipboard(customManifestJSON, 'manifest')}
                className="text-[10px] font-mono text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
              >
                {copiedField === 'manifest' ? 'Copied Code!' : 'Copy Code'}
              </button>
            </div>
            <pre className="p-3 bg-slate-900/80 rounded border border-slate-855 text-[10px] text-slate-400 font-mono h-[140px] overflow-y-auto w-full">
              {customManifestJSON}
            </pre>
          </div>

          {/* AndroidManifest panel */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-slate-200">AndroidManifest.xml (Native Blueprint)</span>
              <button
                onClick={() => handleCopyToClipboard(customAndroidManifestXML, 'xml')}
                className="text-[10px] font-mono text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
              >
                {copiedField === 'xml' ? 'Copied XML!' : 'Copy XML'}
              </button>
            </div>
            <pre className="p-3 bg-slate-900/80 rounded border border-slate-855 text-[10px] text-slate-400 font-mono h-[140px] overflow-y-auto w-full">
              {customAndroidManifestXML}
            </pre>
          </div>

        </div>

        <div className="space-y-4 mt-6">
          
          {/* HTML Standalone Run */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-5 bg-[#0D0D0D] rounded border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#4ADE80]/10 rounded text-[#4ADE80]">
                <Laptop className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Export Standalone HTML Game Run</h5>
                <p className="text-[10px] text-white/40 font-sans mt-1">
                  Generates a single self-contained responsive HTML/Canvas version of your Game, ready to load instantly on local testing frameworks.
                </p>
              </div>
            </div>

            <button
              onClick={downloadStandaloneHTML}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-xs font-semibold uppercase tracking-wider rounded cursor-pointer transition-all"
            >
              Download Standalone Game File
            </button>
          </div>

          {/* Portability JSON Export Configuration */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-5 bg-[#0D0D0D] rounded border border-white/15 hover:border-white/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#4ADE80]/15 rounded text-[#4ADE80]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-[#4ADE80] uppercase tracking-[0.15em] font-mono flex items-center gap-2">
                  <span>Export Portability Configuration</span>
                  <span className="text-[8px] bg-[#4ADE80]/10 text-[#4ADE80] px-2 py-0.5 rounded font-mono font-bold animate-pulse">JSON Schema</span>
                </h5>
                <p className="text-[10px] text-white/50 font-sans mt-1 max-w-xl">
                  Encodes current Google Play Store listing credentials, custom high-resolution icon configurations, screenshot catalogs and metadata indicators into an offline portable schema model.
                </p>
              </div>
            </div>

            <button
              onClick={downloadPortabilityJSON}
              className="px-6 py-3 bg-[#4ADE80] hover:opacity-90 text-[#090909] text-xs font-black uppercase tracking-[0.2em] rounded-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" /> Download Portability JSON
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
