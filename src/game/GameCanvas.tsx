import { useEffect, useRef } from 'react';
import { Application, Assets, Sprite, TilingSprite } from 'pixi.js';

const WATER_TEXTURE = '/assets/png/default/tiles/tile_73.png';
const PLAYER_SHIP_TEXTURE = '/assets/png/default/ships/ship_2.png';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container: HTMLDivElement = containerRef.current;

    const app = new Application();
    let initialized = false;
    let cancelled = false;

    async function setup() {
      await app.init({
        resizeTo: container,
        background: '#2b7fc4',
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      initialized = true;

      // React Strict Mode mounts, unmounts and mounts again in dev.
      // If cleanup already ran while we were awaiting, throw this app away.
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      container.appendChild(app.canvas);

      const [waterTexture, shipTexture] = await Promise.all([
        Assets.load(WATER_TEXTURE),
        Assets.load(PLAYER_SHIP_TEXTURE),
      ]);
      if (cancelled) return;

      const water = new TilingSprite({
        texture: waterTexture,
        width: app.screen.width,
        height: app.screen.height,
      });
      app.stage.addChild(water);

      const ship = new Sprite(shipTexture);
      ship.anchor.set(0.5);
      ship.position.set(app.screen.width / 2, app.screen.height / 2);
      app.stage.addChild(ship);

      const ROTATION_SPEED = 1; // radians per second

      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000; // seconds since last frame
        ship.rotation += ROTATION_SPEED * dt;
        water.width = app.screen.width;
        water.height = app.screen.height;
      });
    }

    setup().catch((error) => console.error('Failed to start game', error));

    return () => {
      cancelled = true;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={containerRef} className="game-container" />;
}