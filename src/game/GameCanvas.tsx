import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { DEFAULT_GAME_CONFIG } from './config';
import { KeyboardInput } from './input/KeyboardInput';
import { GameSimulation } from './simulation/GameSimulation';
import { GameRenderer } from './render/GameRenderer';
import { loadGameTextures } from './render/assets';

/**
 * Upper limit for a single frame step, in seconds.
 * Prevents huge jumps when the browser stalls or the tab was hidden.
 */
const MAX_FRAME_TIME = 0.1;

/**
 * React component that hosts the game.
 * React only provides the <div>; the game loop runs entirely in PixiJS,
 * so React does not re-render on every frame.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container: HTMLDivElement = containerRef.current;

    const app = new Application();
    const keyboard = new KeyboardInput();

    // Flags that make setup/cleanup safe under React Strict Mode.
    let initialized = false;
    let cancelled = false;

    async function setup() {
      await app.init({
        resizeTo: container,
        background: '#0e3550', // color around the arena when proportions differ
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      initialized = true;

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      container.appendChild(app.canvas);

      const textures = await loadGameTextures();
      if (cancelled) return;

      const config = DEFAULT_GAME_CONFIG;
      const simulation = new GameSimulation(config);
      const renderer = new GameRenderer(app, textures, config.arena);
      keyboard.attach();

      // Game loop: input -> rules -> drawing, once per frame.
      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, MAX_FRAME_TIME);
        simulation.update(dt, keyboard.getState());
        renderer.render(simulation);
      });
    }

    setup().catch((error) => console.error('Failed to start game', error));

    // Cleanup: release listeners, ticker, sprites and canvas.
    return () => {
      cancelled = true;
      keyboard.detach();
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={containerRef} className="game-container" />;
}