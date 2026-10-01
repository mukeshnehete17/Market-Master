import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import './liquid-metal-button.css';

type Props = {
  label: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
};

export function LiquidMetalButton({ label, type = 'button', onClick }: Props) {
  const surface = useRef<HTMLSpanElement>(null);
  const shader = useRef<ShaderMount | null>(null);
  const nextId = useRef(0);
  const [ripples, setRipples] = useState<
    { x: number; y: number; id: number }[]
  >([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const element = surface.current;
    if (!element || reduceMotion) return;
    try {
      shader.current = new ShaderMount(
        element,
        liquidMetalFragmentShader,
        {
          u_repetition: 4,
          u_softness: 0.5,
          u_shiftRed: 0.3,
          u_shiftBlue: 0.3,
          u_distortion: 0,
          u_contour: 0,
          u_angle: 45,
          u_scale: 8,
          u_shape: 1,
          u_offsetX: 0.1,
          u_offsetY: -0.1,
          u_originX: 0.5,
          u_originY: 0.5,
          u_worldWidth: 0,
          u_worldHeight: 0,
          u_fit: 1,
          u_rotation: 0,
          u_colorBack: [0.67, 0.67, 0.68, 1],
          u_colorTint: [1, 1, 1, 1],
          u_isImage: false,
        },
        undefined,
        0.6,
      );
    } catch {
      // Keep the CSS metal finish when WebGL is unavailable.
      element.replaceChildren();
    }
    return () => {
      shader.current?.dispose();
      shader.current = null;
    };
  }, [reduceMotion]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!reduceMotion) {
      const rect = event.currentTarget.getBoundingClientRect();
      const id = nextId.current++;
      const x = event.detail ? event.clientX - rect.left : rect.width / 2;
      const y = event.detail ? event.clientY - rect.top : rect.height / 2;
      setRipples((current) => [...current, { x, y, id }]);
    }
    onClick?.();
  }

  return (
    <button
      type={type}
      className="liquid-metal-button"
      onClick={handleClick}
      onPointerEnter={() => shader.current?.setSpeed(1)}
      onPointerLeave={() => shader.current?.setSpeed(0.6)}
      onPointerDown={() => shader.current?.setSpeed(2.4)}
      onPointerUp={() => shader.current?.setSpeed(1)}
      onPointerCancel={() => shader.current?.setSpeed(0.6)}
    >
      <span ref={surface} className="metal-surface" aria-hidden="true" />
      <span className="metal-label">{label}</span>
      {ripples.map(({ x, y, id }) => (
        <span
          key={id}
          className="metal-ripple"
          aria-hidden="true"
          style={{ left: x, top: y }}
          onAnimationEnd={() =>
            setRipples((current) =>
              current.filter((ripple) => ripple.id !== id),
            )
          }
        />
      ))}
    </button>
  );
}
