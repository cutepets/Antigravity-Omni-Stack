'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Variant = 'icon' | 'pill' | 'text' | 'premium'

interface DarkModeButtonProps {
  variant?: Variant
  showLabel?: boolean
  className?: string
  tooltip?: string
}

export function DarkModeButton({
  variant = 'icon',
  showLabel = false,
  className,
  tooltip = 'Đổi giao diện',
}: DarkModeButtonProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid Hydration Mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  if (variant === 'pill') {
    return <PillToggle isDark={isDark} onToggle={toggleTheme} className={className} />
  }

  if (variant === 'premium') {
    return <PremiumToggle isDark={isDark} onToggle={toggleTheme} className={className} />
  }

  const button = (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      className={cn(
        'relative flex items-center gap-2 rounded-lg p-2',
        'text-foreground-muted hover:text-foreground-base',
        'hover:bg-background-tertiary',
        'transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
        className,
      )}
    >
      <span className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        <Sun
          size={18}
          className={cn(
            'absolute transition-all duration-300',
            isDark
              ? 'opacity-0 rotate-90 scale-50'
              : 'opacity-100 rotate-0 scale-100 text-amber-400',
          )}
        />
        <Moon
          size={18}
          className={cn(
            'absolute transition-all duration-300',
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-blue-400'
              : 'opacity-0 -rotate-90 scale-50',
          )}
        />
      </span>

      {showLabel && mounted && (
        <span className="text-sm font-medium select-none">
          {isDark ? 'Tối' : 'Sáng'}
        </span>
      )}
    </button>
  )

  // Temporarily disable tooltip to prevent missing dependency errors, unless tooltip is implemented.
  return button
}

function PillToggle({
  isDark,
  onToggle,
  className,
}: {
  isDark: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      className={cn(
        'relative flex items-center w-14 h-7 rounded-full px-1',
        'transition-all duration-300 focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary-500/50',
        isDark
          ? 'bg-background-tertiary border border-border'
          : 'bg-amber-100 border border-amber-200',
        className,
      )}
    >
      <span
        className={cn(
          'absolute w-5 h-5 rounded-full flex items-center justify-center',
          'shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          isDark
            ? 'left-1 bg-background-secondary text-blue-400'
            : 'left-8 bg-white text-amber-500',
        )}
      >
        {isDark ? <Moon size={11} /> : <Sun size={11} />}
      </span>

      <Sun
        size={12}
        className={cn(
          'absolute right-1.5 transition-opacity duration-300',
          isDark ? 'opacity-30 text-foreground-muted' : 'opacity-0',
        )}
      />
      <Moon
        size={12}
        className={cn(
          'absolute left-1.5 transition-opacity duration-300',
          isDark ? 'opacity-0' : 'opacity-30 text-foreground-muted',
        )}
      />
    </button>
  )
}

export function ThemeTogglePill({ className }: { className?: string }) {
  return <DarkModeButton variant="pill" className={className} />
}

