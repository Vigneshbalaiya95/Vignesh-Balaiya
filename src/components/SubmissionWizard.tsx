import React, { useState } from 'react';
import { DevChecklistItem } from '../types';
import { ShieldCheck, Info, UserCheck, Terminal, Smartphone, Flame, CheckCircle, ClipboardList } from 'lucide-react';

export default function SubmissionWizard() {
  // Developer Onboarding checklist data
  const [checklist, setChecklist] = useState<DevChecklistItem[]>([
    {
      id: 'phase-1',
      title: 'Phase I: Developer Account & Console Setup',
      description: 'Set up your credentials and administrative records before accessing the publish panel.',
      phase: 'prepare',
      tasks: [
        { id: 't1-1', text: 'Register Google Play Developer Account ($25 lifetime subscription fee)', completed: false },
        { id: 't1-2', text: 'Complete Identity Verification with Govt ID (highly strict now for personal accounts)', completed: false },
        { id: 't1-3', text: 'Provide active phone number & email address to receive OTP verifications', completed: false },
        { id: 't1-4', text: 'Create Google Cloud Project linked core developer Console keys', completed: false },
      ],
    },
    {
      id: 'phase-2',
      title: 'Phase II: Assets & Mock Visual Design',
      description: 'Export all visual assets in proper dimensions to complete the listing panel.',
      phase: 'assets',
      tasks: [
        { id: 't2-1', text: 'Generate & download a 512x512 High-Res App Icon (done in Visual Studio)', completed: false },
        { id: 't2-2', text: 'Generate & download a 1024x500 Feature Graphic promo banner (done in Visual Studio)', completed: false },
        { id: 't2-3', text: 'Capture and frame at least 2 gameplay screenshot files (using captured Arcade canvas)', completed: false },
        { id: 't2-4', text: 'Initialize or formulate a Privacy Policy URL (required for casual/arcade category)', completed: false },
      ],
    },
    {
      id: 'phase-3',
      title: 'Phase III: Native Code Packaging & Sign-off',
      description: 'Package the compiled bundle into a signed Android App Bundle (.aab).',
      phase: 'console',
      tasks: [
        { id: 't3-1', text: 'Initialize Capacitor or Bubblewrap framework locally', completed: false },
        { id: 't3-2', text: 'Map start_url to "./index.html" inside manifest.json', completed: false },
        { id: 't3-3', text: 'Generate a secure Upload Keystore file (keytool -genkey -v -keystore snake.keystore)', completed: false },
        { id: 't3-4', text: 'Build signed release artifact: npx bubblewrap build or gradle assembleRelease', completed: false },
      ],
    },
    {
      id: 'phase-4',
      title: 'Phase IV: The 20-Tester Closed Testing Rule',
      description: 'Strict 14-day test program required by Google before Production upload is unlocked.',
      phase: 'testing',
      tasks: [
        { id: 't4-1', text: 'Set up Closed Testing Track in Google Play Console Dashboard', completed: false },
        { id: 't4-2', text: 'Upload compiled signed .aab package to the closed testing track', completed: false },
        { id: 't4-3', text: 'Recruit exactly 20 distinct testers via Google Groups or email lists', completed: false },
        { id: 't4-4', text: 'Keep all 20 testers opted-in and active inside the app for 14 continuous days', completed: false },
      ],
    },
  ]);

  const [activePhase, setActivePhase] = useState<'prepare' | 'assets' | 'console' | 'testing'>('prepare');

  // Multi edits checkmarks trigger
  const handleToggleTask = (phaseId: string, taskId: string) => {
    const nextChecklist = checklist.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          tasks: phase.tasks.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
        };
      }
      return phase;
    });
    setChecklist(nextChecklist);
  };

  // Counting complete indicators
  const getPhaseCompletionStats = (phase: typeof activePhase) => {
    const target = checklist.find(c => c.phase === phase);
    if (!target) return { done: 0, total: 0 };
    const done = target.tasks.filter(t => t.completed).length;
    const total = target.tasks.length;
    return { done, total };
  };

  const getPercentageComplete = () => {
    const totalTasks = checklist.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const doneTasks = checklist.reduce((sum, phase) => sum + phase.tasks.filter(t => t.completed).length, 0);
    return Math.round((doneTasks / totalTasks) * 100);
  };

  const currentChecklist = checklist.find(c => c.phase === activePhase)!;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Interactive Progress Indicators */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-teal-400 w-5 h-5" />
            <h3 className="font-display font-bold text-slate-100 text-base">Play Store Launch Checklist</h3>
          </div>
          <span className="text-xs font-mono bg-teal-950/40 text-teal-300 px-3 py-1 border border-teal-900/40 rounded-full font-bold">
            MASTER PROGRESS: {getPercentageComplete()}%
          </span>
        </div>

        {/* Dynamic track bar */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900">
          <div
            className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full transition-all duration-500 ease-out"
            style={{ width: `${getPercentageComplete()}%` }}
          />
        </div>

        {/* Phase Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5">
          {[
            { id: 'prepare', label: '1. ACCOUNT SETUP', stats: getPhaseCompletionStats('prepare') },
            { id: 'assets', label: '2. ASSETS UPLOAD', stats: getPhaseCompletionStats('assets') },
            { id: 'console', label: '3. PACKAGING BUNDLE', stats: getPhaseCompletionStats('console') },
            { id: 'testing', label: '4. CLOSED 20-TEST', stats: getPhaseCompletionStats('testing') },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setActivePhase(p.id as any)}
              className={`p-3 text-center border rounded-xl flex flex-col justify-center items-center gap-1 cursor-pointer transition-all ${
                activePhase === p.id
                  ? 'border-teal-500/55 bg-slate-800'
                  : 'border-slate-850 bg-slate-950/40 hover:bg-slate-900'
              }`}
            >
              <span className={`text-[10px] font-mono font-semibold truncate ${activePhase === p.id ? 'text-teal-400' : 'text-slate-400'}`}>
                {p.label}
              </span>
              <span className="text-[9px] font-mono text-slate-500">
                ({p.stats.done}/{p.stats.total} Complete)
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CHECKLIST WORKBOX */}
        <div className="lg:col-span-7 bg-slate-950/60 p-6 rounded-2xl border border-slate-850">
          <h4 className="font-display font-semibold text-slate-200 text-sm mb-1">{currentChecklist.title}</h4>
          <p className="text-xs text-slate-400 font-sans leading-relaxed mb-4">{currentChecklist.description}</p>

          <div className="space-y-2.5">
            {currentChecklist.tasks.map(task => (
              <label
                key={task.id}
                className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer select-none transition-all ${
                  task.completed
                    ? 'border-emerald-500/30 bg-emerald-950/10 text-slate-300'
                    : 'border-slate-850 bg-slate-900/10 text-slate-450 hover:bg-slate-900/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(currentChecklist.id, task.id)}
                  className="w-4 h-4 rounded text-teal-500 border-slate-800 bg-slate-900 focus:ring-teal-500"
                />
                <span className={`text-xs font-sans leading-relaxed ${task.completed ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                  {task.text}
                </span>
                
                {task.completed && (
                  <CheckCircle className="ml-auto w-4.5 h-4.5 text-emerald-400 shrink-0" />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* INTERACTIVE COMPILER CODE EXPLAINER */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Phase Guided Explainer Tips */}
          {activePhase === 'prepare' && (
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex gap-2">
                <UserCheck className="text-teal-400 w-5 h-5 shrink-0" />
                <h5 className="font-display font-semibold text-slate-200 text-xs mt-0.5">Google Console Registration Guidelines</h5>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Google requires a one-time registration fee of <strong>$25 USD</strong> to prevent spam on the store. You must provide a valid government-issued ID to confirm your developer profile.
              </p>
              <div className="p-3 bg-slate-950 rounded border border-slate-855 text-[10px] font-mono text-slate-400 leading-relaxed space-y-1">
                <strong>💡 Tip for indie devs:</strong> Ensure your profile details (Developer Name, Email) match your payment profile exactly, otherwise Google will flag verification and pause console imports.
              </div>
            </div>
          )}

          {activePhase === 'assets' && (
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex gap-2">
                <Smartphone className="text-teal-400 w-5 h-5 shrink-0" />
                <h5 className="font-display font-semibold text-slate-200 text-xs mt-0.5">Asset Specifications Reference</h5>
              </div>
              <div className="space-y-3.5 text-[11px] text-slate-400 font-sans leading-relaxed">
                <div>
                  <strong className="text-slate-300 block">📱 App Launcher Icon</strong>
                  32-bit PNG | 512px x 512px | Under 1MB. Must have round adaptive mask styling.
                </div>
                <div>
                  <strong className="text-slate-300 block">🖼️ Feature Graphic Banner</strong>
                  JPEG or 24-bit PNG | 1024px x 500px | High-quality marketing banner shown on search listing highlights.
                </div>
                <div>
                  <strong className="text-slate-300 block">📸 Mobile Phone Screenshots</strong>
                  Minimum 2, max 8 screenshots in 16:9 vertical ratio. E.g. 1080px x 1920px. (Generatable in Studio panel).
                </div>
              </div>
            </div>
          )}

          {activePhase === 'console' && (
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex gap-2">
                <Terminal className="text-teal-400 w-5 h-5 shrink-0" />
                <h5 className="font-display font-semibold text-slate-200 text-xs mt-0.5">Native Compilation Commands</h5>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                PWAs or mobile Web Views can be compiled easily using Google Bubblewrap CLI or open Capacitor wrapper kits:
              </p>
              
              <div className="space-y-1 font-mono text-[9px] bg-slate-950 p-3 rounded border border-slate-855 text-slate-400 h-[100px] overflow-y-auto">
                <div><span className="text-teal-400"># 1. Install Google Bubblewrap PWA packager</span></div>
                <div>$ npm i -g @bubblewrap/cli</div>
                <div className="pt-2"><span className="text-teal-400"># 2. Package your web game files</span></div>
                <div>$ bubblewrap init --manifest=manifest.json</div>
                <div className="pt-2"><span className="text-teal-400"># 3. Compile Signed AAB package</span></div>
                <div>$ bubblewrap build</div>
              </div>
            </div>
          )}

          {activePhase === 'testing' && (
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex gap-2">
                <Flame className="text-amber-500 w-5 h-5 shrink-0 animate-bounce" />
                <h5 className="font-display font-semibold text-slate-200 text-xs mt-0.5">Beating Google's 20-Tester Rule</h5>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Google Play requires individuals registered after Nov 2023 to test their app with <strong>20 active opt-in testers for 14 concurrent days</strong> before releasing to Production. 
              </p>
              
              <div className="p-3 bg-amber-950/20 rounded border border-amber-900/40 text-[10px] font-sans text-amber-300 leading-relaxed space-y-2">
                <p><strong>🔥 Practical Strategies to pass verification:</strong></p>
                <p>• <strong>Google Groups:</strong> Combine emails of 20 friends into a single Google Group. Grant the group testing permissions inside your Console track.</p>
                <p>• <strong>Indie Communities:</strong> Exchange test installs on Reddit (r/AndroidDev, r/PlayStoreTesting) or dedicated Discord development channels.</p>
              </div>
            </div>
          )}

          <div className="p-4 bg-teal-950/20 rounded-xl border border-teal-900/40 text-center text-xs text-teal-400 font-sans">
            🌟 Complete all 4 phases to master your Play Store product release!
          </div>

        </div>

      </div>

    </div>
  );
}
