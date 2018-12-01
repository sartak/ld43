/* @flow */
import Phaser from 'phaser';
import heroSprite from './assets/hero.png';
import sidekickSprite from './assets/sidekick.png';

import enemySpriteA from './assets/enemy-a.png';

import skyImage from './assets/sky.png';
import skyImage2 from './assets/sky-2.png';
import groundImage from './assets/ground.png';
import wallImage from './assets/wall.png';
import hpbarImage from './assets/hpbar.png';

import level1 from './assets/level-1.json';

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
  level: level1,
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
  game.load.image('hpbar', hpbarImage);
}

function createHero(x, y) {
  const { game, matter } = state;

  const hero = matter.add.sprite(0, 0, 'hero', null);

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;
  const { width: w, height: h } = hero;

  const sensors = hero.sensors = {
    t: Bodies.rectangle(0, -h * 0.5, w-8, 2, { isSensor: true }),
    b: Bodies.rectangle(0, h * 0.5 + 2, w-8, 2, { isSensor: true }),
    l: Bodies.rectangle(-w * 0.5, 0, 2, h-8, { isSensor: true }),
    r: Bodies.rectangle(w * 0.5, 0, 2, h-8, { isSensor: true }),
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

  updateCachedVelocityFor(hero);
  createHpBar(hero, 200);

  return hero;
}

function createSidekick(x, y, isInitial) {
  const { game } = state;

  const sidekick = game.matter.add.sprite(x, y, 'sidekick', null, { shape: physicsShapes.sidekick });

  if (isInitial) {
    updateCachedVelocityFor(sidekick);
    createHpBar(sidekick, 300);
  }

  sidekick.name = 'sidekick';

  return sidekick;
}

function replaceSidekick(existing) {
  const replacement = createSidekick(existing.x, existing.y, false);

  replacement.hpBar = existing.hpBar;
  replacement.previousHP = existing.previousHP;
  replacement.currentHP = existing.currentHP;
  replacement.maxHP = existing.maxHP;
  replacement.cachedVelocity = existing.cachedVelocity;

  existing.destroy();

  return replacement;
}

function createHpBar(owner, maxHP) {
  const { game } = state;
  const { x, y } = owner;

  const border = game.add.sprite(x, y, 'hpbar');
  const fill = game.add.sprite(x, y, 'hpbar');
  const hpBar = {
    fill,
    border,
  };

  fill.setCrop(1, 1, fill.width - 2, fill.height - 2);
  fill.tint = greenToRedFade(1);

  border.tint = 0;

  owner.hpBar = hpBar;
  owner.currentHP = owner.previousHP = owner.maxHP = maxHP;

  return hpBar;
}

function createEnemy({ type, x, y, hp }) {
  const { game } = state;
  const enemyId = `enemy-${type}`;

  const enemy = game.matter.add.sprite(x, y, enemyId, null, { shape: physicsShapes[enemyId] });

  updateCachedVelocityFor(enemy);
  createHpBar(enemy, hp);

  return enemy;
}

function greenToRedFade(fraction) {
  fraction = Math.min(Math.max(0, fraction), 1) * 510;
  const blue = 0;
  let red;
  let green;
  if (fraction < 255) {
    red = 255;
    green = Math.sqrt(fraction) * 16;
    green = Math.round(green);
  } else {
    green = 255;
    fraction -= 255;
    red = 255 - (fraction * fraction / 255);
    red = Math.round(red);
  }

  return blue + 256 * green + 256*256*red;
}

function updateHpBarFor(owner) {
  const { game } = state;
  const { previousHP, currentHP, maxHP, hpBar } = owner;
  const { fill, border } = hpBar;
  // respect rotation? offset?
  border.x = owner.x;
  border.y = owner.y - owner.height * 0.75;
  fill.x = owner.x;
  fill.y = owner.y - owner.height * 0.75;

  // tween em if you got em
  if (previousHP !== currentHP) {
    if (fill.tween) {
      fill.tween.stop();
    }

    fill.tween = game.tweens.addCounter({
      from: fill.tween ? fill.tween.getValue() : previousHP,
      to: currentHP,
      duration: 500,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        const percentHP = fill.tween.getValue() / maxHP;
        fill.setCrop(1, 1, fill.width * percentHP - 2, fill.height - 2);
        fill.tint = greenToRedFade(percentHP);
      },
    });

    owner.previousHP = currentHP;
  }
}

function updateEnemy(enemy) {
  updateCachedVelocityFor(enemy);
  updateHpBarFor(enemy);

  if (enemy.currentHP <= 0) {
    removeEnemy(enemy);
  }
}

function updateCachedVelocityFor(character) {
  character.cachedVelocity = {
    x: character.body.velocity.x,
    y: character.body.velocity.y,
  };
}

function removeHpBarFor(owner) {
  const { hpBar } = owner;
  const { fill, border } = hpBar;
  fill.destroy();
  border.destroy();
}

function removeEnemy(enemy) {
  const { matter } = state;
  removeHpBarFor(enemy);
  state.enemies = state.enemies.filter(e => e !== enemy);
  matter.world.remove(enemy);
  enemy.destroy();
}

function createGround() {
  const { game, matter } = state;

  const { vertices } = physicsShapes.ground.fixtures[0];
  vertices[0][0].y = 100;
  vertices[0][1].y = 100;
  vertices[0][2].y = 0;
  vertices[0][3].y = 0;

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;

  const ground = matter.add.sprite(config.width / 2, config.height + 30, 'ground', null, { shape: physicsShapes.ground });
  ground.name = 'ground';

  return ground;
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

  const ceiling = matter.add.rectangle(config.width / 2, -50, config.width, 100, {
    isStatic: true,
    friction: 0,
    frictionStatic: 0,
  });

  return ceiling;
}

