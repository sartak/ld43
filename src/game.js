/* @flow */
import Phaser from 'phaser';
import heroSprite from './assets/hero.png';
import sidekickSprite from './assets/sidekick.png';

import enemySpriteA from './assets/enemy-a.png';

import skyImage from './assets/sky.png';
import skyImage2 from './assets/sky-2.png';
import groundImage from './assets/ground.png';
import wallImage from './assets/wall.png';

import physicsShapes from './assets/physics.json';

// SACRIFICES MUST BE MADE
//
const DEBUG = (!process.env.NODE_ENV || process.env.NODE_ENV === 'development');

const config = {
  debug: DEBUG,
  type: Phaser.AUTO,
  parent: 'engine',
  levelWidth: 800 * 3,
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
  keys: {},
  throwState: 'calm',
  wigglePhase: 0,
  facingRight: true,
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
  game.load.image('sidekick', sidekickSprite);
  game.load.image('enemy-a', enemySpriteA);
  game.load.image('sky', skyImage);
  game.load.image('sky-2', skyImage2);
  game.load.image('ground', groundImage);
  game.load.image('wall', wallImage);
}

function createHero(x, y) {
  const { game, matter } = state;

  const hero = matter.add.sprite(0, 0, 'hero', null);

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;
  const { width: w, height: h } = hero;

  const sensors = hero.sensors = {
    t: Bodies.rectangle(0, -h * 0.5, w, 2, { isSensor: true }),
    b: Bodies.rectangle(0, h * 0.5 + 2, w, 2, { isSensor: true }),
    l: Bodies.rectangle(-w * 0.5, 0, 2, h, { isSensor: true }),
    r: Bodies.rectangle(w * 0.5, 0, 2, h, { isSensor: true }),
  };

  const compoundBody = Body.create({
    parts: [hero.body, sensors.t, sensors.b, sensors.l, sensors.r],
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

function createSidekick(x, y) {
  const { game } = state;

  const sidekick = game.matter.add.sprite(x, y, 'sidekick', null, { shape: physicsShapes.sidekick });

  sidekick.name = 'sidekick';

  return sidekick;
}

function createEnemy(type, x, y) {
  const { game } = state;
  const enemyId = `enemy-${type}`;

  const enemy = game.matter.add.sprite(x, y, enemyId, null, { shape: physicsShapes[enemyId] });

  return enemy;
}

function createWall(isRight, x, y) {
  const { game, matter } = state;

  const { vertices } = physicsShapes.wall.fixtures[0];
  if (isRight) {
    vertices[0][0].x = 100;
    vertices[0][1].x = 100;
    vertices[0][2].x = 0;
    vertices[0][3].x = 0;
  } else {
    vertices[0][0].x = 10;
    vertices[0][1].x = 10;
    vertices[0][2].x = -90;
    vertices[0][3].x = -90;
  }

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;

  const wall = matter.add.sprite(x, y, 'wall', null, { shape: physicsShapes.wall });
  if (isRight) {
    wall.setFlipX(true);
  }

  return wall;
}

function createCeiling() {
  const { matter } = state;

  const ceiling = matter.add.rectangle(400, -50, 800, 100, {
    isStatic: true,
    friction: 0,
    frictionStatic: 0,
  });

  return ceiling;
}

function create() {
  const { game } = state;
  const { matter } = game;

  state.matter = matter;

  state.sky = game.add.sprite(400, 300, 'sky');

  const ground = state.ground = matter.add.sprite(config.levelWidth / 2, config.height - (config.groundHeight/2), 'ground', null, { shape: physicsShapes.ground }).setScale(3);
  ground.name = 'ground';

  const ceiling = state.ceiling = createCeiling();

  const leftWall = state.leftWall = createWall(false, -40, 400);
  const rightWall = state.rightWall = createWall(true, config.levelWidth + 40, 400);

  // +20 for a little bit of dynamism on load
  const characterY = 20 + config.height - (config.characterHeight/2);
  const hero = state.hero = createHero(150, characterY);

  const sidekick = state.sidekick = createSidekick(100, characterY);

  // target, round pixels for jitter, lerpx, lerpy, offsetx, offsety
  game.cameras.main.startFollow(hero, false, 0.05, 0, 0, 270);

  game.cameras.main.setBounds(0, 0, config.levelWidth, 1080 * 2);

  // limit the amount of useless scrolling
  //     game.camera.deadzone = new Phaser.Rectangle(100, 100, 600, 400);

  for (let i = 0; i < 4; ++i) {
    const enemy = createEnemy('a', Phaser.Math.Between(300, 400) + 100 * i, characterY);
    state.enemies.push(enemy);
  }

  state.cursors = game.input.keyboard.createCursorKeys();

  if (config.debug) {
    game.input.keyboard.on('keydown_Q', () => {
      game.scene.stop();
      const engine = document.querySelector('#engine canvas');
      if (engine) {
        engine.remove();
      }
    });
  }

  ['Z', 'X', 'C'].forEach((code) => {
    state.keys[code] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code]);
  });

  game.input.keyboard.on('keydown_Q', () => {
    game.scene.stop();
    const engine = document.querySelector('#engine canvas');
    if (engine) {
      engine.remove();
    }
  });

  game.matter.world.on('collisionstart', (event) => {
    collisionStart(event);
  });

  game.matter.world.on('collisionend', (event) => {
    collisionEnd(event);
  });
}

function collisionStart(event) {
  const { hero, sidekick, zDown, matter } = state;
  event.pairs.forEach(({ bodyA, bodyB, separation }) => {
    const a = bodyA.gameObject;
    const b = bodyB.gameObject;

    if (!a || !b) {
      return;
    }

    if (bodyA.id === hero.sensors.l.id || bodyB.id === hero.sensors.l.id) {
      hero.touching.left = true;
      hero.x += separation + 2;
    }

    if (bodyA.id === hero.sensors.r.id || bodyB.id === hero.sensors.r.id) {
      hero.touching.right = true;
      hero.x -= separation + 2;
    }

    if ((bodyA.id === hero.sensors.b.id || bodyB.id === hero.sensors.b.id)) {
      hero.touching.bottom = true;
    }

    const isSensor = Object.keys(hero.sensors).map(key => hero.sensors[key]).find(sensor => (sensor.id === bodyA.id || sensor.id === bodyB.id));
    if (isSensor && state.throwState === 'pull' && zDown && (a.name === 'sidekick' || b.name === 'sidekick')) {
      state.throwState = 'hold';

      if (state.sidekickAngleRestore) {
        state.sidekickAngleRestore.stop();
        delete state.sidekickAngleRestore;
      }

      sidekick.angle = 0;
      matter.world.remove(sidekick);
    }
  });
}

function collisionEnd(event) {
  const { hero } = state;

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
}

// parameter t is milliseconds since load
function update() {
  const { game, ceiling, leftWall, rightWall } = state;

  updateHero();

  const screenWidth = 800;

  const leftBound = Math.min(game.cameras.main.scrollX, config.levelWidth - screenWidth);
  const rightBound = leftBound + screenWidth;

  game.cameras.main.setBounds(leftBound, 0, config.levelWidth - leftBound, 1080 * 2);

  Phaser.Physics.Matter.Matter.Body.setPosition(ceiling, {
    x: 400 + leftBound,
    y: ceiling.position.y 
  });

  leftWall.x = Math.max(-40, leftBound - 50);
  rightWall.x = Math.min(config.levelWidth + 40, rightBound + 50);

  // parallax should depend on sky width and level width
  // worldView.x = 0 means we show sky's left border
  // worldView.x = lvl.width means we show sky's right border
  state.sky.x = state.sky.width / 2 + leftBound * (state.sky.width / (config.levelWidth - screenWidth));
}

function updateHero() {
  const { game, matter, hero, cursors, keys } = state;
  let { sidekick } = state;

  const { velocity } = hero.body;
  if (cursors.left.isDown) {
    state.facingRight = false;
    hero.setFlipX(true);
    hero.applyForce({
      x: state.throwState === 'hold' ? -0.025 : -0.1,
      y: 0,
    });
  }

  if (cursors.right.isDown) {
    state.facingRight = true;
    hero.setFlipX(false);
    hero.applyForce({
      x: state.throwState === 'hold' ? 0.025 : 0.1,
      y: 0,
    });
  }
  if (hero.touching.bottom && cursors.up.isDown) {
    hero.applyForce({
      x: 0,
      y: -0.25,
    });
  }

  const zDownStart = Phaser.Input.Keyboard.JustDown(keys.Z);
  state.zDown = keys.Z.isDown;

  switch (state.throwState) {
    default:
      break;

    case 'calm':
      if (keys.Z.isDown) {
        state.throwState = 'pull';
      }
      break;
    case 'pull':
      if (keys.Z.isDown) {
        const dx = hero.x - sidekick.x;
        const dy = hero.y - sidekick.y;
        const tractable = dx*dx + dy*dy < 200*200;
        if (tractable) {
          // tractor beam towards player
          // apply a force vector based on the angle
          sidekick.applyForce({
            x: dx < 0 ? -0.03 : 0.03,
            y: dy < 0 ? -0.03 : 0.03,
          });

          // tween toward zero
          //
          if (!state.sidekickAngleRestore) {
            state.sidekickAngleRestore = game.tweens.add({
              targets: sidekick,
              angle: 0,
              duration: 200,
            });
          }
        } else {
          // wiggle but don't move
          sidekick.setAngularVelocity(state.wigglePhase < 5 ? 0.02 : -0.02);
          sidekick.applyForce({
            x: state.wigglePhase < 5 ? 0.01 : -0.01,
            y: 0,
          });

          state.wigglePhase = (state.wigglePhase + 1) % 10;
        }
      } else {
        state.throwState = 'calm';

        if (state.sidekickAngleRestore) {
          state.sidekickAngleRestore.stop();
          delete state.sidekickAngleRestore;
        }
      }
      break;
    case 'hold': {
      let x = hero.x + (state.facingRight ? 10 : -10);
      const y = hero.y + 10;
      sidekick.x = x;
      sidekick.y = y;

      if (zDownStart) {
        state.throwState = 'throw';

        // recreate a new sidekick because re-adding to
        // physics seems unsupported
        sidekick.destroy();

        x += (state.facingRight ? 20 : -20);
        sidekick = state.sidekick = createSidekick(x, y);

        sidekick.applyForce({
          x: state.facingRight ? 0.75 : -0.75,
          y: 0,
        });

        game.time.addEvent({
          delay: 200,
          callback: () => {
            state.throwState = 'calm';
          },
        });

        // ignore collisions with player for some amount of
        // time?
        //
        // throw
      }
      break;
    }
    case 'throw':
      break;
  }

  if (velocity.x > 5) hero.setVelocityX(5);
  else if (velocity.x < -5) hero.setVelocityX(-5);
}

