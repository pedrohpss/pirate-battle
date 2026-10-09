import { useEffect, useRef } from 'react';
import { Application, Assets, Sprite, TilingSprite } from 'pixi.js';

// Paths are relative to the /public folder (Vite serves it at the site root).
const WATER_TEXTURE = '/assets/png/default/tiles/tile_73.png';
const PLAYER_SHIP_TEXTURE = '/assets/png/default/ships/ship_2.png';

// How fast the ship spins, in radians per second (about 57 degrees per second).
const ROTATION_SPEED = 1;

/**
 * React component that hosts the PixiJS canvas.
 * React only provides the <div>; everything inside it is drawn by PixiJS.
 */
export function GameCanvas() {
  // Reference to the <div> where the Pixi canvas will be inserted.
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container: HTMLDivElement = containerRef.current;

    // The Pixi "engine": owns the canvas, the renderer and the game loop.
    const app = new Application();

    // Flags that make setup/cleanup safe under React Strict Mode,
    // which mounts, unmounts and remounts components in development.
    let initialized = false; // true once app.init() has finished
    let cancelled = false; // true once React has run the cleanup

    async function setup() {
      // Create the canvas and renderer.
      await app.init({
        resizeTo: container, // canvas follows the size of the <div>
        background: '#2b7fc4',
        antialias: true, // smooth edges
        resolution: window.devicePixelRatio, // sharp on high-density screens
        autoDensity: true, // keeps CSS size correct when resolution > 1
      });
      initialized = true;

      // If React already unmounted us while we were waiting, discard this app.
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      container.appendChild(app.canvas);

      // Load both images in parallel and wait until they are ready.
      const [waterTexture, shipTexture] = await Promise.all([
        Assets.load(WATER_TEXTURE),
        Assets.load(PLAYER_SHIP_TEXTURE),
      ]);
      if (cancelled) return;

      // Water: a 64x64 tile repeated to fill the whole screen.
      const water = new TilingSprite({
        texture: waterTexture,
        width: app.screen.width,
        height: app.screen.height,
      });
      app.stage.addChild(water);

      // Player ship, centered on screen.
      const ship = new Sprite(shipTexture);
      ship.anchor.set(0.5); // rotate around the image center, not the corner
      ship.position.set(app.screen.width / 2, app.screen.height / 2);
      app.stage.addChild(ship); // added after the water, so drawn on top

      // Game loop: this function runs once per frame.
      app.ticker.add((ticker) => {
        // Seconds since the previous frame. Multiplying speeds by dt makes
        // movement depend on real time, not on the monitor refresh rate.
        const dt = ticker.deltaMS / 1000;
        ship.rotation += ROTATION_SPEED * dt;

        // Keep the water covering the screen if the window is resized.
        water.width = app.screen.width;
        water.height = app.screen.height;
      });
    }

    setup().catch((error) => console.error('Failed to start game', error));

    // Cleanup: runs when the component leaves the screen.
    // Destroys the canvas, the ticker and every sprite to avoid memory leaks.
    return () => {
      cancelled = true;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []); // empty array: run setup only once, when the component mounts

  return <div ref={containerRef} className="game-container" />;
}