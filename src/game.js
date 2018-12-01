/* @flow */
import Phaser from 'phaser';
import heroSprite from './assets/hero.png';

import enemySpriteA from './assets/enemy-a.png';

import skyImage from './assets/sky.png';
import groundImage from './assets/ground.png';

import physicsShapes from './assets/physics.json';

// SACRIFICES MUST BE MADE
//
const DEBUG = (!process.env.NODE_ENV || process.env.NODE_ENV === 'development');

const config = {
  debug: DEBUG,
  type: Phaser.AUTO,
  parent: 'engine',
  width: 800,
  height: 600,
  characterHeight: 100,
  groundHeight: 20,
  physics: {
    default: 'matter',
    matter: {
      debug: DEBUG,
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

const state : any = {
  physicsShapes,
  enemies: [],
};

if (DEBUG) {
  window.state = state;
}

export default function startGame() {
  return new Phaser.Game(config);
}

function preload() {
  const game = state.game = this;
  game.load.image('hero', heroSprite);
  game.load.image('enemy-a', enemySpriteA);
  game.load.image('sky', skyImage);
  game.load.image('ground', groundImage);
}

function createHero(x, y) {
  const { game } = state;

  const hero = game.matter.add.sprite(0, 0, 'hero', null);

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;
  const { width: w, height: h } = hero;

  const sensors = hero.sensors = {
    b: Bodies.rectangle(0, h * 0.5 + 2, w * 0.5, 2, { isSensor: true }),
    l: Bodies.rectangle(-w * 0.5, 0, 2, h * 0.5, { isSensor: true }),
    r: Bodies.rectangle(w * 0.5, 0, 2, h * 0.5, { isSensor: true }),
  };

  const compoundBody = Body.create({
    parts: [hero.body, sensors.b, sensors.l, sensors.r],
    frictionStatic: 0,
    frictionAir: 0.02,
    friction: 0.1,
  });

  hero.setExistingBody(compoundBody);

  hero.setPosition(x, y);

  // can't rotate
  hero.setFixedRotation();

  hero.touching = {
    left: false,
    right: false,
    ground: false,
  };

  return hero;
}

function createEnemy(type, x, y) {
  const { game } = state;
  const enemyId = `enemy-${type}`;

  const enemy = game.matter.add.sprite(x, y, enemyId, null, { shape: physicsShapes[enemyId] });

  return enemy;
}

function create() {
  const { game } = state;
  const { matter } = game;

  matter.world.setBounds(0, 0, config.width, config.height);

  state.sky = game.add.sprite(400, 300, 'sky');

  const ground = state.ground = matter.add.sprite(400, config.height - (config.groundHeight/2), 'ground', null, { shape: physicsShapes.ground });
  ground.name = 'ground';

  // +20 for a little bit of dynamism on load
  const characterY = 20 + config.height - (config.characterHeight/2);
  const hero = state.hero = createHero(100, characterY);

  // target, round pixels for jitter, lerpx, lerpy, offsetx, offsety
  game.cameras.main.startFollow(hero, false, 0.05, 0, 0, 270);

  for (let i = 0; i < 4; ++i) {
    const enemy = createEnemy('a', Phaser.Math.Between(100, 200) + 100 * i, characterY);
    state.enemies.push(enemy);
  }

  state.cursors = game.input.keyboard.createCursorKeys();

  if (config.debug) {
    game.input.keyboard.on('keydown_X', () => {
      game.scene.stop();
      const engine = document.querySelector('#engine canvas');
      if (engine) {
        engine.remove();
      }
    });
  }

  game.matter.world.on('collisionstart', (event) => {
    event.pairs.forEach(({ bodyA, bodyB, separation }) => {
      const a = bodyA.gameObject;
      const b = bodyB.gameObject;

      if (bodyA.id === hero.sensors.l.id || bodyB.id === hero.sensors.l.id) {
        hero.touching.left = true;
        hero.x += separation + 2;
      }

      if (bodyA.id === hero.sensors.r.id || bodyB.id === hero.sensors.r.id) {
        hero.touching.right = true;
        hero.x -= separation + 2;
      }

      if (!a || !b) {
        return;
      }

      if ((bodyA.id === hero.sensors.b.id || bodyB.id === hero.sensors.b.id)) {
        hero.touching.bottom = true;
      }
    });
  });

  game.matter.world.on('collisionend', (event) => {
    event.pairs.forEach(({ bodyA, bodyB, separation }) => {
      const a = bodyA.gameObject;
      const b = bodyB.gameObject;

      if (bodyA.id === hero.sensors.l.id || bodyB.id === hero.sensors.l.id) {
        hero.touching.left = false;
      }

      if (bodyA.id === hero.sensors.r.id || bodyB.id === hero.sensors.r.id) {
        hero.touching.right = false;
      }

      if (!a || !b) {
        return;
      }

      if ((bodyA.id === hero.sensors.b.id || bodyB.id === hero.sensors.b.id)) {
        hero.touching.bottom = false;
      }
    });
  });
}

// parameter t is milliseconds since load
function update() {
  const { game } = state;

  updateHero();

  // parallax should depend on sky width and level width
  // worldView.x = 0 means we show sky's left border
  // worldView.x = lvl.width means we show sky's right border
  const levelWidth = 800;
  const parallax = levelWidth / state.sky.width;
  state.sky.x = levelWidth / 2 + game.cameras.main.worldView.x * parallax;
}

function updateHero() {
  const { hero, cursors } = state;

  const { velocity } = hero.body;
  if (cursors.left.isDown) {
    hero.applyForce({
      x: -0.1,
      y: 0,
    });
  }

  if (cursors.right.isDown) {
    hero.applyForce({
      x: 0.1,
      y: 0,
    });
  }

  if (hero.touching.bottom && cursors.up.isDown) {
    hero.applyForce({
      x: 0,
      y: -0.25,
    });
  }

  if (velocity.x > 5) hero.setVelocityX(5);
  else if (velocity.x < -5) hero.setVelocityX(-5);
}