function create() {
  const { game, level } = state;
  const { matter } = game;

  state.matter = matter;

  state.sky = game.add.sprite(400, 300, level.background);

  const ground = state.ground = createGround();

  const ceiling = state.ceiling = createCeiling();

  const leftWall = state.leftWall = createWall(false, -40, 400);
  const rightWall = state.rightWall = createWall(true, level.width + 40, 400);

  // +20 for a little bit of dynamism on load
  const characterY = 20 + config.height - (config.characterHeight/2);
  const hero = state.hero = createHero(150, characterY);

  const sidekick = state.sidekick = createSidekick(100, characterY, true);

  // target, round pixels for jitter, lerpx, lerpy, offsetx, offsety
  game.cameras.main.startFollow(hero, false, 0.05, 0, 0, 270);

  game.cameras.main.setBounds(0, 0, level.width, 1080 * 2);

  // limit the amount of useless scrolling
  //     game.camera.deadzone = new Phaser.Rectangle(100, 100, 600, 400);

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
  const { hero, sidekick, zDown, matter, enemies, game } = state;
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

    const isEnemy = enemies.find(enemy => (enemy === a || enemy === b));
    const isPlayer = [hero, sidekick].find(p => (p === a || p === b));
    if (isEnemy && isPlayer) {
      const { Vector } = Phaser.Physics.Matter.Matter;
      const aMomentum = Vector.mult(a.cachedVelocity, a.body.mass);
      const bMomentum = Vector.mult(b.cachedVelocity, b.body.mass);
      const relativeMomentum = Vector.sub(aMomentum, bMomentum);
      const impact = Vector.magnitude(relativeMomentum);
      a.currentHP = Math.max(0, a.currentHP - impact / 5);
      b.currentHP = Math.max(0, b.currentHP - impact / 5);

      game.cameras.main.shake(impact/2, 0.00005*impact);
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
  const { enemies, game, level } = state;

  updateHero();
  updateSidekick();
  enemies.forEach(enemy => updateEnemy(enemy));

  if (enemies.length === 0) {
    delete state.x_lock;
    delete state.camera_lock;
  }

  updateCameraAndBounds();

  if (level.waves.length && game.cameras.main.scrollX > level.waves[0].x_spawn) {
    spawnWave(level.waves.shift());
  }
}

function spawnWave({ x_lock, enemies }) {
  state.x_lock = x_lock;
  for (const spec of enemies) {
    const enemy = createEnemy(spec);
    state.enemies.push(enemy);
  }
}

function updateCameraAndBounds() {
  const { level, x_lock, camera_lock, game, ground, ceiling, leftWall, rightWall } = state;

  let leftBound = Math.min(game.cameras.main.scrollX, level.width - config.width);

  if (x_lock && (leftBound > x_lock || camera_lock)) {
    leftBound = game.cameras.main.scrollX = x_lock;
    state.camera_lock = true;
    game.cameras.main.setBounds(leftBound, 0, 0, 0);
  } else {
    game.cameras.main.setBounds(leftBound, 0, level.width - leftBound, 0);
  }

  const rightBound = leftBound + config.width;

  Phaser.Physics.Matter.Matter.Body.setPosition(ceiling, {
    x: 400 + leftBound,
    y: ceiling.position.y,
  });

  ground.x = config.width / 2 + leftBound;

  leftWall.x = Math.max(-40, leftBound - 50);
  rightWall.x = Math.min(level.width + 40, rightBound + 50);

  // parallax should depend on sky width and level width
  // worldView.x = 0 means we show sky's left border
  // worldView.x = lvl.width means we show sky's right border
  state.sky.x = state.sky.width / 2 + leftBound * (state.sky.width / (level.width - config.width));
}

function updateSidekick() {
  const { game, hero, keys } = state;
  let { sidekick } = state;

  const dx = hero.x - sidekick.x;
  const dy = hero.y - sidekick.y;

  updateCachedVelocityFor(sidekick);
  updateHpBarFor(sidekick);

  const zDownStart = Phaser.Input.Keyboard.JustDown(keys.Z);
  state.zDown = keys.Z.isDown;

  switch (state.throwState) {
    default:
      break;

    case 'calm':
      if (keys.Z.isDown) {
        state.throwState = 'pull';
      } else if (sidekick.currentHP / sidekick.maxHP < 0.25) {
        // crawl away
        sidekick.applyForce({
          x: dx < 0 ? 0.002 : -0.002,
          y: 0,
        });
        sidekick.setAngularVelocity(state.wigglePhase < 5 ? 0.01 : -0.01);
        state.wigglePhase = (state.wigglePhase + 1) % 10;
      }
      break;
    case 'pull':
      if (keys.Z.isDown) {
        const tractable = dx*dx + dy*dy < 200*200;
        if (tractable) {
          // tractor beam towards hero
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
      sidekick.x = hero.x + (state.facingRight ? 10 : -10);
      sidekick.y = hero.y + 10;

      if (zDownStart) {
        state.throwState = 'throw';

        // recreate a new sidekick because re-adding to
        // physics seems unsupported
        sidekick = state.sidekick = replaceSidekick(sidekick);

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
      }
      break;
    }
    case 'throw':
      break;
  }
}

function updateHero() {
  const { game, matter, hero, cursors, keys } = state;

  updateCachedVelocityFor(hero);
  updateHpBarFor(hero);

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

  if (velocity.x > 5) hero.setVelocityX(5);
  else if (velocity.x < -5) hero.setVelocityX(-5);
}

