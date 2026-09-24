import { PetType, EvolutionStage } from '@/store/petStore';

type ActionType = 'feed' | 'play' | 'train' | 'sleep' | 'heal' | null;

interface Pet3DProps {
  type: PetType;
  mood: string;
  level: number;
  stage: EvolutionStage;
  action?: ActionType;
}

export function Pet3D({ type, mood, level, stage, action }: Pet3DProps) {
  const getMoodColor = () => {
    switch (mood) {
      case '✨ Счастлив': return '#4ade80';
      case '😊 Доволен': return '#60a5fa';
      case '😐 Нормально': return '#fbbf24';
      case '😢 Грустит': return '#a78bfa';
      case '😰 Плохо': return '#f87171';
      default: return '#60a5fa';
    }
  };

  const glowColor = getMoodColor();

  // Determine animation class based on action
  const getActionAnimation = () => {
    if (!action) return 'animate-float-pet';
    
    switch (action) {
      case 'feed': return 'animate-action-feed';
      case 'play': return 'animate-action-play';
      case 'train': return 'animate-action-train';
      case 'sleep': return 'animate-action-sleep';
      case 'heal': return 'animate-action-heal';
      default: return 'animate-float-pet';
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl transition-all duration-500"
        style={{ 
          backgroundColor: action === 'heal' ? '#10b981' : glowColor, 
          opacity: action === 'heal' ? 0.4 : 0.15 + Math.min(level / 20, 0.2) 
        }}
      />

      <div className={`relative ${getActionAnimation()}`}>
        {type === 'cat' && <CatModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'dog' && <DogModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'bird' && <BirdModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'fox' && <FoxModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'dragon' && <DragonModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'bunny' && <BunnyModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'panda' && <PandaModel moodColor={glowColor} action={action} stage={stage} />}
        {type === 'owl' && <OwlModel moodColor={glowColor} action={action} stage={stage} />}
      </div>

      {/* Shadow */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-36 h-5 bg-black/30 rounded-full blur-lg animate-shadow" />

      {/* Level stars */}
      {level > 1 && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: Math.min(level, 5) }).map((_, i) => (
            <span key={i} className="text-yellow-400 text-xs animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>⭐</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ КОТИК ============ */
function CatModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isEating = action === 'feed';
  const eyeState = isSleeping ? 'closed' : isEating ? 'happy' : 'normal';

  // Evolution stage scaling and features
  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';

  return (
    <svg 
      width={240 * scale} 
      height={260 * scale} 
      viewBox="0 0 240 260" 
      className={`${stage === 'baby' ? 'animate-bounce-gentle' : 'animate-breathe'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="catBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
        <radialGradient id="catHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id="catEye" cx="40%" cy="40%" r="50%">
          <stop offset="0%" stopColor={moodColor} />
          <stop offset="100%" stopColor="#166534" />
        </radialGradient>
        <filter id="catShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Tail */}
      <path d="M 175 155 Q 210 130 205 95 Q 200 75 210 65" stroke="url(#catBody)" strokeWidth="12" fill="none" strokeLinecap="round" className="animate-wag" />
      <path d="M 205 70 Q 210 60 215 65" stroke="#fdba74" strokeWidth="8" fill="none" strokeLinecap="round" className="animate-wag" />

      {/* Body */}
      <ellipse cx="120" cy="165" rx="62" ry="55" fill="url(#catBody)" filter="url(#catShadow)" />
      {/* Belly */}
      <ellipse cx="120" cy="175" rx="38" ry="32" fill="#fef3c7" opacity="0.8" />
      {/* Fur texture */}
      <path d="M 85 145 Q 90 140 95 145" stroke="#c2410c" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 140 145 Q 145 140 150 145" stroke="#c2410c" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 110 155 Q 115 150 120 155" stroke="#c2410c" strokeWidth="1" fill="none" opacity="0.4" />

      {/* Back legs */}
      <ellipse cx="85" cy="210" rx="18" ry="12" fill="#ea580c" />
      <ellipse cx="155" cy="210" rx="18" ry="12" fill="#ea580c" />
      {/* Front paws */}
      <ellipse cx="95" cy="215" rx="14" ry="10" fill="#fdba74" />
      <ellipse cx="145" cy="215" rx="14" ry="10" fill="#fdba74" />
      {/* Paw pads */}
      <circle cx="92" cy="218" r="2" fill="#fda4af" />
      <circle cx="98" cy="218" r="2" fill="#fda4af" />
      <circle cx="142" cy="218" r="2" fill="#fda4af" />
      <circle cx="148" cy="218" r="2" fill="#fda4af" />

      {/* Head */}
      <circle cx="120" cy="90" r="48" fill="url(#catHead)" filter="url(#catShadow)" />
      {/* Cheeks */}
      <ellipse cx="88" cy="100" rx="12" ry="8" fill="#fda4af" opacity="0.3" />
      <ellipse cx="152" cy="100" rx="12" ry="8" fill="#fda4af" opacity="0.3" />

      {/* Ears */}
      <path d="M 80 60 L 65 20 L 100 50 Z" fill="url(#catHead)" />
      <path d="M 160 60 L 175 20 L 140 50 Z" fill="url(#catHead)" />
      <path d="M 83 58 L 72 30 L 96 50 Z" fill="#fda4af" />
      <path d="M 157 58 L 168 30 L 144 50 Z" fill="#fda4af" />

      {/* Eyes */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 92 87 Q 102 83 112 87" stroke="#78350f" strokeWidth="2" fill="none" />
          <path d="M 128 87 Q 138 83 148 87" stroke="#78350f" strokeWidth="2" fill="none" />
        </>
      ) : eyeState === 'happy' ? (
        <>
          {/* Happy eyes - eating */}
          <path d="M 92 87 Q 102 80 112 87" stroke="#78350f" strokeWidth="2.5" fill="none" />
          <path d="M 128 87 Q 138 80 148 87" stroke="#78350f" strokeWidth="2.5" fill="none" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <ellipse cx="102" cy="85" rx="11" ry="12" fill="white" />
          <ellipse cx="138" cy="85" rx="11" ry="12" fill="white" />
          <ellipse cx="103" cy="87" rx="7" ry="9" fill="url(#catEye)" className="animate-blink" />
          <ellipse cx="139" cy="87" rx="7" ry="9" fill="url(#catEye)" className="animate-blink" />
          {/* Cat pupils (vertical) */}
          <ellipse cx="103" cy="87" rx="2.5" ry="8" fill="#052e16" className="animate-blink" />
          <ellipse cx="139" cy="87" rx="2.5" ry="8" fill="#052e16" className="animate-blink" />
          {/* Eye shine */}
          <circle cx="100" cy="83" r="2.5" fill="white" opacity="0.9" />
          <circle cx="136" cy="83" r="2.5" fill="white" opacity="0.9" />
          <circle cx="106" cy="90" r="1.2" fill="white" opacity="0.6" />
          <circle cx="142" cy="90" r="1.2" fill="white" opacity="0.6" />
        </>
      )}

      {/* Nose */}
      <path d="M 115 98 L 120 102 L 125 98 Z" fill="#ec4899" />
      {/* Mouth */}
      {isEating ? (
        <path d="M 110 108 Q 120 118 130 108" stroke="#78350f" strokeWidth="2" fill="#78350f" opacity="0.3" />
      ) : (
        <>
          <path d="M 120 102 L 120 107" stroke="#78350f" strokeWidth="1.5" fill="none" />
          <path d="M 112 108 Q 120 114 128 108" stroke="#78350f" strokeWidth="1.5" fill="none" />
        </>
      )}

      {/* Whiskers */}
      {showTeenFeatures && (
        <>
          <line x1="65" y1="95" x2="95" y2="98" stroke="#78350f" strokeWidth="1" opacity="0.6" />
          <line x1="65" y1="102" x2="95" y2="102" stroke="#78350f" strokeWidth="1" opacity="0.6" />
          <line x1="65" y1="109" x2="95" y2="106" stroke="#78350f" strokeWidth="1" opacity="0.6" />
          <line x1="145" y1="98" x2="175" y2="95" stroke="#78350f" strokeWidth="1" opacity="0.6" />
          <line x1="145" y1="102" x2="175" y2="102" stroke="#78350f" strokeWidth="1" opacity="0.6" />
          <line x1="145" y1="106" x2="175" y2="109" stroke="#78350f" strokeWidth="1" opacity="0.6" />
        </>
      )}

      {/* Adult features - crown */}
      {showAdultFeatures && (
        <g className="animate-wiggle">
          <polygon points="100,35 105,25 110,35 115,20 120,35 125,20 130,35 135,25 140,35" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="105" cy="25" r="2" fill="#ef4444" />
          <circle cx="120" cy="20" r="2" fill="#3b82f6" />
          <circle cx="135" cy="25" r="2" fill="#10b981" />
        </g>
      )}
    </svg>
  );
}

/* ============ СОБАЧКА ============ */
function DogModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isPlaying = action === 'play';
  const eyeState = isSleeping ? 'closed' : isPlaying ? 'happy' : 'normal';

  // Evolution stage scaling and features
  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';
  return (
    <svg 
      width={240 * scale} 
      height={260 * scale} 
      viewBox="0 0 240 260" 
      className={`${stage === 'baby' ? 'animate-wiggle' : 'animate-sway'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="dogBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id="dogHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        <filter id="dogShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Tail */}
      <path d="M 180 140 Q 210 115 205 85 Q 200 65 215 55" stroke="url(#dogBody)" strokeWidth="14" fill="none" strokeLinecap="round" className="animate-wag-fast" />

      {/* Body */}
      <ellipse cx="120" cy="165" rx="65" ry="58" fill="url(#dogBody)" filter="url(#dogShadow)" />
      {/* Belly */}
      <ellipse cx="120" cy="178" rx="40" ry="32" fill="#d4a574" opacity="0.7" />

      {/* Back legs */}
      <ellipse cx="82" cy="212" rx="20" ry="14" fill="#78350f" />
      <ellipse cx="158" cy="212" rx="20" ry="14" fill="#78350f" />
      {/* Front paws */}
      <ellipse cx="95" cy="218" rx="16" ry="11" fill="#92400e" />
      <ellipse cx="145" cy="218" rx="16" ry="11" fill="#92400e" />

      {/* Head */}
      <circle cx="120" cy="85" r="50" fill="url(#dogHead)" filter="url(#dogShadow)" />

      {/* Floppy ears */}
      <ellipse cx="65" cy="95" rx="22" ry="38" fill="#78350f" transform="rotate(-15, 65, 95)" />
      <ellipse cx="175" cy="95" rx="22" ry="38" fill="#78350f" transform="rotate(15, 175, 95)" />
      <ellipse cx="67" cy="95" rx="14" ry="28" fill="#92400e" transform="rotate(-15, 67, 95)" opacity="0.5" />
      <ellipse cx="173" cy="95" rx="14" ry="28" fill="#92400e" transform="rotate(15, 173, 95)" opacity="0.5" />

      {/* Snout */}
      <ellipse cx="120" cy="100" rx="28" ry="20" fill="#d4a574" />
      <ellipse cx="120" cy="105" rx="20" ry="12" fill="#e8c9a0" opacity="0.6" />

      {/* Eyes */}
      <defs>
        <radialGradient id="dogEyeGrad" cx="40%" cy="40%" r="50%">
          <stop offset="0%" stopColor={moodColor} />
          <stop offset="100%" stopColor="#422006" />
        </radialGradient>
      </defs>
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 88 78 Q 98 74 108 78" stroke="#451a03" strokeWidth="2" fill="none" />
          <path d="M 132 78 Q 142 74 152 78" stroke="#451a03" strokeWidth="2" fill="none" />
        </>
      ) : eyeState === 'happy' ? (
        <>
          {/* Happy eyes - playing */}
          <path d="M 88 78 Q 98 71 108 78" stroke="#451a03" strokeWidth="2.5" fill="none" />
          <path d="M 132 78 Q 142 71 152 78" stroke="#451a03" strokeWidth="2.5" fill="none" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <circle cx="98" cy="78" r="11" fill="white" />
          <circle cx="142" cy="78" r="11" fill="white" />
          <circle cx="99" cy="80" r="7" fill="url(#dogEyeGrad)" className="animate-blink" />
          <circle cx="143" cy="80" r="7" fill="url(#dogEyeGrad)" className="animate-blink" />
          <circle cx="96" cy="76" r="2.5" fill="white" opacity="0.9" />
          <circle cx="140" cy="76" r="2.5" fill="white" opacity="0.9" />
        </>
      )}

      {/* Eyebrows */}
      <path d="M 85 65 Q 95 60 105 65" stroke="#451a03" strokeWidth="2" fill="none" />
      <path d="M 135 65 Q 145 60 155 65" stroke="#451a03" strokeWidth="2" fill="none" />

      {/* Nose */}
      <ellipse cx="120" cy="95" rx="9" ry="7" fill="#1c1917" />
      <ellipse cx="118" cy="93" rx="3" ry="2" fill="#57534e" opacity="0.5" />

      {/* Mouth */}
      <path d="M 110 105 Q 120 115 130 105" stroke="#451a03" strokeWidth="2" fill="none" />
      {/* Tongue */}
      <ellipse cx="120" cy="115" rx="7" ry="10" fill="#f87171" className="animate-tongue" />
      <ellipse cx="120" cy="113" rx="5" ry="6" fill="#fca5a5" opacity="0.5" />

      {/* Collar */}
      {showTeenFeatures && (
        <>
          <path d="M 80 130 Q 120 140 160 130" stroke="#dc2626" strokeWidth="6" fill="none" />
          <circle cx="120" cy="137" r="5" fill="#fbbf24" />
        </>
      )}

      {/* Adult features - superhero cape */}
      {showAdultFeatures && (
        <g className="animate-sway">
          <path d="M 70 140 Q 60 180 50 220 L 80 200 Q 85 170 90 140 Z" fill="#7c3aed" opacity="0.8" />
          <path d="M 170 140 Q 180 180 190 220 L 160 200 Q 155 170 150 140 Z" fill="#7c3aed" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}

/* ============ ПТИЧКА ============ */
function BirdModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isTraining = action === 'train';
  const eyeState = isSleeping ? 'closed' : isTraining ? 'focused' : 'normal';

  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';

  return (
    <svg 
      width={220 * scale} 
      height={260 * scale} 
      viewBox="0 0 220 260" 
      className={`${stage === 'baby' ? 'animate-bounce-gentle' : 'animate-float-bird'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="birdBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <radialGradient id="birdHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
        <linearGradient id="birdWing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <filter id="birdShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Tail feathers */}
      <path d="M 95 185 L 85 220 L 110 200 Z" fill="#1e40af" />
      <path d="M 110 185 L 110 225 L 125 200 Z" fill="#1d4ed8" />
      <path d="M 125 185 L 135 220 L 115 200 Z" fill="#1e40af" />

      {/* Body */}
      <ellipse cx="110" cy="150" rx="48" ry="55" fill="url(#birdBody)" filter="url(#birdShadow)" />
      {/* Belly */}
      <ellipse cx="110" cy="165" rx="30" ry="35" fill="#dbeafe" opacity="0.7" />
      {/* Feather details */}
      <path d="M 90 140 Q 95 135 100 140" stroke="#1e40af" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 115 140 Q 120 135 125 140" stroke="#1e40af" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 100 155 Q 105 150 110 155" stroke="#1e40af" strokeWidth="1" fill="none" opacity="0.5" />

      {/* Wings */}
      <ellipse cx="55" cy="140" rx="28" ry="42" fill="url(#birdWing)" className="animate-wing-left" />
      <ellipse cx="165" cy="140" rx="28" ry="42" fill="url(#birdWing)" className="animate-wing-right" />
      {/* Wing details */}
      <path d="M 45 130 Q 55 125 65 130" stroke="#1e3a8a" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 45 145 Q 55 140 65 145" stroke="#1e3a8a" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 155 130 Q 165 125 175 130" stroke="#1e3a8a" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 155 145 Q 165 140 175 145" stroke="#1e3a8a" strokeWidth="1" fill="none" opacity="0.4" />

      {/* Head */}
      <circle cx="110" cy="80" r="38" fill="url(#birdHead)" filter="url(#birdShadow)" />
      {/* Crest */}
      <ellipse cx="110" cy="45" rx="6" ry="14" fill="#1d4ed8" />
      <ellipse cx="100" cy="50" rx="5" ry="11" fill="#2563eb" />
      <ellipse cx="120" cy="50" rx="5" ry="11" fill="#2563eb" />

      {/* Eyes */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 87 77 Q 95 73 103 77" stroke="#1e3a8a" strokeWidth="2" fill="none" />
          <path d="M 117 77 Q 125 73 133 77" stroke="#1e3a8a" strokeWidth="2" fill="none" />
        </>
      ) : eyeState === 'focused' ? (
        <>
          {/* Focused eyes - training */}
          <circle cx="95" cy="75" r="10" fill="white" />
          <circle cx="125" cy="75" r="10" fill="white" />
          <circle cx="96" cy="77" r="7" fill={moodColor} />
          <circle cx="126" cy="77" r="7" fill={moodColor} />
          <circle cx="96" cy="77" r="4" fill="#1c1917" />
          <circle cx="126" cy="77" r="4" fill="#1c1917" />
          <circle cx="93" cy="73" r="2.5" fill="white" opacity="0.9" />
          <circle cx="123" cy="73" r="2.5" fill="white" opacity="0.9" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <circle cx="95" cy="75" r="10" fill="white" />
          <circle cx="125" cy="75" r="10" fill="white" />
          <circle cx="96" cy="77" r="6" fill={moodColor} className="animate-blink" />
          <circle cx="126" cy="77" r="6" fill={moodColor} className="animate-blink" />
          <circle cx="93" cy="73" r="2.5" fill="white" opacity="0.9" />
          <circle cx="123" cy="73" r="2.5" fill="white" opacity="0.9" />
        </>
      )}

      {/* Beak */}
      <path d="M 100 88 L 110 105 L 120 88 Z" fill="#f59e0b" />
      <path d="M 103 90 L 110 100 L 117 90 Z" fill="#fbbf24" />
      <line x1="100" y1="92" x2="120" y2="92" stroke="#b45309" strokeWidth="1" />

      {/* Cheeks */}
      <circle cx="85" cy="88" r="5" fill="#fda4af" opacity="0.4" />
      <circle cx="135" cy="88" r="5" fill="#fda4af" opacity="0.4" />

      {/* Feet */}
      <g>
        <line x1="95" y1="200" x2="90" y2="225" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <line x1="85" y1="225" x2="95" y2="225" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="90" y1="225" x2="100" y2="225" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g>
        <line x1="125" y1="200" x2="130" y2="225" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <line x1="125" y1="225" x2="135" y2="225" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="130" y1="225" x2="140" y2="225" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
/* ============ ЛИСИЧКА ============ */
function FoxModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isEating = action === 'feed';
  const eyeState = isSleeping ? 'closed' : isEating ? 'happy' : 'normal';

  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';

  return (
    <svg 
      width={240 * scale} 
      height={260 * scale} 
      viewBox="0 0 240 260" 
      className={`${stage === 'baby' ? 'animate-wiggle' : 'animate-sway'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="foxBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
        <radialGradient id="foxHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
        <filter id="foxShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Big fluffy tail */}
      <ellipse cx="195" cy="145" rx="35" ry="28" fill="url(#foxBody)" className="animate-wag" />
      <ellipse cx="210" cy="135" rx="18" ry="14" fill="#fef3c7" className="animate-wag" />
      <path d="M 175 145 Q 185 135 195 145" stroke="#9a3412" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 185 155 Q 195 145 205 155" stroke="#9a3412" strokeWidth="1" fill="none" opacity="0.4" />

      {/* Body */}
      <ellipse cx="120" cy="165" rx="60" ry="52" fill="url(#foxBody)" filter="url(#foxShadow)" />
      {/* White belly */}
      <ellipse cx="120" cy="175" rx="35" ry="30" fill="#fef3c7" opacity="0.85" />

      {/* Back legs */}
      <ellipse cx="85" cy="210" rx="18" ry="12" fill="#c2410c" />
      <ellipse cx="155" cy="210" rx="18" ry="12" fill="#c2410c" />
      {/* Front paws */}
      <ellipse cx="95" cy="215" rx="14" ry="10" fill="#1c1917" />
      <ellipse cx="145" cy="215" rx="14" ry="10" fill="#1c1917" />

      {/* Head */}
      <circle cx="120" cy="88" r="46" fill="url(#foxHead)" filter="url(#foxShadow)" />
      {/* White face mask */}
      <path d="M 95 95 Q 120 120 145 95 Q 135 110 120 112 Q 105 110 95 95 Z" fill="#fef3c7" />

      {/* Ears */}
      <path d="M 82 58 L 65 15 L 95 48 Z" fill="url(#foxHead)" />
      <path d="M 158 58 L 175 15 L 145 48 Z" fill="url(#foxHead)" />
      <path d="M 85 55 L 72 25 L 92 48 Z" fill="#1c1917" />
      <path d="M 155 55 L 168 25 L 148 48 Z" fill="#1c1917" />

      {/* Eyes - sly look */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 91 84 Q 100 80 109 84" stroke="#7c2d12" strokeWidth="2" fill="none" />
          <path d="M 131 84 Q 140 80 149 84" stroke="#7c2d12" strokeWidth="2" fill="none" />
        </>
      ) : eyeState === 'happy' ? (
        <>
          {/* Happy eyes - eating */}
          <path d="M 91 84 Q 100 78 109 84" stroke="#7c2d12" strokeWidth="2.5" fill="none" />
          <path d="M 131 84 Q 140 78 149 84" stroke="#7c2d12" strokeWidth="2.5" fill="none" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <ellipse cx="100" cy="82" rx="9" ry="10" fill="white" />
          <ellipse cx="140" cy="82" rx="9" ry="10" fill="white" />
          <ellipse cx="102" cy="84" rx="6" ry="7" fill={moodColor} className="animate-blink" />
          <ellipse cx="142" cy="84" rx="6" ry="7" fill={moodColor} className="animate-blink" />
          <ellipse cx="103" cy="84" rx="3" ry="5" fill="#1c1917" className="animate-blink" />
          <ellipse cx="143" cy="84" rx="3" ry="5" fill="#1c1917" className="animate-blink" />
          <circle cx="100" cy="80" r="2" fill="white" opacity="0.9" />
          <circle cx="140" cy="80" r="2" fill="white" opacity="0.9" />
        </>
      )}

      {/* Sly eyebrows */}
      <path d="M 88 70 Q 98 66 108 72" stroke="#7c2d12" strokeWidth="2" fill="none" />
      <path d="M 132 72 Q 142 66 152 70" stroke="#7c2d12" strokeWidth="2" fill="none" />

      {/* Nose */}
      <ellipse cx="120" cy="98" rx="6" ry="5" fill="#1c1917" />
      <ellipse cx="118" cy="96" rx="2" ry="1.5" fill="#57534e" opacity="0.5" />

      {/* Mouth - sly smile */}
      <path d="M 112 105 Q 120 110 128 105" stroke="#7c2d12" strokeWidth="1.5" fill="none" />

      {/* Cheek fluff */}
      <path d="M 75 90 Q 80 95 78 100" stroke="#ea580c" strokeWidth="2" fill="none" />
      <path d="M 165 90 Q 160 95 162 100" stroke="#ea580c" strokeWidth="2" fill="none" />
    </svg>
  );
}
/* ============ ДРАКОНЧИК ============ */
function DragonModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isTraining = action === 'train';
  const eyeState = isSleeping ? 'closed' : isTraining ? 'focused' : 'normal';

  // Evolution stage scaling and features
  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';
  return (
    <svg 
      width={260 * scale} 
      height={280 * scale} 
      viewBox="0 0 260 280" 
      className={`${stage === 'baby' ? 'animate-bounce-gentle' : 'animate-breathe'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="dragonBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
        <radialGradient id="dragonHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <linearGradient id="dragonWing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="dragonFire" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <filter id="dragonShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Wings */}
      <path d="M 40 120 Q 15 80 35 45 Q 55 60 60 100 Q 50 110 40 120 Z" fill="url(#dragonWing)" opacity="0.85" className="animate-wing-left" />
      <path d="M 220 120 Q 245 80 225 45 Q 205 60 200 100 Q 210 110 220 120 Z" fill="url(#dragonWing)" opacity="0.85" className="animate-wing-right" />
      {/* Wing bones */}
      <path d="M 45 115 L 35 55" stroke="#4c1d95" strokeWidth="2" fill="none" />
      <path d="M 215 115 L 225 55" stroke="#4c1d95" strokeWidth="2" fill="none" />

      {/* Tail */}
      <path d="M 185 180 Q 220 160 225 130 Q 230 110 240 100" stroke="url(#dragonBody)" strokeWidth="14" fill="none" strokeLinecap="round" className="animate-wag" />
      {/* Tail spike */}
      <polygon points="238,95 250,85 240,100" fill="#fbbf24" />

      {/* Body */}
      <ellipse cx="130" cy="180" rx="68" ry="60" fill="url(#dragonBody)" filter="url(#dragonShadow)" />
      {/* Belly scales */}
      <ellipse cx="130" cy="195" rx="42" ry="38" fill="#ddd6fe" opacity="0.7" />
      {/* Scale pattern */}
      <circle cx="110" cy="170" r="6" fill="#6d28d9" opacity="0.3" />
      <circle cx="130" cy="165" r="6" fill="#6d28d9" opacity="0.3" />
      <circle cx="150" cy="170" r="6" fill="#6d28d9" opacity="0.3" />
      <circle cx="120" cy="185" r="5" fill="#6d28d9" opacity="0.3" />
      <circle cx="140" cy="185" r="5" fill="#6d28d9" opacity="0.3" />

      {/* Legs */}
      <ellipse cx="90" cy="230" rx="20" ry="14" fill="#6d28d9" />
      <ellipse cx="170" cy="230" rx="20" ry="14" fill="#6d28d9" />
      {/* Claws */}
      <circle cx="82" cy="238" r="3" fill="#fbbf24" />
      <circle cx="90" cy="240" r="3" fill="#fbbf24" />
      <circle cx="98" cy="238" r="3" fill="#fbbf24" />
      <circle cx="162" cy="238" r="3" fill="#fbbf24" />
      <circle cx="170" cy="240" r="3" fill="#fbbf24" />
      <circle cx="178" cy="238" r="3" fill="#fbbf24" />

      {/* Head */}
      <circle cx="130" cy="95" r="48" fill="url(#dragonHead)" filter="url(#dragonShadow)" />
      {/* Snout */}
      <ellipse cx="130" cy="115" rx="22" ry="14" fill="#7c3aed" />

      {/* Horns */}
      <path d="M 100 55 L 85 15 L 110 50 Z" fill="#fbbf24" />
      <path d="M 160 55 L 175 15 L 150 50 Z" fill="#fbbf24" />
      <path d="M 102 52 L 92 25 L 108 48 Z" fill="#fde68a" opacity="0.6" />
      <path d="M 158 52 L 168 25 L 152 48 Z" fill="#fde68a" opacity="0.6" />

      {/* Eyes - fierce */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 100 90 Q 112 85 124 90" stroke="#4c1d95" strokeWidth="2.5" fill="none" />
          <path d="M 136 90 Q 148 85 160 90" stroke="#4c1d95" strokeWidth="2.5" fill="none" />
        </>
      ) : eyeState === 'focused' ? (
        <>
          {/* Focused eyes - training */}
          <ellipse cx="112" cy="88" rx="12" ry="13" fill="#fef3c7" />
          <ellipse cx="148" cy="88" rx="12" ry="13" fill="#fef3c7" />
          <ellipse cx="113" cy="90" rx="8" ry="10" fill={moodColor} />
          <ellipse cx="149" cy="90" rx="8" ry="10" fill={moodColor} />
          <ellipse cx="113" cy="90" rx="4" ry="9" fill="#1c1917" />
          <ellipse cx="149" cy="90" rx="4" ry="9" fill="#1c1917" />
          <circle cx="110" cy="85" r="2.5" fill="white" opacity="0.9" />
          <circle cx="146" cy="85" r="2.5" fill="white" opacity="0.9" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <ellipse cx="112" cy="88" rx="12" ry="13" fill="#fef3c7" />
          <ellipse cx="148" cy="88" rx="12" ry="13" fill="#fef3c7" />
          <ellipse cx="113" cy="90" rx="7" ry="9" fill={moodColor} className="animate-blink" />
          <ellipse cx="149" cy="90" rx="7" ry="9" fill={moodColor} className="animate-blink" />
          <ellipse cx="113" cy="90" rx="2.5" ry="8" fill="#1c1917" className="animate-blink" />
          <ellipse cx="149" cy="90" rx="2.5" ry="8" fill="#1c1917" className="animate-blink" />
          <circle cx="110" cy="85" r="2.5" fill="white" opacity="0.9" />
          <circle cx="146" cy="85" r="2.5" fill="white" opacity="0.9" />
        </>
      )}

      {/* Nostrils */}
      <circle cx="122" cy="112" r="3" fill="#1c1917" />
      <circle cx="138" cy="112" r="3" fill="#1c1917" />

      {/* Fire breath */}
      <circle cx="130" cy="130" r="5" fill="url(#dragonFire)" opacity="0.7" className="animate-fire" />
      <circle cx="122" cy="138" r="3" fill="url(#dragonFire)" opacity="0.5" className="animate-fire" />
      <circle cx="138" cy="135" r="4" fill="url(#dragonFire)" opacity="0.6" className="animate-fire" />
      <circle cx="130" cy="145" r="2.5" fill="#fbbf24" opacity="0.4" className="animate-fire" />

      {/* Spikes on back */}
      {showTeenFeatures && (
        <>
          <polygon points="120,50 125,35 130,50" fill="#fbbf24" />
          <polygon points="130,50 135,38 140,50" fill="#fbbf24" />
        </>
      )}

      {/* Adult features - fire wings */}
      {showAdultFeatures && (
        <g className="animate-breathe">
          <path d="M 40 120 Q 20 80 30 40 Q 45 60 50 100 Q 45 110 40 120 Z" fill="#f97316" opacity="0.7" />
          <path d="M 220 120 Q 240 80 230 40 Q 215 60 210 100 Q 215 110 220 120 Z" fill="#f97316" opacity="0.7" />
          <path d="M 45 115 Q 30 85 35 50 Q 45 65 48 100 Z" fill="#fbbf24" opacity="0.5" />
          <path d="M 215 115 Q 230 85 225 50 Q 215 65 212 100 Z" fill="#fbbf24" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}
/* ============ ЗАЙЧИК ============ */
function BunnyModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isPlaying = action === 'play';
  const eyeState = isSleeping ? 'closed' : isPlaying ? 'happy' : 'normal';

  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';

  return (
    <svg 
      width={220 * scale} 
      height={270 * scale} 
      viewBox="0 0 220 270" 
      className={`${stage === 'baby' ? 'animate-bounce-gentle' : 'animate-breathe'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="bunnyBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>
        <radialGradient id="bunnyHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </radialGradient>
        <linearGradient id="bunnyEar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="100%" stopColor="#fecdd3" />
        </linearGradient>
        <filter id="bunnyShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Fluffy tail */}
      <circle cx="110" cy="225" r="18" fill="white" className="animate-wag" />
      <circle cx="110" cy="225" r="12" fill="#f8fafc" opacity="0.7" />

      {/* Body */}
      <ellipse cx="110" cy="180" rx="55" ry="52" fill="url(#bunnyBody)" filter="url(#bunnyShadow)" />
      {/* Belly */}
      <ellipse cx="110" cy="190" rx="35" ry="32" fill="white" opacity="0.9" />

      {/* Back legs */}
      <ellipse cx="75" cy="225" rx="22" ry="14" fill="#e2e8f0" />
      <ellipse cx="145" cy="225" rx="22" ry="14" fill="#e2e8f0" />
      {/* Front paws */}
      <ellipse cx="88" cy="228" rx="14" ry="10" fill="url(#bunnyEar)" />
      <ellipse cx="132" cy="228" rx="14" ry="10" fill="url(#bunnyEar)" />

      {/* Head */}
      <circle cx="110" cy="105" r="45" fill="url(#bunnyHead)" filter="url(#bunnyShadow)" />

      {/* Long ears */}
      <ellipse cx="85" cy="35" rx="14" ry="48" fill="url(#bunnyHead)" className="animate-ear-left" />
      <ellipse cx="135" cy="35" rx="14" ry="48" fill="url(#bunnyHead)" className="animate-ear-right" />
      <ellipse cx="85" cy="38" rx="8" ry="38" fill="url(#bunnyEar)" className="animate-ear-left" />
      <ellipse cx="135" cy="38" rx="8" ry="38" fill="url(#bunnyEar)" className="animate-ear-right" />

      {/* Cheeks */}
      <circle cx="80" cy="115" r="10" fill="#fecdd3" opacity="0.5" />
      <circle cx="140" cy="115" r="10" fill="#fecdd3" opacity="0.5" />

      {/* Eyes - big cute */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 85 102 Q 95 97 105 102" stroke="#94a3b8" strokeWidth="2" fill="none" />
          <path d="M 115 102 Q 125 97 135 102" stroke="#94a3b8" strokeWidth="2" fill="none" />
        </>
      ) : eyeState === 'happy' ? (
        <>
          {/* Happy eyes - playing */}
          <path d="M 85 102 Q 95 94 105 102" stroke="#94a3b8" strokeWidth="2.5" fill="none" />
          <path d="M 115 102 Q 125 94 135 102" stroke="#94a3b8" strokeWidth="2.5" fill="none" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <circle cx="95" cy="100" r="12" fill="white" />
          <circle cx="125" cy="100" r="12" fill="white" />
          <circle cx="96" cy="102" r="8" fill={moodColor} className="animate-blink" />
          <circle cx="126" cy="102" r="8" fill={moodColor} className="animate-blink" />
          <circle cx="96" cy="102" r="5" fill="#1c1917" className="animate-blink" />
          <circle cx="126" cy="102" r="5" fill="#1c1917" className="animate-blink" />
          <circle cx="93" cy="98" r="3" fill="white" opacity="0.95" />
          <circle cx="123" cy="98" r="3" fill="white" opacity="0.95" />
          <circle cx="98" cy="105" r="1.5" fill="white" opacity="0.7" />
          <circle cx="128" cy="105" r="1.5" fill="white" opacity="0.7" />
        </>
      )}

      {/* Nose */}
      <ellipse cx="110" cy="115" rx="5" ry="4" fill="#f472b6" />
      <ellipse cx="109" cy="114" rx="2" ry="1.5" fill="#f9a8d4" opacity="0.6" />

      {/* Mouth */}
      <path d="M 110 119 L 110 123" stroke="#d4a5a5" strokeWidth="1.5" fill="none" />
      <path d="M 103 124 Q 110 129 117 124" stroke="#d4a5a5" strokeWidth="1.5" fill="none" />

      {/* Buck teeth */}
      <rect x="106" y="123" width="3.5" height="5" fill="white" rx="1" />
      <rect x="110.5" y="123" width="3.5" height="5" fill="white" rx="1" />

      {/* Whiskers */}
      <line x1="70" y1="112" x2="90" y2="114" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <line x1="70" y1="118" x2="90" y2="118" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <line x1="130" y1="114" x2="150" y2="112" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <line x1="130" y1="118" x2="150" y2="118" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
/* ============ ПАНДА ============ */
function PandaModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isPlaying = action === 'play';
  const eyeState = isSleeping ? 'closed' : isPlaying ? 'happy' : 'normal';

  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';

  return (
    <svg 
      width={240 * scale} 
      height={260 * scale} 
      viewBox="0 0 240 260" 
      className={`${stage === 'baby' ? 'animate-wiggle' : 'animate-sway'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="pandaBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>
        <radialGradient id="pandaHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </radialGradient>
        <radialGradient id="pandaBlack" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#292524" />
          <stop offset="100%" stopColor="#0c0a09" />
        </radialGradient>
        <filter id="pandaShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Body */}
      <ellipse cx="120" cy="170" rx="65" ry="60" fill="url(#pandaBody)" filter="url(#pandaShadow)" />
      {/* Belly */}
      <ellipse cx="120" cy="180" rx="40" ry="38" fill="white" opacity="0.9" />

      {/* Arms (black) */}
      <ellipse cx="55" cy="155" rx="22" ry="38" fill="url(#pandaBlack)" transform="rotate(-20, 55, 155)" />
      <ellipse cx="185" cy="155" rx="22" ry="38" fill="url(#pandaBlack)" transform="rotate(20, 185, 155)" />
      {/* Holding bamboo */}
      <rect x="180" y="130" width="6" height="60" fill="#16a34a" rx="2" />
      <ellipse cx="183" cy="125" rx="10" ry="5" fill="#22c55e" />
      <ellipse cx="183" cy="140" rx="8" ry="4" fill="#16a34a" />

      {/* Legs (black) */}
      <ellipse cx="85" cy="220" rx="22" ry="15" fill="url(#pandaBlack)" />
      <ellipse cx="155" cy="220" rx="22" ry="15" fill="url(#pandaBlack)" />
      {/* Paw pads */}
      <circle cx="82" cy="222" r="3" fill="#57534e" />
      <circle cx="88" cy="222" r="3" fill="#57534e" />
      <circle cx="152" cy="222" r="3" fill="#57534e" />
      <circle cx="158" cy="222" r="3" fill="#57534e" />

      {/* Head */}
      <circle cx="120" cy="88" r="52" fill="url(#pandaHead)" filter="url(#pandaShadow)" />

      {/* Ears */}
      <circle cx="72" cy="45" r="18" fill="url(#pandaBlack)" />
      <circle cx="168" cy="45" r="18" fill="url(#pandaBlack)" />
      <circle cx="72" cy="45" r="10" fill="#44403c" opacity="0.5" />
      <circle cx="168" cy="45" r="10" fill="#44403c" opacity="0.5" />

      {/* Eye patches */}
      <ellipse cx="95" cy="85" rx="20" ry="18" fill="url(#pandaBlack)" />
      <ellipse cx="145" cy="85" rx="20" ry="18" fill="url(#pandaBlack)" />

      {/* Eyes */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 85 87 Q 95 82 105 87" stroke="#1c1917" strokeWidth="2" fill="none" />
          <path d="M 135 87 Q 145 82 155 87" stroke="#1c1917" strokeWidth="2" fill="none" />
        </>
      ) : eyeState === 'happy' ? (
        <>
          {/* Happy eyes - playing */}
          <path d="M 85 87 Q 95 80 105 87" stroke="#1c1917" strokeWidth="2.5" fill="none" />
          <path d="M 135 87 Q 145 80 155 87" stroke="#1c1917" strokeWidth="2.5" fill="none" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <circle cx="95" cy="85" r="10" fill="white" />
          <circle cx="145" cy="85" r="10" fill="white" />
          <circle cx="96" cy="87" r="7" fill={moodColor} className="animate-blink" />
          <circle cx="146" cy="87" r="7" fill={moodColor} className="animate-blink" />
          <circle cx="96" cy="87" r="4" fill="#1c1917" className="animate-blink" />
          <circle cx="146" cy="87" r="4" fill="#1c1917" className="animate-blink" />
          <circle cx="93" cy="82" r="2.5" fill="white" opacity="0.95" />
          <circle cx="143" cy="82" r="2.5" fill="white" opacity="0.95" />
        </>
      )}

      {/* Nose */}
      <ellipse cx="120" cy="102" rx="7" ry="5" fill="#1c1917" />
      <ellipse cx="118" cy="100" rx="2.5" ry="1.5" fill="#57534e" opacity="0.5" />

      {/* Mouth - gentle smile */}
      <path d="M 112 110 Q 120 116 128 110" stroke="#57534e" strokeWidth="2" fill="none" />

      {/* Cheeks */}
      <circle cx="80" cy="105" r="6" fill="#fecdd3" opacity="0.4" />
      <circle cx="160" cy="105" r="6" fill="#fecdd3" opacity="0.4" />
    </svg>
  );
}
/* ============ СОВА ============ */
function OwlModel({ moodColor, action, stage }: { moodColor: string; action?: ActionType; stage: EvolutionStage }) {
  const isSleeping = action === 'sleep';
  const isTraining = action === 'train';
  const eyeState = isSleeping ? 'closed' : isTraining ? 'focused' : 'normal';

  const scale = stage === 'baby' ? 0.7 : stage === 'teen' ? 0.85 : 1;
  const showAdultFeatures = stage === 'adult';
  const showTeenFeatures = stage === 'teen' || stage === 'adult';

  return (
    <svg 
      width={240 * scale} 
      height={260 * scale} 
      viewBox="0 0 240 260" 
      className={`${stage === 'baby' ? 'animate-bounce-gentle' : 'animate-breathe'} drop-shadow-2xl`}
    >
      <defs>
        <radialGradient id="owlBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </radialGradient>
        <radialGradient id="owlHead" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="100%" stopColor="#78716c" />
        </radialGradient>
        <radialGradient id="owlFace" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fafaf9" />
          <stop offset="100%" stopColor="#d6d3d1" />
        </radialGradient>
        <linearGradient id="owlWing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#44403c" />
        </linearGradient>
        <filter id="owlShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Body */}
      <ellipse cx="120" cy="160" rx="58" ry="65" fill="url(#owlBody)" filter="url(#owlShadow)" />
      {/* Belly feathers */}
      <ellipse cx="120" cy="175" rx="38" ry="42" fill="#e7e5e4" opacity="0.8" />
      {/* Feather pattern */}
      <path d="M 100 155 Q 105 150 110 155" stroke="#57534e" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 120 155 Q 125 150 130 155" stroke="#57534e" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 110 170 Q 115 165 120 170" stroke="#57534e" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 130 170 Q 135 165 140 170" stroke="#57534e" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 105 185 Q 110 180 115 185" stroke="#57534e" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 125 185 Q 130 180 135 185" stroke="#57534e" strokeWidth="1" fill="none" opacity="0.5" />

      {/* Wings */}
      <ellipse cx="55" cy="150" rx="24" ry="50" fill="url(#owlWing)" className="animate-wing-left" />
      <ellipse cx="185" cy="150" rx="24" ry="50" fill="url(#owlWing)" className="animate-wing-right" />
      {/* Wing feather details */}
      <path d="M 45 135 Q 55 130 65 135" stroke="#292524" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 45 150 Q 55 145 65 150" stroke="#292524" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 45 165 Q 55 160 65 165" stroke="#292524" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 175 135 Q 185 130 195 135" stroke="#292524" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 175 150 Q 185 145 195 150" stroke="#292524" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M 175 165 Q 185 160 195 165" stroke="#292524" strokeWidth="1" fill="none" opacity="0.4" />

      {/* Head */}
      <circle cx="120" cy="80" r="48" fill="url(#owlHead)" filter="url(#owlShadow)" />
      {/* Face disc */}
      <circle cx="120" cy="85" r="38" fill="url(#owlFace)" />

      {/* Ear tufts */}
      <path d="M 80 45 L 65 10 L 92 40 Z" fill="#57534e" />
      <path d="M 160 45 L 175 10 L 148 40 Z" fill="#57534e" />
      <path d="M 82 43 L 72 20 L 89 39 Z" fill="#44403c" opacity="0.6" />
      <path d="M 158 43 L 168 20 L 151 39 Z" fill="#44403c" opacity="0.6" />

      {/* Big eyes - wise */}
      {eyeState === 'closed' ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M 77 82 Q 95 76 113 82" stroke="#57534e" strokeWidth="2.5" fill="none" />
          <path d="M 127 82 Q 145 76 163 82" stroke="#57534e" strokeWidth="2.5" fill="none" />
        </>
      ) : eyeState === 'focused' ? (
        <>
          {/* Focused eyes - training */}
          <circle cx="95" cy="80" r="18" fill="#fef3c7" />
          <circle cx="145" cy="80" r="18" fill="#fef3c7" />
          <circle cx="95" cy="80" r="18" fill="none" stroke="#78716c" strokeWidth="2" />
          <circle cx="145" cy="80" r="18" fill="none" stroke="#78716c" strokeWidth="2" />
          <circle cx="96" cy="82" r="12" fill={moodColor} />
          <circle cx="146" cy="82" r="12" fill={moodColor} />
          <circle cx="96" cy="82" r="8" fill="#1c1917" />
          <circle cx="146" cy="82" r="8" fill="#1c1917" />
          <circle cx="92" cy="77" r="3.5" fill="white" opacity="0.95" />
          <circle cx="142" cy="77" r="3.5" fill="white" opacity="0.95" />
        </>
      ) : (
        <>
          {/* Normal eyes */}
          <circle cx="95" cy="80" r="18" fill="#fef3c7" />
          <circle cx="145" cy="80" r="18" fill="#fef3c7" />
          <circle cx="95" cy="80" r="18" fill="none" stroke="#78716c" strokeWidth="2" />
          <circle cx="145" cy="80" r="18" fill="none" stroke="#78716c" strokeWidth="2" />
          <circle cx="96" cy="82" r="11" fill={moodColor} className="animate-blink" />
          <circle cx="146" cy="82" r="11" fill={moodColor} className="animate-blink" />
          <circle cx="96" cy="82" r="6" fill="#1c1917" className="animate-blink" />
          <circle cx="146" cy="82" r="6" fill="#1c1917" className="animate-blink" />
          <circle cx="92" cy="77" r="3.5" fill="white" opacity="0.95" />
          <circle cx="142" cy="77" r="3.5" fill="white" opacity="0.95" />
          <circle cx="99" cy="85" r="1.8" fill="white" opacity="0.7" />
          <circle cx="149" cy="85" r="1.8" fill="white" opacity="0.7" />
        </>
      )}

      {/* Beak */}
      <path d="M 112 95 L 120 110 L 128 95 Z" fill="#f59e0b" />
      <path d="M 114 97 L 120 106 L 126 97 Z" fill="#fbbf24" />

      {/* Graduation cap (for high IQ) */}
      <rect x="95" y="25" width="50" height="5" fill="#1c1917" />
      <polygon points="120,15 95,25 145,25" fill="#1c1917" />
      <line x1="145" y1="25" x2="150" y2="40" stroke="#fbbf24" strokeWidth="1.5" />
      <circle cx="150" cy="42" r="3" fill="#fbbf24" />

      {/* Feet */}
      <g>
        <line x1="100" y1="220" x2="95" y2="240" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <line x1="90" y1="240" x2="100" y2="240" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="95" y1="240" x2="105" y2="240" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="100" y1="240" x2="110" y2="240" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g>
        <line x1="140" y1="220" x2="145" y2="240" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <line x1="135" y1="240" x2="145" y2="240" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="140" y1="240" x2="150" y2="240" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="145" y1="240" x2="155" y2="240" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
