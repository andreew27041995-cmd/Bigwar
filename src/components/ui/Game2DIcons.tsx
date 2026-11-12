import React from 'react';

export interface Game2DIconProps {
  size?: number;
  className?: string;
}

/**
 * 1. ПИРАМИДА / В БОЙ — Golden Stepped Pyramid with Glowing Turquoise Eye of Ra & Khopesh Blades
 */
export const Game2DPyramidIcon: React.FC<Game2DIconProps & { active?: boolean }> = ({
  size = 24,
  className = '',
  active = false
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <defs>
      <linearGradient id="pyr2dGoldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="pyr2dGoldRight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="60%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
      <radialGradient id="pyr2dApexGem" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="45%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0369A1" />
      </radialGradient>
    </defs>
    {/* Outer Radiant Halo when active */}
    {active && (
      <circle cx="18" cy="19" r="15" fill="#F59E0B" fillOpacity="0.22" />
    )}
    {/* Base Platform */}
    <path
      d="M3 31L6 27H30L33 31H3Z"
      fill="#78350F"
      stroke="#271003"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Left sunlit face */}
    <polygon
      points="18,5 5,28 18,30"
      fill="url(#pyr2dGoldLeft)"
      stroke="#271003"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Right shaded face */}
    <polygon
      points="18,5 31,28 18,30"
      fill="url(#pyr2dGoldRight)"
      stroke="#271003"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Stepped horizontal masonry lines */}
    <path
      d="M12.5 15L18 16L23.5 15M9.5 20.5L18 22L26.5 20.5M6.8 25.5L18 27L29.2 25.5"
      stroke="#451A03"
      strokeOpacity="0.55"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    {/* Glowing Turquoise Capstone / Portal Gem */}
    <polygon
      points="18,4.5 13.5,12.5 18,13.8 22.5,12.5"
      fill="url(#pyr2dApexGem)"
      stroke="#BAE6FD"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {/* Temple Doorway */}
    <path
      d="M15.2 29.5V23.5C15.2 22.2 16.4 21.5 18 21.5C19.6 21.5 20.8 22.2 20.8 23.5V29.5H15.2Z"
      fill="#0F172A"
      stroke="#FDE047"
      strokeWidth="1.1"
    />
    <circle cx="18" cy="25.5" r="1.5" fill="#38BDF8" />
    {/* Top Specular Glint */}
    <circle cx="16.5" cy="8.5" r="1" fill="#FFFFFF" />
  </svg>
);

/**
 * 2. ГЕРОЙ — Pharaoh Royal Nemes Helmet & Armor Medallion
 */
export const Game2DHeroIcon: React.FC<Game2DIconProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <defs>
      <linearGradient id="heroNemesGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
      <linearGradient id="heroLapis" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="55%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#1E3A8A" />
      </linearGradient>
    </defs>
    {/* Nemes Headdress Outer Wings */}
    <path
      d="M18 4C10 4 5 10 5 18C5 24 8 29 10 32H26C28 29 31 24 31 18C31 10 26 4 18 4Z"
      fill="url(#heroNemesGold)"
      stroke="#271003"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    {/* Lapis Lazuli Stripes */}
    <path
      d="M7 13H12M24 13H29M6 18H11M25 18H30M7 23H12M24 23H29"
      stroke="url(#heroLapis)"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Pharaoh Face / Golden Mask */}
    <path
      d="M12 13C12 10 14.5 8.5 18 8.5C21.5 8.5 24 10 24 13V20C24 23.8 21.3 26.5 18 26.5C14.7 26.5 12 23.8 12 20V13Z"
      fill="#FBBF24"
      stroke="#451A03"
      strokeWidth="1.5"
    />
    {/* Glowing Cyan Eyes of Horus */}
    <path d="M14.2 16.5L16.8 17L14.5 18Z" fill="#E0F2FE" stroke="#0369A1" strokeWidth="0.6" />
    <path d="M21.8 16.5L19.2 17L21.5 18Z" fill="#E0F2FE" stroke="#0369A1" strokeWidth="0.6" />
    {/* Royal Uraeus Cobra Gem on Forehead */}
    <circle cx="18" cy="8.5" r="2.6" fill="#EF4444" stroke="#FEF08A" strokeWidth="1.1" />
    <circle cx="17.3" cy="7.8" r="0.8" fill="#FFFFFF" />
    {/* Royal Beard */}
    <path
      d="M16.2 26H19.8L19 32.5H17L16.2 26Z"
      fill="url(#heroLapis)"
      stroke="#271003"
      strokeWidth="1.2"
    />
  </svg>
);

