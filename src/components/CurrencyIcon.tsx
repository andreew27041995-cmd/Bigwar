import React from 'react';

interface CurrencyIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 13,
  sm: 15,
  md: 18,
  lg: 24
};

/**
 * Animated 3D spinning Gold Coin (GIF-style rotation around Y-axis with Pharaoh emblem)
 */
export const GoldCoinIcon: React.FC<CurrencyIconProps> = ({ size = 'sm', className = '' }) => {
  const px = SIZE_MAP[size] || 15;
  return (
    <span
      className={`inline-flex items-center justify-center align-middle select-none shrink-0 animate-gold-spin ${className}`}
      style={{ width: px, height: px }}
      title="Золото"
    >
      <svg
        viewBox="0 0 32 32"
        width={px}
        height={px}
        className="overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="goldCoinGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="45%" stopColor="#FACC15" />
            <stop offset="80%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </radialGradient>
          <linearGradient id="goldRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF9C3" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="url(#goldCoinGrad)" stroke="url(#goldRimGrad)" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="10.5" stroke="#FEF08A" strokeOpacity="0.65" strokeWidth="1" strokeDasharray="2 1.5" />
        <path
          d="M16 8.5L21.5 18.5H10.5L16 8.5Z"
          fill="#FEF9C3"
          stroke="#92400E"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="15" r="1.6" fill="#D97706" />
        <circle cx="11" cy="10" r="1.5" fill="#FFFFFF" fillOpacity="0.8" />
      </svg>
    </span>
  );
};

/**
 * Animated Ultra-Bright Shimmering Crystal (vivid cyan/magenta/sky-blue faceted gem with sparkles)
 */
export const CrystalIcon: React.FC<CurrencyIconProps> = ({ size = 'sm', className = '' }) => {
  const px = SIZE_MAP[size] || 15;
  return (
    <span
      className={`inline-flex items-center justify-center align-middle select-none shrink-0 animate-crystal-glow ${className}`}
      style={{ width: px, height: px }}
      title="Кристаллы"
    >
      <svg
        viewBox="0 0 32 32"
        width={px}
        height={px}
        className="overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="crystalMainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="30%" stopColor="#38BDF8" />
            <stop offset="65%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#C026D3" />
          </linearGradient>
          <linearGradient id="crystalLeftFacet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#67E8F9" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="crystalRightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#0891B2" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#86198F" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* Outer Diamond Polygon */}
        <polygon
          points="16,2 27,10 23,28 9,28 5,10"
          fill="url(#crystalMainGrad)"
          stroke="#E0F2FE"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Left Bright Facet */}
        <polygon points="16,2 5,10 11,13" fill="url(#crystalLeftFacet)" />
        {/* Right Facet */}
        <polygon points="16,2 27,10 21,13" fill="#67E8F9" fillOpacity="0.75" />
        {/* Top Crown Table */}
        <polygon points="16,2 21,13 11,13" fill="#FFFFFF" fillOpacity="0.85" />
        {/* Center Shimmer Facet */}
        <polygon points="11,13 21,13 16,29" fill="#22D3EE" fillOpacity="0.65" />
        {/* Bottom Left Facet */}
        <polygon points="5,10 11,13 16,29 9,28" fill="url(#crystalLeftFacet)" fillOpacity="0.7" />
        {/* Bottom Right Facet */}
        <polygon points="27,10 21,13 16,29 23,28" fill="url(#crystalRightFacet)" />
        {/* Sparkle Glints */}
        <path d="M10 6L11 9L14 10L11 11L10 14L9 11L6 10L9 9L10 6Z" fill="#FFFFFF" />
        <circle cx="23" cy="8" r="1.3" fill="#FFFFFF" />
      </svg>
    </span>
  );
};
