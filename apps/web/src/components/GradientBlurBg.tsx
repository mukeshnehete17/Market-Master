import './gradient-blur-bg.css';

export function GradientBlurBg() {
  return (
    <div className="gradient-blur-bg-container" aria-hidden="true">
      {/* Blurred Organic Gradient Orbs */}
      <div className="blur-orb orb-1" />
      <div className="blur-orb orb-2" />
      <div className="blur-orb orb-3" />

      {/* Grid Pattern Overlay from 21st.dev component */}
      <div className="gradient-grid-pattern" />

      {/* Vignette / Edge Softener */}
      <div className="gradient-vignette" />
    </div>
  );
}
