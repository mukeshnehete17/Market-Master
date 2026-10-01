import './gradient-blur-bg.css';

export function GradientBlurBg() {
  return (
    <div className="ocean-bg-container" aria-hidden="true">
      {/* Cinematic Animated Image Background */}
      <div className="cinematic-bg-img" />

      {/* White Translucent Overlay to keep text readable & minimal */}
      <div className="cinematic-overlay" />

      {/* Very Subtle Animated Grid */}
      <div className="ocean-sky-grid" />
    </div>
  );
}
