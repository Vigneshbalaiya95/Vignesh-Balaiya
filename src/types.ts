export type GameMode = 'classic' | 'speed' | 'obstacles' | 'chameleon';

export type SpeedLevel = 'lazy' | 'slow' | 'normal' | 'fast' | 'bitset';

export type GameTheme = 'neon-grid' | 'retro-lcd' | 'soft-pastel' | 'lava-pit';

export interface HighScore {
  mode: GameMode;
  score: number;
  date: string;
}

export interface AppIconConfig {
  backgroundColor: string; // e.g., '#0a0f1d' (dark cosmic), '#ff2a5f' (neon)
  snakeColor: string; // color of the snake
  styleType: 'classic-pixel' | 's-curve' | 'eight-bit-fruit' | 'snake-bit';
  textOverlay: string; // Short text like "SB", "SNAKE", "BIT"
  textColor: string;
  borderColor: string;
  enableGridBackground: boolean;
}

export interface ListingConfig {
  appName: string;
  gameModes: string[];
  keyFeature: string;
  targetAudience: string;
  tone: 'excited' | 'retro-arcade' | 'minimalist' | 'playful';
}

export interface StoreListing {
  title: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  tags: string[];
  suggestedContentRating: string;
  releaseNotes: string;
}

export interface PlayStoreTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface DevChecklistItem {
  id: string;
  title: string;
  description: string;
  phase: 'prepare' | 'assets' | 'console' | 'testing';
  tasks: PlayStoreTask[];
}
