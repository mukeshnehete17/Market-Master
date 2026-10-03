import { type ReactNode, type MouseEvent } from 'react';
import './liquid-glass-button.css';

interface Props {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}

export function LiquidGlassButton({
  active = false,
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
}: Props) {
  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      '--glint-x',
      `${e.clientX - rect.left}px`,
    );
    e.currentTarget.style.setProperty('--glint-y', `${e.clientY - rect.top}px`);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      className={`liquid-glass-btn ${active ? 'active' : ''} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <span className="glass-specular-glint" aria-hidden="true" />
      <span className="glass-content-wrap">{children}</span>
    </button>
  );
}
