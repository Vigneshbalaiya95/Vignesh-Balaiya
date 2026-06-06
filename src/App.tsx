import React, { useState } from 'react';
import ArcadeStation from './components/ArcadeStation';
import PlayStoreStudio from './components/PlayStoreStudio';
import SubmissionWizard from './components/SubmissionWizard';
import { GameTheme } from './types';
import { Gamepad2, Sparkles, HelpCircle, Monitor, BookOpen } from 'lucide-react';

export default function App() {
  // Navigation tabs state: 'arcade' | 'studio' | 'wizard'
  const [currentTab, setCurrentTab] = useState<'arcade' | 'studio' | 'wizard'>('arcade');
  
  // High score / Screenshot assets catalog
  const [capturedScreenshots, setCapturedScreenshots] = useState<string[]>([]);
  const [gameTheme, setGameTheme] = useState<GameTheme>('neon-grid');

  // Triggered from core canvas to gallery catalog
  const handleCaptureScreenshot = (imgUrl: string) => {
    // Keep max 4 screenshots
    setCapturedScreenshots(prev => {
      if (prev.length >= 4) {
        return [imgUrl, ...prev.slice(0, 3)];
      }
      return [imgUrl, ...prev];
    });
  };

  const handleRemoveScreenshot = (index: number) => {
    setCapturedScreenshots(prev => prev.filter((_, idx) => idx !== index));
  };

  // Accent theme colors based on gameTheme
  const themeStyles: Record<GameTheme, {
    brandBg: string;
    accentGlow: string;
    accentText: string;
    borderAccent: string;
  }> = {
    'neon-grid': {
      brandBg: 'from-cyan-400 via-teal-400 to-indigo-500',
      accentGlow: 'shadow-[0_0_20px_rgba(60,191,175,0.2)]',
      accentText: 'text-teal-400',
      borderAccent: 'border-teal-500/20',
    },
    'retro-lcd': {
      brandBg: 'from-stone-900 to-stone-855',
      accentGlow: 'shadow-inner',
      accentText: 'text-stone-300',
      borderAccent: 'border-stone-800',
    },
    'soft-pastel': {
      brandBg: 'from-pink-400 via-rose-350 to-amber-300',
      accentGlow: 'shadow-md',
      accentText: 'text-rose-400',
      borderAccent: 'border-rose-100',
    },
    'lava-pit': {
      brandBg: 'from-orange-500 to-amber-600',
      accentGlow: 'shadow-[0_0_25px_rgba(249,115,22,0.35)]',
      accentText: 'text-orange-500',
      borderAccent: 'border-orange-500/20',
    }
  };

  const activeTheme = themeStyles[gameTheme];

  return (
    <div className="min-h-screen bg-[#090909] text-[#E5E5E5] flex flex-col lg:flex-row font-sans overflow-x-hidden antialiased select-none">
      
      {/* Sleek top indicator bar */}
      <div className="h-1 lg:h-auto lg:w-1 bg-[#4ADE80] shrink-0 z-30" />

      {/* DESKTOP SIDEBAR PANEL */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-8 bg-[#0D0D0D] hidden lg:flex shrink-0">
        
        {/* Portal Branding / Logo */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-[#4ADE80] flex items-center justify-center rounded-sm rotate-45 shrink-0 shadow-[0_0_15px_rgba(74,222,128,0.25)]">
            <div className="w-6 h-6 border-2 border-[#090909] rounded-sm bg-[#090909]"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4ADE80]">Snake Bit</span>
            <span className="font-serif italic text-lg leading-tight text-white font-semibold">Studio Portal</span>
          </div>
        </div>

        {/* Sidebar Nav Links as Portal Tabs */}
        <nav className="flex-1 space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 mt-4 px-3 font-mono">Main Console</div>
          
          <button
            onClick={() => setCurrentTab('arcade')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm cursor-pointer transition-all ${
              currentTab === 'arcade'
                ? 'bg-white/5 border-r-2 border-[#4ADE80] text-emerald-400 font-medium'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gamepad2 className={`w-4 h-4 ${currentTab === 'arcade' ? 'text-[#4ADE80]' : 'text-white/35'}`} />
            <span>Game Pipeline</span>
          </button>

          <button
            onClick={() => setCurrentTab('studio')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm cursor-pointer transition-all ${
              currentTab === 'studio'
                ? 'bg-white/5 border-r-2 border-[#4ADE80] text-emerald-400 font-medium'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${currentTab === 'studio' ? 'text-[#4ADE80]' : 'text-white/35'}`} />
            <span>Play Store Assets</span>
          </button>

          <button
            onClick={() => setCurrentTab('wizard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm cursor-pointer transition-all ${
              currentTab === 'wizard'
                ? 'bg-white/5 border-r-2 border-[#4ADE80] text-emerald-400 font-medium'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${currentTab === 'wizard' ? 'text-[#4ADE80]' : 'text-white/35'}`} />
            <span>Launch Checklist</span>
          </button>
          
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 mt-8 px-3 font-mono">System Specs</div>
          <div className="px-3 text-[10px] text-white/40 font-mono space-y-1 bg-white/[0.01] p-2.5 rounded border border-white/5">
            <div className="flex justify-between"><span>NODE:</span><span className="text-[#4ADE80]">US-W2-SB-01</span></div>
            <div className="flex justify-between"><span>PORTAL:</span><span className="text-white/60">ONLINE</span></div>
            <div className="flex justify-between"><span>ENV:</span><span className="text-white/60">AAB-STABLE</span></div>
          </div>
        </nav>

        {/* User Account / Email Box */}
        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center space-x-3 px-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center text-[10px] text-white font-bold font-mono shrink-0">
              VB
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-white truncate">Vignesh Balaiya</span>
              <span className="text-[9px] text-[#4ADE80] font-mono tracking-wider truncate">Senior Architect</span>
            </div>
          </div>
          <div className="mt-3 px-3">
            <span className="text-[9px] font-mono text-white/35 block truncate bg-black/60 p-1.5 rounded text-center border border-white/5">
              vigneshbalaiya08@gmail.com
            </span>
          </div>
        </div>
      </aside>

      {/* MOBILE RESPONSIVE NAV BAR (Visible only on medium/small devices) */}
      <header className="lg:hidden flex flex-col bg-[#0D0D0D] border-b border-white/5 p-4 space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#4ADE80] flex items-center justify-center rounded-sm rotate-45 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
              <div className="w-4 h-4 border-2 border-[#090909] rounded-sm bg-[#090909]"></div>
            </div>
            <span className="font-serif italic text-base leading-tight text-white font-bold">Studio Portal</span>
          </div>
          
          <div className="text-[9px] font-mono bg-white/5 text-[#4ADE80] px-2 py-0.5 border border-white/5 rounded-full font-bold">
            vigneshbalaiya08@gmail.com
          </div>
        </div>
        
        {/* Navigation sliders */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
          {[
            { id: 'arcade', label: 'Play Game Pipeline', icon: Gamepad2 },
            { id: 'studio', label: 'Store Assets Studio', icon: Sparkles },
            { id: 'wizard', label: 'Launch Checklist', icon: BookOpen },
          ].map(tab => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs cursor-pointer transition-all shrink-0 ${
                  active 
                    ? 'bg-white/5 border-b border-[#4ADE80] text-emerald-400 font-semibold' 
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 ${active ? 'text-[#4ADE80]' : 'text-white/40'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* PORTAL RIGHT SIDE / MAIN CONSOLE WORKSPACE */}
      <main className="flex-1 flex flex-col p-4 md:p-8 lg:p-10 bg-[#090909] overflow-y-auto">
        
        {/* CONSOLE STATUS BANNER HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-10 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[10px] tracking-widest uppercase text-[#4ADE80] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse"></span>
              <span>Live Console Connection</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-serif italic text-white tracking-tight leading-none mt-1">Viper Strike: Neo-Tokyo</h1>
            <p className="text-xs md:text-sm text-white/40 max-w-lg mt-1 font-sans leading-relaxed">
              Automating bundle generation, keytool signing, and direct deployment to the Google Play Store Production track.
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono">Target Platform</div>
            <div className="text-lg md:text-xl font-medium text-white">Android 14 (API 34)</div>
            <div className="text-xs text-[#4ADE80] font-mono">Signed Bundle (.aab)</div>
          </div>
        </header>

        {/* OVERVIEW KEY PERFORMANCE INDICATORS */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0D0D0D] p-5 rounded-sm border border-white/5 flex flex-col justify-between h-28 hover:border-white/10 transition-colors">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Optimization Status</span>
            <span className="text-xl md:text-2xl font-light text-white font-serif italic">Aggressive B-7</span>
          </div>
          <div className="bg-[#0D0D0D] p-5 rounded-sm border border-white/5 flex flex-col justify-between h-28 hover:border-[#4ADE80]/30 transition-colors">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Store Readiness</span>
            <span className="text-xl md:text-2xl font-semibold text-[#4ADE80]">94% Compliant</span>
          </div>
          <div className="bg-[#0D0D0D] p-5 rounded-sm border border-white/5 flex flex-col justify-between h-28 hover:border-white/10 transition-colors">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Est. Store Approval</span>
            <span className="text-xl md:text-2xl font-light text-white font-serif italic">48-72 Hours</span>
          </div>
        </section>

        {/* ACTIVE PORTAL TAB DISPLAY WORKBOX */}
        <section className="flex-1 bg-white/[0.015] border border-white/5 rounded-sm p-4 md:p-8 relative overflow-hidden shadow-xl min-h-[500px]">
          {/* Aesthetic grid nodes backgrounds */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4ADE80 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
          
          <div className="relative z-10">
            {currentTab === 'arcade' && (
              <ArcadeStation 
                onCaptureScreenshot={handleCaptureScreenshot} 
                gameTheme={gameTheme} 
                setGameTheme={setGameTheme} 
              />
            )}

            {currentTab === 'studio' && (
              <PlayStoreStudio 
                capturedScreenshots={capturedScreenshots} 
                onRemoveScreenshot={handleRemoveScreenshot} 
              />
            )}

            {currentTab === 'wizard' && (
              <SubmissionWizard />
            )}
          </div>
        </section>

        {/* REFINED SYSTEM PORTAL FOOTER */}
        <footer className="mt-12 flex flex-col sm:flex-row justify-between items-center text-[9px] text-white/20 uppercase tracking-[0.2em] pt-6 border-t border-white/5 gap-3">
          <div>Portal Instance: US-WEST-2-SB-01</div>
          <div>&copy; 2026 Snake Bit Games Inc. / Internal Developer Deployment Portal</div>
          <div className="flex gap-4">
            <span>Encryption: AES-255-GCM</span>
            <span>API v34.1</span>
          </div>
        </footer>

      </main>
    </div>
  );
}