/**
 * 3. МИР — Golden Nile Anchor & Turquoise Compass Star
 */
export const Game2DWorldIcon: React.FC<Game2DIconProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <defs>
      <radialGradient id="worldSeaOrb" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#67E8F9" />
        <stop offset="55%" stopColor="#0891B2" />
        <stop offset="100%" stopColor="#0F172A" />
      </radialGradient>
      <linearGradient id="worldGoldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
    </defs>
    {/* Turquoise Nile Compass Medallion */}
    <circle
      cx="18"
      cy="18"
      r="13.5"
      fill="url(#worldSeaOrb)"
      stroke="url(#worldGoldTrim)"
      strokeWidth="2.4"
    />
    {/* Inner Golden Ring */}
    <circle cx="18" cy="18" r="10.2" stroke="#FEF08A" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 2" />
    {/* Golden Royal Anchor / Compass Star */}
    <circle cx="18" cy="9.5" r="2.3" fill="url(#worldGoldTrim)" stroke="#271003" strokeWidth="1.2" />
    <path
      d="M18 12V27M13 15.5H23"
      stroke="url(#worldGoldTrim)"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    <path
      d="M10.5 21.5C11.5 25.5 14.5 27.5 18 27.5C21.5 27.5 24.5 25.5 25.5 21.5"
      stroke="url(#worldGoldTrim)"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    {/* Center Ruby Gem */}
    <circle cx="18" cy="16" r="2" fill="#F43F5E" stroke="#FEF08A" strokeWidth="0.9" />
    {/* Gloss Highlight */}
    <ellipse cx="13" cy="10" rx="3.5" ry="1.6" transform="rotate(-25 13 10)" fill="#FFFFFF" fillOpacity="0.45" />
  </svg>
);

/**
 * 4. СОЦИУМ — Royal Winged Scarab Crest Shield
 */
export const Game2DSocialIcon: React.FC<Game2DIconProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <defs>
      <linearGradient id="socEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6EE7B7" />
        <stop offset="50%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#064E3B" />
      </linearGradient>
      <linearGradient id="socGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
    </defs>
    {/* Guild Shield Base */}
    <path
      d="M18 4L30 8.5V17.5C30 25 24.8 30.2 18 32.5C11.2 30.2 6 25 6 17.5V8.5L18 4Z"
      fill="url(#socEmeraldGrad)"
      stroke="url(#socGoldGrad)"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    {/* Inner Shield Bevel */}
    <path
      d="M18 7L27 10.5V17.2C27 23 23 27.2 18 29.2C13 27.2 9 23 9 17.2V10.5L18 7Z"
      stroke="#A7F3D0"
      strokeOpacity="0.5"
      strokeWidth="1"
    />
    {/* Golden Scarab / Crown Emblem */}
    <path
      d="M12 20L10 13.5L14.5 16.5L18 11.5L21.5 16.5L26 13.5L24 20H12Z"
      fill="url(#socGoldGrad)"
      stroke="#271003"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <rect x="12" y="21" width="12" height="2.5" rx="1" fill="#FEF08A" stroke="#271003" strokeWidth="1" />
    <circle cx="18" cy="17.5" r="1.5" fill="#EF4444" />
    {/* Top Specular Shine */}
    <circle cx="14" cy="10" r="1.2" fill="#FFFFFF" fillOpacity="0.7" />
  </svg>
);

/**
 * 5. МАГАЗИН — Ornate Pharaoh Treasure Chest with Gold & Gems
 */