function PremiumToggle({
  isDark,
  onToggle,
  className,
}: {
  isDark: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div
      onClick={onToggle}
      className={cn('flex-shrink-0 relative cursor-pointer rounded-full', className)}
      style={{
        width: '200px',
        height: '72px',
      }}
    >
      {/* Handle glow follower */}
      <span style={{
        position: 'absolute',
        top: '5px',
        left: isDark ? '5px' : 'calc(100% - 67px - 5px)',
        width: '67px',
        height: '62px',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 20,
        transition: 'left 0.65s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: isDark
          ? '0 0 28px 14px rgba(100,155,240,0.45), 0 0 55px 28px rgba(80,130,220,0.18)'
          : '0 0 28px 14px rgba(255,175,0,0.55), 0 0 55px 28px rgba(255,140,0,0.22)',
      }} />

      {/* Inner track */}
      <button
        aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
        style={{
          position: 'absolute', inset: 0,
          borderRadius: '9999px',
          overflow: 'hidden',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          boxShadow: `inset 0 3px 8px rgba(0,0,0,0.18), 0 0 0 3.5px ${isDark ? 'rgba(100,130,220,0.5)' : 'rgba(255,255,255,0.9)'}, 0 6px 24px rgba(0,0,0,0.14)`,
          transition: 'box-shadow 0.65s cubic-bezier(0.4,0,0.2,1)',
          background: 'transparent',
        }}
      >
        {/* SKY: Day */}
        <span style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(150deg, #9ecfec 0%, #c8e8f8 50%, #b5d8ef 100%)',
          opacity: isDark ? 0 : 1,
          transition: 'opacity 0.65s cubic-bezier(0.4,0,0.2,1)',
        }} />
        {/* SKY: Night */}
        <span style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(150deg, #080f22 0%, #0c1a3d 50%, #0f2050 100%)',
          opacity: isDark ? 1 : 0,
          transition: 'opacity 0.65s cubic-bezier(0.4,0,0.2,1)',
        }} />

        {/* CLOUDS */}
        <span style={{
          position: 'absolute',
          right: '70px', top: '10px',
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'translateX(-30px)' : 'translateX(0)',
          transition: 'opacity 0.65s ease, transform 0.65s ease',
          pointerEvents: 'none',
        }}>
          <span style={{
            display: 'block', position: 'relative',
            width: '52px', height: '17px',
            background: 'linear-gradient(180deg,#fff 55%,#daeaf5 100%)',
            borderRadius: '40px',
            boxShadow: '0 3px 10px rgba(150,180,210,0.3)',
          }}>
            <span style={{
              position: 'absolute', content: '""',
              width: '26px', height: '26px',
              background: 'linear-gradient(135deg,#fff 60%,#daeaf5)',
              borderRadius: '50%',
              top: '-13px', left: '7px',
            }} />
            <span style={{
              position: 'absolute',
              width: '18px', height: '18px',
              background: 'white',
              borderRadius: '50%',
              top: '-8px', left: '27px',
            }} />
          </span>
          <span style={{
            display: 'block', position: 'absolute',
            width: '36px', height: '12px',
            background: 'linear-gradient(180deg,#fff 55%,#daeaf5)',
            borderRadius: '40px',
            top: '19px', left: '-14px',
            opacity: 0.75,
          }}>
            <span style={{
              position: 'absolute',
              width: '17px', height: '17px',
              background: 'white',
              borderRadius: '50%',
              top: '-9px', left: '6px',
            }} />
          </span>
        </span>

        {/* PINE TREES */}
        <span style={{
          position: 'absolute',
          bottom: 0, left: '6px',
          display: 'flex', alignItems: 'flex-end', gap: '2px',
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'translateY(16px)' : 'translateY(0)',
          transition: 'opacity 0.65s ease, transform 0.65s ease',
          pointerEvents: 'none',
        }}>
          <svg viewBox="0 0 24 42" width="20" height="38">
            <rect x="9.5" y="30" width="5" height="12" rx="1.5" fill="#7a4820"/>
            <polygon points="12,5 20,28 4,28" fill="#2d6526"/>
            <polygon points="12,2 19,22 5,22" fill="#3a7d30"/>
            <polygon points="12,0 17,15 7,15" fill="#4d9641"/>
          </svg>
          <svg viewBox="0 0 24 50" width="22" height="44">
            <rect x="9.5" y="36" width="5" height="14" rx="1.5" fill="#6b3a14"/>
            <polygon points="12,5 21,34 3,34" fill="#265922"/>
            <polygon points="12,2 20,26 4,26" fill="#317029"/>
            <polygon points="12,0 18,18 6,18" fill="#4a9440"/>
          </svg>
          <svg viewBox="0 0 20 34" width="17" height="30">
            <rect x="7.5" y="24" width="5" height="10" rx="1.5" fill="#7a4820"/>
            <polygon points="10,3 17,22 3,22" fill="#2d6526"/>
            <polygon points="10,1 16,14 4,14" fill="#4a9440"/>
          </svg>
        </span>

        {/* STARS */}
        {[
          { top: '14%', left: '30%', s: 2.5, delay: '0s' },
          { top: '58%', left: '45%', s: 1.8, delay: '0.3s' },
          { top: '25%', left: '58%', s: 2.0, delay: '0.15s' },
          { top: '70%', left: '32%', s: 1.4, delay: '0.45s' },
          { top: '40%', left: '65%', s: 1.2, delay: '0.2s' },
          { top: '16%', left: '72%', s: 1.0, delay: '0.35s' },
          { top: '80%', left: '55%', s: 1.6, delay: '0.1s' },
          { top: '50%', left: '72%', s: 1.0, delay: '0.5s' },
        ].map((st, i) => (
          <span key={`star-${i}`} style={{
            position: 'absolute',
            top: st.top, left: st.left,
            width: `${st.s}px`, height: `${st.s}px`,
            borderRadius: '50%',
            background: 'white',
            opacity: isDark ? 0.9 : 0,
            transition: `opacity 0.65s ease ${st.delay}`,
            boxShadow: `0 0 ${st.s * 2.5}px rgba(200,220,255,0.95)`,
            animation: isDark ? `twinkle-${i % 3} ${2 + i * 0.3}s ease-in-out infinite` : 'none',
            pointerEvents: 'none',
          }} />
        ))}

        {/* HANDLE */}
        <span style={{
          position: 'absolute',
          top: '5px',
          left: isDark ? '5px' : 'calc(100% - 67px - 5px)',
          width: '67px',
          height: '62px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          zIndex: 10,
          transition: 'left 0.65s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Day glow aura */}
          <span style={{
            position: 'absolute', inset: '-6px',
            borderRadius: '50%',
            boxShadow: '0 0 30px 14px rgba(255,175,0,0.55), 0 0 60px 24px rgba(255,140,0,0.2)',
            opacity: isDark ? 0 : 1,
            transition: 'opacity 0.65s ease',
            pointerEvents: 'none',
          }} />
          {/* Night glow aura */}
          <span style={{
            position: 'absolute', inset: '-6px',
            borderRadius: '50%',
            boxShadow: '0 0 30px 14px rgba(100,155,240,0.5), 0 0 55px 22px rgba(80,130,220,0.18)',
            opacity: isDark ? 1 : 0,
            transition: 'opacity 0.65s ease',
            pointerEvents: 'none',
          }} />

          {/* SUN */}
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isDark ? 0 : 1,
            transition: 'opacity 0.65s ease',
          }}>
            <svg
              width="76" height="76" viewBox="0 0 76 76"
              style={{
                position: 'absolute',
                animation: 'spin-sun 14s linear infinite',
              }}
            >
              <defs>
                <style>{`@keyframes spin-sun { to { transform: rotate(360deg); } }`}</style>
              </defs>
              <g transform="translate(38,38)">
                {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
                  <polygon key={deg}
                    points="0,-36 1.6,-25 -1.6,-25"
                    fill={i % 2 === 0 ? '#f7d020' : '#f5a800'}
                    opacity={i % 2 === 0 ? 0.95 : 0.7}
                    transform={`rotate(${deg})`}
                  />
                ))}
              </g>
            </svg>
            <span style={{
              position: 'relative',
              width: '46px', height: '46px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 36% 32%, #fffde0, #fcd535 30%, #f0920a 65%, #d06500)',
              boxShadow: '0 0 0 3px rgba(252,200,30,0.5), 0 0 18px 8px rgba(252,160,10,0.55), 0 0 40px 16px rgba(240,120,0,0.28)',
              zIndex: 2,
            }}>
              <span style={{
                position: 'absolute',
                top: '12%', left: '16%',
                width: '34%', height: '28%',
                background: 'rgba(255,255,255,0.5)',
                borderRadius: '50%',
                filter: 'blur(3px)',
              }} />
            </span>
          </span>

          {/* MOON */}
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isDark ? 1 : 0,
            transition: 'opacity 0.65s ease',
          }}>
            <svg width="58" height="58" viewBox="0 0 80 80">
              <defs>
                <radialGradient id="mG2" cx="38%" cy="32%" r="58%">
                  <stop offset="0%"   stopColor="#edf1f5"/>
                  <stop offset="45%"  stopColor="#bdc9d5"/>
                  <stop offset="100%" stopColor="#7e94a6"/>
                </radialGradient>
                <radialGradient id="cG2" cx="50%" cy="28%" r="62%">
                  <stop offset="0%"   stopColor="rgba(255,255,255,0.18)"/>
                  <stop offset="100%" stopColor="rgba(0,0,0,0.28)"/>
                </radialGradient>
                <mask id="cresc2">
                  <circle cx="40" cy="40" r="32" fill="white"/>
                  <circle cx="55" cy="29" r="26" fill="black"/>
                </mask>
              </defs>
              <g mask="url(#cresc2)">
                <circle cx="40" cy="40" r="32" fill="url(#mG2)"/>
                <circle cx="28" cy="50" r="6.5" fill="url(#cG2)" opacity="0.75"/>
                <circle cx="24" cy="32" r="4.5" fill="url(#cG2)" opacity="0.65"/>
                <circle cx="36" cy="60" r="5.5" fill="url(#cG2)" opacity="0.55"/>
                <ellipse cx="26" cy="26" rx="9" ry="6" fill="rgba(255,255,255,0.22)" transform="rotate(-25,26,26)"/>
              </g>
              <polygon
                points="60,10 62,17 69,17 63.5,21.5 65.5,28.5 60,24.5 54.5,28.5 56.5,21.5 51,17 58,17"
                fill="white" opacity="0.92"
              />
            </svg>
          </span>
        </span>
      </button>
    </div>
  )
}

export function ThemeTogglePremium({ className }: { className?: string }) {
  return <DarkModeButton variant="premium" className={className} />
}
