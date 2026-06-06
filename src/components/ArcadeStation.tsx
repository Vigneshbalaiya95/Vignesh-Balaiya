import React, { useState, useEffect, useRef } from 'react';
import { GameMode, SpeedLevel, GameTheme, HighScore } from '../types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Trophy, Shield, HelpCircle, Gamepad, Zap, Compass, Sparkles, Camera } from 'lucide-react';

interface ArcadeStationProps {
  onCaptureScreenshot: (imgUrl: string) => void;
  gameTheme: GameTheme;
  setGameTheme: (theme: GameTheme) => void;
}

const GRID_SIZE = 20;

export default function ArcadeStation({ onCaptureScreenshot, gameTheme, setGameTheme }: ArcadeStationProps) {
  // Game states
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [speedLevel, setSpeedLevel] = useState<SpeedLevel>('normal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Dynamic gems / Chameleon variables
  const [currentChameleonColor, setCurrentChameleonColor] = useState('#3cbfaf');

  // Ref handles
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Game physics data
  const snakeRef = useRef<{ x: number; y: number }[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const directionRef = useRef<{ x: number; y: number }>({ x: 0, y: -1 });
  const foodRef = useRef<{ x: number; y: number; color?: string; pointsMultiplier?: number }>({ x: 5, y: 5 });
  const obstaclesRef = useRef<{ x: number; y: number }[]>([]);
  const powerupTimerRef = useRef<number | null>(null);
  const totalApplesEatenRef = useRef<number>(0);

  // Theme styling palettes
  const designPalettes: Record<GameTheme, {
    bg: string;
    grid: string;
    snakeHead: string;
    snakeBody: string;
    food: string;
    border: string;
    glow: string;
  }> = {
    'neon-grid': {
      bg: '#0a0f1d',
      grid: '#111827',
      snakeHead: '#4ade80',
      snakeBody: '#15803d',
      food: '#ef4444',
      border: 'border-cyan-500',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    },
    'retro-lcd': {
      bg: '#8b966c',
      grid: '#838e64',
      snakeHead: '#0f172a',
      snakeBody: '#1e293b',
      food: '#334155',
      border: 'border-stone-800',
      glow: 'shadow-inner',
    },
    'soft-pastel': {
      bg: '#fafaf9',
      grid: '#f5f5f4',
      snakeHead: '#f43f5e',
      snakeBody: '#fecdd3',
      food: '#eab308',
      border: 'border-rose-200',
      glow: 'shadow-md',
    },
    'lava-pit': {
      bg: '#1c0a00',
      grid: '#2a0f00',
      snakeHead: '#f97316',
      snakeBody: '#9a3412',
      food: '#a855f7',
      border: 'border-orange-500',
      glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]',
    },
  };

  // Sound generator
  const triggerSound = (type: 'eat' | 'crash' | 'start' | 'levelup' | 'color_match') => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.12); // C6
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'color_match') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.15); // E6
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'start') {
        osc.type = 'square';
        [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
          const oscSeq = ctx.createOscillator();
          const gainSeq = ctx.createGain();
          oscSeq.connect(gainSeq);
          gainSeq.connect(ctx.destination);
          oscSeq.type = 'square';
          oscSeq.frequency.setValueAtTime(freq, now + idx * 0.08);
          gainSeq.gain.setValueAtTime(0.04, now + idx * 0.08);
          gainSeq.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.07);
          oscSeq.start(now + idx * 0.08);
          oscSeq.stop(now + idx * 0.08 + 0.07);
        });
      } else if (type === 'levelup') {
        osc.type = 'sine';
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
          const oscSeq = ctx.createOscillator();
          const gainSeq = ctx.createGain();
          oscSeq.connect(gainSeq);
          gainSeq.connect(ctx.destination);
          oscSeq.type = 'sine';
          oscSeq.frequency.setValueAtTime(freq, now + idx * 0.1);
          gainSeq.gain.setValueAtTime(0.08, now + idx * 0.1);
          gainSeq.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.15);
          oscSeq.start(now + idx * 0.1);
          oscSeq.stop(now + idx * 0.1 + 0.15);
        });
      }
    } catch (e) {
      console.warn("Audio Context block or muted rules.", e);
    }
  };

  // Convert speed string to ms interval
  const getSpeedMs = (): number => {
    switch (speedLevel) {
      case 'lazy': return 160;
      case 'slow': return 120;
      case 'fast': return 60;
      case 'bitset': return 40;
      case 'normal':
      default:
        return 90;
    }
  };

  // Generate lists of score records
  useEffect(() => {
    const list = localStorage.getItem('snake-highscores');
    if (list) {
      try {
        setHighScores(JSON.parse(list));
      } catch (e) {
        console.error(e);
      }
    } else {
      const demoScores: HighScore[] = [
        { mode: 'classic', score: 280, date: '2026-06-03' },
        { mode: 'speed', score: 410, date: '2026-06-04' },
        { mode: 'obstacles', score: 190, date: '2026-05-28' },
        { mode: 'chameleon', score: 340, date: '2026-06-02' },
      ];
      localStorage.setItem('snake-highscores', JSON.stringify(demoScores));
      setHighScores(demoScores);
    }
  }, []);

  const saveHighScore = (newScore: number) => {
    const list = [...highScores];
    const dateStr = new Date().toISOString().split('T')[0];
    const prevMax = list.find(h => h.mode === gameMode)?.score || 0;
    
    if (newScore > prevMax) {
      const cleaned = list.filter(h => h.mode !== gameMode);
      cleaned.push({ mode: gameMode, score: newScore, date: dateStr });
      cleaned.sort((a, b) => b.score - a.score);
      localStorage.setItem('snake-highscores', JSON.stringify(cleaned));
      setHighScores(cleaned);
      triggerSound('levelup');
    }
  };

  // Obstacle configurations based on selected modes
  const applyObstacles = () => {
    if (gameMode !== 'obstacles') {
      obstaclesRef.current = [];
      return;
    }

    const obs: { x: number; y: number }[] = [];
    // Spawn simple symmetry boxes
    for (let i = 4; i < 7; i++) {
      obs.push({ x: i, y: 5 });
      obs.push({ x: 19 - i, y: 14 });
    }
    for (let j = 4; j < 7; j++) {
      obs.push({ x: 5, y: j });
      obs.push({ x: 14, y: 19 - j });
    }
    
    // Core blocking layout
    obs.push({ x: 9, y: 9 });
    obs.push({ x: 10, y: 9 });
    obs.push({ x: 9, y: 10 });
    obs.push({ x: 10, y: 10 });

    obstaclesRef.current = obs;
  };

  // Generate food spawn point
  const spawnFood = () => {
    let attempts = 0;
    let placed = false;
    let rx = 0;
    let ry = 0;

    // Pick Chameleon dynamic food colors
    const chameleonColors = ['#3cbfaf', '#ff2a5f', '#f97316', '#a855f7'];
    const selectedColor = gameMode === 'chameleon' 
      ? chameleonColors[Math.floor(Math.random() * chameleonColors.length)]
      : undefined;

    // Periodically spawn double point stars
    const isSpecial = gameMode === 'speed' && Math.random() < 0.25;

    while (!placed && attempts < 100) {
      rx = Math.floor(Math.random() * GRID_SIZE);
      ry = Math.floor(Math.random() * GRID_SIZE);
      
      const hitsSnake = snakeRef.current.some(part => part.x === rx && part.y === ry);
      const hitsWall = obstaclesRef.current.some(part => part.x === rx && part.y === ry);

      if (!hitsSnake && !hitsWall) {
        placed = true;
      }
      attempts++;
    }

    foodRef.current = {
      x: rx,
      y: ry,
      color: selectedColor,
      pointsMultiplier: isSpecial ? 3 : 1
    };
  };

  // Direction handler
  const handleDirectionChange = (nextDir: { x: number; y: number }) => {
    if (!isPlaying || isPaused) return;
    
    const curr = directionRef.current;
    // Prevent immediate reverse collisions
    if (nextDir.x !== 0 && curr.x === 0) {
      directionRef.current = nextDir;
    }
    if (nextDir.y !== 0 && curr.y === 0) {
      directionRef.current = nextDir;
    }
  };

  // Grid keys capture
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange({ x: 0, y: -1 });
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange({ x: 0, y: 1 });
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange({ x: -1, y: 0 });
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange({ x: 1, y: 0 });
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          setIsPaused(prev => !prev);
        } else {
          startGame();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [isPlaying, isPaused, gameMode]);

  // Restart the state engine
  const startGame = () => {
    applyObstacles();
    snakeRef.current = [
      { x: 10, y: 8 },
      { x: 10, y: 9 },
      { x: 10, y: 10 },
    ];
    directionRef.current = { x: 0, y: -1 };
    totalApplesEatenRef.current = 0;
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    spawnFood();
    
    if (gameMode === 'chameleon') {
      setCurrentChameleonColor('#3cbfaf');
    }

    triggerSound('start');
  };

  // Main game loop ticker
  useEffect(() => {
    if (!isPlaying || isPaused || gameOver) return;

    const interval = setInterval(() => {
      const snake = [...snakeRef.current];
      const head = { ...snake[0] };
      const dir = directionRef.current;

      // Calculate next coordinates
      let nx = head.x + dir.x;
      let ny = head.y + dir.y;

      // Handle wrapping rules or crash depending on mode settings
      const boundaryCrash = gameMode === 'classic' || gameMode === 'obstacles';
      
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
        if (boundaryCrash) {
          endGame();
          return;
        } else {
          // Wrap borders
          nx = (nx + GRID_SIZE) % GRID_SIZE;
          ny = (ny + GRID_SIZE) % GRID_SIZE;
        }
      }

      const nextHead = { x: nx, y: ny };

      // Self collision
      const selfCollide = snake.some((part, idx) => idx > 0 && part.x === nx && part.y === ny);
      if (selfCollide) {
        endGame();
        return;
      }

      // Obstacle collision
      const hitObs = obstaclesRef.current.some(o => o.x === nx && o.y === ny);
      if (hitObs) {
        endGame();
        return;
      }

      // Unshift head coordinates
      snake.unshift(nextHead);

      // Check eating food coordinates
      const eatsFood = nx === foodRef.current.x && ny === foodRef.current.y;
      if (eatsFood) {
        totalApplesEatenRef.current += 1;
        
        let scoreBonus = 10;
        
        if (gameMode === 'chameleon' && foodRef.current.color) {
          if (foodRef.current.color === currentChameleonColor) {
            scoreBonus = 30; // Double bonus for matching color!
            triggerSound('color_match');
          } else {
            // Eaten color becomes the new chameleon theme
            setCurrentChameleonColor(foodRef.current.color);
            scoreBonus = 10;
            triggerSound('eat');
          }
        } else {
          // Multiply standard neon items
          const mul = foodRef.current.pointsMultiplier || 1;
          scoreBonus = 10 * mul;
          triggerSound('eat');
        }

        setScore(prev => prev + scoreBonus);
        spawnFood();
      } else {
        // Normal move slither, pop tail coordinate
        snake.pop();
      }

      snakeRef.current = snake;
      drawCanvas();
    }, getSpeedMs());

    return () => clearInterval(interval);
  }, [isPlaying, isPaused, gameOver, gameMode, speedLevel, currentChameleonColor]);

  // Handle Game Over
  const endGame = () => {
    setIsPlaying(false);
    setGameOver(true);
    triggerSound('crash');
    saveHighScore(score);
  };

  // Render the gameboard using canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pal = designPalettes[gameTheme];
    const width = canvas.width;
    const height = canvas.height;
    const tileSize = width / GRID_SIZE;

    // Draw background
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw neon layout grid if selected
    if (gameTheme === 'neon-grid') {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * tileSize, 0);
        ctx.lineTo(i * tileSize, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * tileSize);
        ctx.lineTo(width, i * tileSize);
        ctx.stroke();
      }
    }

    // Draw obstacles
    ctx.fillStyle = gameTheme === 'retro-lcd' ? '#142a1b' : '#ef4444';
    obstaclesRef.current.forEach(obs => {
      ctx.fillRect(obs.x * tileSize + 1, obs.y * tileSize + 1, tileSize - 2, tileSize - 2);
      // Outer neon shadow block
      if (gameTheme === 'neon-grid') {
        ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowBlur = 4;
      }
    });
    ctx.shadowBlur = 0; // Reset blur

    // Draw Food
    const food = foodRef.current;
    let foodFill = pal.food;
    if (gameMode === 'chameleon' && food.color) {
      foodFill = food.color;
    } else if (gameMode === 'speed' && food.pointsMultiplier && food.pointsMultiplier > 1) {
      foodFill = '#eab308'; // Golden bonus apple
    }

    ctx.fillStyle = foodFill;
    // Draw circular food item for elegant details
    const centerX = food.x * tileSize + tileSize / 2;
    const centerY = food.y * tileSize + tileSize / 2;
    const radius = tileSize / 2 - 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw snake body
    const snake = snakeRef.current;
    snake.forEach((part, index) => {
      const isHead = index === 0;
      
      if (isHead) {
        ctx.fillStyle = gameMode === 'chameleon' ? currentChameleonColor : pal.snakeHead;
      } else {
        ctx.fillStyle = gameMode === 'chameleon' ? currentChameleonColor + 'cc' : pal.snakeBody;
      }

      const x = part.x * tileSize;
      const y = part.y * tileSize;

      // Draw rounded rounded rectangle corners
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      // Simple eye detail for head
      if (isHead) {
        ctx.fillStyle = gameTheme === 'retro-lcd' ? '#8b966c' : '#ffffff';
        const eyeRadius = 2.5;
        const dir = directionRef.current;
        let eyeX1 = x + tileSize / 3;
        let eyeY1 = y + tileSize / 3;
        let eyeX2 = x + (2 * tileSize) / 3;
        let eyeY2 = y + (2 * tileSize) / 3;

        if (dir.x !== 0) {
          // Moving horizontal
          eyeX1 = x + tileSize / 2 + (dir.x * tileSize) / 6;
          eyeX2 = x + tileSize / 2 + (dir.x * tileSize) / 6;
          eyeY1 = y + tileSize / 4;
          eyeY2 = y + (3 * tileSize) / 4;
        } else if (dir.y !== 0) {
          // Moving vertical
          eyeY1 = y + tileSize / 2 + (dir.y * tileSize) / 6;
          eyeY2 = y + tileSize / 2 + (dir.y * tileSize) / 6;
          eyeX1 = x + tileSize / 4;
          eyeX2 = x + (3 * tileSize) / 4;
        }

        ctx.beginPath();
        ctx.arc(eyeX1, eyeY1, eyeRadius, 0, 2 * Math.PI);
        ctx.arc(eyeX2, eyeY2, eyeRadius, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Redraw when theme, game variables adjust
  useEffect(() => {
    drawCanvas();
  }, [gameTheme, gameMode]);

  // Setup canvas drawing elements on initial load
  useEffect(() => {
    drawCanvas();
  }, []);

  // Capture Game Frame for Store Screenshot Studio
  const triggerScreenshotCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Convert current gameplay canvas as a base64 DataURL
    const dataUrl = canvas.toDataURL('image/png');
    onCaptureScreenshot(dataUrl);
    triggerSound('levelup');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT: Complete Responsive Canvas Arcade Cabinet Layout */}
      <div className="lg:col-span-8 flex flex-col items-center">
        
        {/* Top controls dashboard */}
        <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-[#0D0D0D] p-4 rounded border border-white/5 mb-4">
          <div className="flex items-center gap-3">
            <Gamepad className="text-[#4ADE80] w-5 h-5 animate-pulse" />
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-white/40">Selected Mode</span>
              <h3 className="font-display font-medium text-slate-100 capitalize">
                {gameMode === 'chameleon' ? '🌈 Chameleon Match' : `${gameMode} snake`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Score box */}
            <div className="bg-black/40 px-4 py-2 rounded border border-white/5 flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#4ADE80]">SCORE</span>
              <span className="font-mono text-xl font-bold text-[#4ADE80]">
                {score}
              </span>
            </div>

            {/* Mute toggle button */}
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="p-2.5 rounded border border-white/5 hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Audio synth' : 'Mute Audio synth'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-[#4ADE80]" />}
            </button>
          </div>
        </div>

        {/* Core Gameboard screen container */}
        <div className="relative w-full aspect-square max-w-[500px] bg-[#0D0D0D] p-2 rounded border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
          {/* Glass glare effect for retro screen style */}
          <div className="absolute inset-0 rounded bg-gradient-to-tr from-white/0 via-white/2 to-white/5 pointer-events-none z-10" />
          
          <canvas
            ref={canvasRef}
            width={480}
            height={480}
            className="w-full h-full bg-slate-950 rounded"
          />

          {/* GAME OVER Screen Overlay */}
          {gameOver && (
            <div className="absolute inset-0 rounded bg-black/95 flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
              <span className="px-3 py-1 bg-red-950/50 text-red-400 text-xs font-mono border border-red-900/30 rounded mb-3 tracking-widest animate-pulse">SNAKE BIT!</span>
              <h1 className="text-3xl font-serif italic text-white tracking-tight mb-1">
                GAME OVER
              </h1>
              <p className="text-white/40 text-xs mb-6 max-w-xs font-sans">
                You slithered too close to the borders or bit your own tail. Final score was <span className="text-[#4ADE80] font-bold font-mono">{score}</span> points.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 bg-[#4ADE80] hover:opacity-90 text-[#090909] text-xs font-black uppercase tracking-[0.2em] rounded-sm transition-all cursor-pointer"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

          {/* INTRO SCREEN OVERLAY */}
          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 rounded bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 bg-[#4ADE80] flex items-center justify-center rounded-sm rotate-45 mb-6 shadow-[0_0_15px_rgba(74,222,128,0.25)]">
                <div className="rotate-[-45deg]">
                  <Sparkles className="w-5 h-5 text-[#090909]" />
                </div>
              </div>
              <h2 className="text-2xl font-serif italic text-white tracking-tight mb-2">
                Viper Strike Arcade
              </h2>
              <p className="text-white/40 text-xs mb-6 max-w-sm leading-relaxed">
                Choose your game variant below, hook your keyboard arrows, and hit "Start Station" to begin play.
              </p>
              
              <button
                onClick={startGame}
                className="px-6 py-3 bg-[#4ADE80] hover:opacity-90 text-[#090909] text-xs font-black uppercase tracking-[0.2em] rounded-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Initialize Pipeline
              </button>
            </div>
          )}

          {/* PAUSED OVERLAY */}
          {isPlaying && isPaused && (
            <div className="absolute inset-0 rounded bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-20">
              <h3 className="text-xl font-serif italic text-white tracking-tight mb-4">
                Arcade Suspended
              </h3>
              <button
                onClick={() => setIsPaused(false)}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold uppercase tracking-wider rounded border border-white/5 cursor-pointer transition-colors"
              >
                Resume Slither
              </button>
            </div>
          )}
        </div>

        {/* Screen layout buttons: Capture Screenshot and Play Pause control bar */}
        <div className="w-full flex items-center justify-between gap-4 mt-4 px-1">
          {isPlaying ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsPaused(prev => !prev)}
                className="px-4 py-2 bg-[#0D0D0D] hover:bg-white/5 border border-white/5 text-slate-300 rounded text-xs font-mono transition-colors cursor-pointer"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={endGame}
                className="px-4 py-2 bg-rose-955 border border-rose-900/30 text-rose-300 rounded text-xs font-mono transition-colors cursor-pointer"
              >
                End Run
              </button>
            </div>
          ) : (
            <button
              onClick={startGame}
              className="px-4 py-2 bg-[#0D0D0D] hover:bg-white/5 border border-white/5 text-slate-300 rounded text-xs font-mono transition-colors cursor-pointer"
            >
              Start Game
            </button>
          )}

          <button
            onClick={triggerScreenshotCapture}
            className="px-4 py-2 bg-[#4ADE80]/10 hover:bg-[#4ADE80]/20 border border-[#4ADE80]/30 text-[#4ADE80] rounded text-xs font-mono transition-colors cursor-pointer"
            title="Saves this frame and sends it directly to Play Store Screenshot Studio"
          >
            Capture Frame to Studio
          </button>
        </div>

        {/* 🎮 Virtual On-Screen Controller D-Pad for Mobile and Mouse Clickers */}
        <div className="mt-6 p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl w-full max-w-[340px] flex flex-col items-center">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Gamepad className="w-3 h-3 text-slate-400" /> ON-SCREEN ARCADE GAMEPAD
          </span>
          <div className="grid grid-cols-3 gap-2 w-full max-w-[180px]">
            {/* Row 1 */}
            <div />
            <button
              id="btn-up"
              onClick={() => handleDirectionChange({ x: 0, y: -1 })}
              className="aspect-square bg-slate-800 hover:bg-slate-750 active:bg-teal-500 active:text-slate-950 text-slate-300 rounded-xl border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer shadow-md select-none p-3"
            >
              ▲
            </button>
            <div />

            {/* Row 2 */}
            <button
              id="btn-left"
              onClick={() => handleDirectionChange({ x: -1, y: 0 })}
              className="aspect-square bg-slate-800 hover:bg-slate-750 active:bg-teal-500 active:text-slate-950 text-slate-300 rounded-xl border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer shadow-md select-none p-3"
            >
              ◀
            </button>
            <div className="aspect-square bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center text-[10px] font-mono text-slate-600 select-none">
              SBIT
            </div>
            <button
              id="btn-right"
              onClick={() => handleDirectionChange({ x: 1, y: 0 })}
              className="aspect-square bg-slate-800 hover:bg-slate-750 active:bg-teal-500 active:text-slate-950 text-slate-300 rounded-xl border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer shadow-md select-none p-3"
            >
              ▶
            </button>

            {/* Row 3 */}
            <div />
            <button
              id="btn-down"
              onClick={() => handleDirectionChange({ x: 0, y: 1 })}
              className="aspect-square bg-slate-800 hover:bg-slate-750 active:bg-teal-500 active:text-slate-950 text-slate-300 rounded-xl border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer shadow-md select-none p-3"
            >
              ▼
            </button>
            <div />
          </div>
        </div>

      </div>

      {/* RIGHT: Arcade Mode custom configuration suite & High Scores list */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Game Mode Picker */}
        <div className="bg-[#0D0D0D] p-5 rounded border border-white/5 shadow-md">
          <h4 className="font-serif italic text-white text-base mb-4 flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#4ADE80]" /> SELECT GAME MODULE
          </h4>
          
          <div className="flex flex-col gap-2.5">
            {[
              { id: 'classic', label: 'Classic Grid', desc: 'Standard rules. Hitting borders or tail ends game.', icon: Trophy },
              { id: 'speed', label: 'Time & Speed Multiplier', desc: 'Borders wrap automatically. Eats yellow gems for multipliers.', icon: Zap },
              { id: 'obstacles', label: 'Obstacle Maze', desc: 'Blocks generated across the layout. Tricky slithering.', icon: Shield },
              { id: 'chameleon', label: 'Chameleon Palette Matching', desc: 'Eat matching colored items for huge combo chain bonuses.', icon: Sparkles },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setGameMode(item.id as GameMode);
                  if (isPlaying) endGame();
                }}
                className={`w-full text-left p-3 rounded transition-all cursor-pointer flex gap-3 ${
                  gameMode === item.id 
                    ? 'border-l-2 border-[#4ADE80] bg-white/[0.03]' 
                    : 'border border-white/5 bg-transparent'
                }`}
              >
                <div className={`p-2 rounded self-start ${item.id === gameMode ? 'bg-[#4ADE80]/10 text-[#4ADE80]' : 'bg-[#090909] text-white/40'}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-sans font-semibold text-xs text-slate-200 flex items-center gap-1.5 leading-none">
                    {item.label}
                    {gameMode === item.id && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />}
                  </div>
                  <p className="text-[10px] text-white/50 font-sans mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Speed Adjustment panel */}
        <div className="bg-[#0D0D0D] p-5 rounded border border-white/5 shadow-md">
          <h4 className="font-serif italic text-white text-base mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#4ADE80]" /> SPEED TUNING
          </h4>
          <div className="grid grid-cols-5 gap-1.5">
            {(['lazy', 'slow', 'normal', 'fast', 'bitset'] as SpeedLevel[]).map(level => {
              const active = speedLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => {
                    setSpeedLevel(level);
                    if (isPlaying) endGame();
                  }}
                  className={`py-2 text-[10px] font-mono text-center rounded uppercase hover:bg-white/5 shrink-0 transition-all cursor-pointer ${
                    active 
                      ? 'border border-[#4ADE80]/40 bg-[#4ADE80]/15 text-[#4ADE80] font-bold' 
                      : 'border border-white/5 bg-transparent text-slate-400'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme Settings Panel */}
        <div className="bg-[#0D0D0D] p-5 rounded border border-white/5 shadow-md">
          <h4 className="font-serif italic text-white text-base mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4ADE80]" /> GRAPHICAL SKIN
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'neon-grid', label: 'Noir Grid', desc: 'Cyberpunk emerald' },
              { id: 'retro-lcd', label: 'Dot LCD (Nokia)', desc: 'Olive-tint display' },
              { id: 'soft-pastel', label: 'Paper Velvet', desc: 'Sleek dark card outline' },
              { id: 'lava-pit', label: 'Molten Pit', desc: 'Obsidian lava' },
            ].map(themeItem => (
              <button
                key={themeItem.id}
                onClick={() => setGameTheme(themeItem.id as GameTheme)}
                className={`p-2.5 rounded text-left border hover:bg-white/5 transition-all text-xs cursor-pointer ${
                  gameTheme === themeItem.id 
                    ? 'border-[#4ADE80]/30 bg-white/[0.03]' 
                    : 'border-white/5 bg-transparent'
                }`}
              >
                <div className="font-sans font-semibold text-slate-200">{themeItem.label}</div>
                <div className="text-[10px] text-white/40 mt-1 leading-relaxed">{themeItem.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* High Scores Listing */}
        <div className="bg-[#0D0D0D] p-5 rounded border border-white/5 shadow-md">
          <h4 className="font-serif italic text-white text-base mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#4ADE80]" /> ACTIVE RECORDS
          </h4>
          <div className="flex flex-col gap-2">
            {highScores.map((h, i) => (
              <div key={h.mode} className="flex justify-between items-center p-2.5 bg-[#090909] rounded border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/30 w-4 font-bold">#{i+1}</span>
                  <span className="text-xs font-mono font-medium text-slate-200 capitalize">{h.mode}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-[#4ADE80] font-semibold">{h.score} pts</span>
                  <span className="text-[9px] font-mono text-white/30">{h.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