export const Game2DShopIcon: React.FC<Game2DIconProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <defs>
      <linearGradient id="chestWood" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B91C1C" />
        <stop offset="50%" stopColor="#7F1D1D" />
        <stop offset="100%" stopColor="#450A0A" />
      </linearGradient>
      <linearGradient id="chestGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
    </defs>
    {/* Chest Lid (Domed) */}
    <path
      d="M5 15C5 9.5 10 6.5 18 6.5C26 6.5 31 9.5 31 15H5Z"
      fill="url(#chestWood)"
      stroke="url(#chestGold)"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    {/* Overflowing Gold & Cyan Gem Glow */}
    <path d="M7 15.5H29" stroke="#FEF08A" strokeWidth="2.2" />
    <circle cx="13" cy="14.5" r="2" fill="#FACC15" />
    <circle cx="23" cy="14.5" r="2" fill="#38BDF8" />
    <circle cx="18" cy="14" r="2.2" fill="#FDE047" />
    {/* Chest Lower Body */}
    <rect
      x="5"
      y="16"
      width="26"
      height="14"
      rx="2.5"
      fill="url(#chestWood)"
      stroke="url(#chestGold)"
      strokeWidth="2.2"
    />
    {/* Vertical Gold Straps */}
    <rect x="10" y="7.5" width="3" height="22" fill="url(#chestGold)" />
    <rect x="23" y="7.5" width="3" height="22" fill="url(#chestGold)" />
    {/* Center Golden Lock Plate with Cyan Gem */}
    <rect
      x="15"
      y="13.5"
      width="6"
      height="7.5"
      rx="1.5"
      fill="url(#chestGold)"
      stroke="#271003"
      strokeWidth="1.2"
    />
    <circle cx="18" cy="17.2" r="1.6" fill="#06B6D4" stroke="#E0F2FE" strokeWidth="0.7" />
    {/* Sparkle */}
    <path d="M28 5L29 7.5L31.5 8.5L29 9.5L28 12L27 9.5L24.5 8.5L27 7.5L28 5Z" fill="#FEF08A" />
  </svg>
);

/**
 * 6. РЫБАЛКА — Golden Nile Fishing Rod & Glowing Turquoise Fish
 */
