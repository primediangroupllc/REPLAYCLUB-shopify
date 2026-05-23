/**
 * Studio representative signature — the "Replay Club" mark applied to consent
 * agreements. Mr Dafoe signature face with the site's chrome-gradient ink and
 * a flourish underline. On mount the mark "signs itself" — the ink wipes in
 * left-to-right, then the flourish draws beneath it (animation in index.css).
 */
const StudioRepSignature = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative inline-block px-3">
        <span className="signature-ink chrome-text font-signature text-4xl leading-none inline-block select-none px-5">
          Replay Club
        </span>
        <svg
          viewBox="0 0 300 28"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute -bottom-1.5 left-0 h-3 w-full overflow-visible"
        >
          <defs>
            <linearGradient id="sigInk" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#c8c8c8" />
              <stop offset="100%" stopColor="#7d7d7d" />
            </linearGradient>
          </defs>
          <path
            className="signature-flourish"
            d="M6,16 C70,27 150,5 226,15 C257,19 280,22 296,9"
            pathLength={100}
            fill="none"
            stroke="url(#sigInk)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default StudioRepSignature;