export const Game2DFishingIcon: React.FC<Game2DIconProps> = ({ size = 22, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <defs>
      <linearGradient id="fishTurquoise" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A5F3FC" />
        <stop offset="50%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#0E7490" />
      </linearGradient>
    </defs>
    {/* Golden Rod Arc */}
    <path
      d="M6 30L22 7C24 4.5 27 4.5 28.5 6.5"
      stroke="#F59E0B"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    {/* Fishing Line */}
    <path d="M28.5 6.5V19" stroke="#E0F2FE" strokeWidth="1.2" strokeDasharray="2 1.5" />
    {/* Glowing Nile Fish */}
    <path
      d="M14 23C17 18.5 24 18.5 28 22.5C24 26.5 17 26.5 14 23Z"
      fill="url(#fishTurquoise)"
      stroke="#164E63"
      strokeWidth="1.4"
    />
    <polygon points="14,23 9.5,19.5 10.5,26.5" fill="#F59E0B" stroke="#78350F" strokeWidth="1" />
    <circle cx="24.5" cy="22" r="1.2" fill="#FEF08A" />
  </svg>
);

/**
 * 7. АЗАРТ / КОЛЕСО ФОРТУНЫ — Golden Wheel of Fortune with Rubies & Sapphires
 */
export const Game2DWheelIcon: React.FC<Game2DIconProps> = ({ size = 22, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none shrink-0 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
  >
    <circle cx="18" cy="18" r="13" fill="#4C0519" stroke="#F59E0B" strokeWidth="2.6" />
    <path d="M18 5V31M5 18H31M8.8 8.8L27.2 27.2M27.2 8.8L8.8 27.2" stroke="#FBBF24" strokeWidth="1.5" />
    <circle cx="18" cy="18" r="4" fill="#FEF08A" stroke="#78350F" strokeWidth="1.5" />
    <circle cx="18" cy="18" r="1.8" fill="#EF4444" />
    <polygon points="18,2 15.5,6.5 20.5,6.5" fill="#38BDF8" stroke="#0F172A" strokeWidth="0.8" />
  </svg>
);

/**
 * 8. ЗЕЛЬЕ / АЛХИМИЧЕСКАЯ КОЛБА (HP / EN / EXP 2D Glossy Flask)
 */
export const Game2DPotionIcon: React.FC<Game2DIconProps & { variant?: 'hp' | 'en' | 'exp' }> = ({
  size = 16,
  className = '',
  variant = 'hp'
}) => {
  const colors =
    variant === 'hp'
      ? { top: '#FDA4AF', mid: '#E11D48', bot: '#881337', rim: '#FB7185' }
      : variant === 'en'
      ? { top: '#BAE6FD', mid: '#0284C7', bot: '#0C4A6E', rim: '#38BDF8' }
      : { top: '#F0ABFC', mid: '#A855F7', bot: '#4C1D95', rim: '#C084FC' };

  const gradId = `potion2d_${variant}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 overflow-visible drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${className}`}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={colors.top} />
          <stop offset="50%" stopColor={colors.mid} />
          <stop offset="100%" stopColor={colors.bot} />
        </radialGradient>
      </defs>
      {/* Cork */}
      <rect x="11.5" y="2" width="5" height="3.5" rx="1" fill="#D97706" stroke="#451A03" strokeWidth="1" />
      {/* Golden Neck Ring */}
      <rect x="10" y="5" width="8" height="2.5" rx="1" fill="#FACC15" stroke="#78350F" strokeWidth="1" />
      {/* Glass Bulb */}
      <path
        d="M11 7.5L6.5 14.5C5 17 5.5 21 8 23.2C9.8 24.8 12 25.5 14 25.5C16 25.5 18.2 24.8 20 23.2C22.5 21 23 17 21.5 14.5L17 7.5H11Z"
        fill={`url(#${gradId})`}
        stroke="#FDE047"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Specular Glass Highlight */}
      <path
        d="M9.5 14C8.2 16 8.2 19 9.5 21"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="11" cy="11.5" r="1.1" fill="#FFFFFF" fillOpacity="0.9" />
    </svg>
  );
};

/**
 * 9. ЕГИПЕТСКИЕ ЗОЛОТЫЕ УГОЛКИ ДЛЯ 2D РАМОК (Ornate Gold & Lapis Corner Brackets)
 */
export const EgyptianCornerOrnaments: React.FC<{ variant?: 'gold' | 'cyan' }> = ({
  variant = 'gold'
}) => {
  const mainStroke = variant === 'cyan' ? '#38BDF8' : '#FBBF24';
  const gemColor = variant === 'cyan' ? '#F59E0B' : '#06B6D4';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-10">
      {/* Top-Left Corner */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="absolute top-0.5 left-0.5">
        <path d="M1 11V2C1 1.4 1.4 1 2 1H11" fill="none" stroke={mainStroke} strokeWidth="2" strokeLinecap="round" />
        <circle cx="3.5" cy="3.5" r="1.6" fill={gemColor} />
      </svg>
      {/* Top-Right Corner */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="absolute top-0.5 right-0.5">
        <path d="M15 11V2C15 1.4 14.6 1 14 1H5" fill="none" stroke={mainStroke} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12.5" cy="3.5" r="1.6" fill={gemColor} />
      </svg>
      {/* Bottom-Left Corner */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="absolute bottom-0.5 left-0.5">
        <path d="M1 5V14C1 14.6 1.4 15 2 15H11" fill="none" stroke={mainStroke} strokeWidth="2" strokeLinecap="round" />
        <circle cx="3.5" cy="12.5" r="1.6" fill={gemColor} />
      </svg>
      {/* Bottom-Right Corner */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="absolute bottom-0.5 right-0.5">
        <path d="M15 5V14C15 14.6 14.6 15 14 15H5" fill="none" stroke={mainStroke} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12.5" cy="12.5" r="1.6" fill={gemColor} />
      </svg>
    </div>
  );
};
