/* @flow */
import Phaser from 'phaser';
import heroSprite from './assets/hero.png';
import sidekickSprite from './assets/sidekick.png';

import enemySpriteA from './assets/enemy-a.png';
import enemySpriteX from './assets/enemy-x.png';

import skyImage2 from './assets/sky-2.png';
import groundImage from './assets/ground.png';
import wallImage from './assets/wall.png';
import hpbarImage from './assets/hpbar.png';

import level1Background from './assets/level-1.png';
import level1Map from './assets/level-1.map';

import blockA from './assets/block-a.png';

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
  level: { name: 'level-1' },
  physicsShapes,
  enemies: [],
  waveEnemies: [],
  keys: {},
  throwState: 'calm',
  wigglePhase: 0,
  facingRight: true,
};

const enemyDefaults = {
  a: { hp: 100 },
  x: { hp: 200 },
};

const whiteColor = {
  r: 255,
  g: 255,
  b: 255,
};
const redColor = {
  r: 255,
  g: 0,
  b: 0,
};
const greenColor = {
  r: 0,
  g: 255,
  b: 0,
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
  game.load.image('enemy-x', enemySpriteX);
  game.load.image('level-1', level1Background);
  game.load.image('sky-2', skyImage2);
  game.load.image('ground', groundImage);
  game.load.image('wall', wallImage);
  game.load.image('hpbar', hpbarImage);
  game.load.image('block-a', blockA);

  game.load.text('level-1', level1Map);
}

function createHero({ x, y }, isInitial) {
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

  if (isInitial) {
    updateCachedVelocityFor(hero);
    createHpBar(hero, 200);
  }

  return hero;
}

function createSidekick({ x, y }, isInitial) {
  const { game } = state;

  const sidekick = game.matter.add.sprite(x, y, 'sidekick', null, { shape: physicsShapes.sidekick });

  if (isInitial) {
    updateCachedVelocityFor(sidekick);
    createHpBar(sidekick, 300);
  }

  sidekick.xHold = 0;
  sidekick.yHold = 0;
  sidekick.name = 'sidekick';

  return sidekick;
}

function replaceSidekick(existing) {
  const replacement = createSidekick({
    x: existing.x,
    y: existing.y,
  }, false);

  replacement.hpBar = existing.hpBar;
  replacement.previousHP = existing.previousHP;
  replacement.currentHP = existing.currentHP;
  replacement.maxHP = existing.maxHP;
  replacement.cachedVelocity = existing.cachedVelocity;
  replacement.yHoldUp = existing.yHoldUp;
  delete replacement.yHoldTween;

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

function createEnemy({ type, x, y }) {
  const { game } = state;
  const enemyId = `enemy-${type}`;

  const enemy = game.matter.add.sprite(x, y, enemyId, null, { shape: physicsShapes[enemyId] });

  enemy.enemyType = type;

  updateCachedVelocityFor(enemy);
  createHpBar(enemy, enemyDefaults[type].hp);

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
  const { hero, waveEnemies, game, matter } = state;

  if (enemy.isDying) {
    return;
  }

  updateCachedVelocityFor(enemy);
  updateHpBarFor(enemy);

  if (enemy.currentHP <= 0) {
    matter.world.remove(enemy);
    enemy.isDying = true;

    if (enemy.enemyType === 'x') {
      removeEnemy(enemy, false);
      state.levelExit = {
        x: enemy.x,
        y: enemy.y,
        sprite: enemy,
      };
    } else {
      game.tweens.add({
        targets: enemy,
        alpha: 0,
        y: enemy.y - 100,
        angle: enemy.angle - 45,
        duration: 500,
        onComplete: () => {
          removeEnemy(enemy, true);
        },
      });
    }

    return;
  }

  const hasOnscreenEnemy = waveEnemies.find(e => e.x < game.cameras.main.scrollX + config.width + 100);

  if (waveEnemies.find(e => e === enemy)) {
    if (!hasOnscreenEnemy) {
      return;
    }

    if (enemy.enemyType !== 'x') {
      const dx = hero.x - enemy.x;
      if (dx < -10) {
        enemy.applyForce({
          x: -0.004,
          y: 0,
        });
        enemy.setAngularVelocity(0.0005);
      } else if (dx > 10) {
        enemy.applyForce({
          x: 0.004,
          y: 0,
        });
        enemy.setAngularVelocity(-0.0005);
      } else {
        // attack
      }
    }
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

function removeEnemy(enemy, removeVisuals) {
  const { matter } = state;

  if (removeVisuals) {
    removeHpBarFor(enemy);
  }

  state.enemies = state.enemies.filter(e => e !== enemy);
  state.waveEnemies = state.waveEnemies.filter(e => e !== enemy);

  if (removeVisuals) {
    enemy.destroy();
  }
}

function createGround() {
  const { game, matter } = state;

  const { vertices } = physicsShapes.ground.fixtures[0];
  vertices[0][0].y = 100;
  vertices[0][1].y = 100;
  vertices[0][2].y = 0;
  vertices[0][3].y = 0;

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;

  const ground = matter.add.sprite(config.width / 2, config.height + 50, 'ground', null, { shape: physicsShapes.ground });
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

function createMap() {
  const { matter, game, level } = state;

  const map = state.map = game.cache.text.get(level.name);

  const rows = map.split('\n');
  const cols = rows[0].split('').map(col => []);
  rows.forEach((row, r) => {
    row.split('').forEach((spec, c) => {
      cols[c][r] = spec;
    });
  });

  const waves = [];
  let waveEnemies = [];
  const blocks = [];

  cols.forEach((col, c) => {
    const x = c * 32;
    col.forEach((spec, r) => {
      const y = r * 32 - 8; // 8 because doesnt cleanly divide

      if (spec === '.') {
        return;
      }

      if (spec === '@') {
        state.initialHeroPosition = {
          x,
          y: y - 32,
        };
      } else if (spec === '$') {
        state.initialSidekickPosition = {
          x,
          y: y - 8,
        };
      } else if (spec === '#') {
        // exit
        // add last wave if needed
        if (waveEnemies.length) {
          waves.push({
            enemies: waveEnemies,
            x_lock: x - config.width,
            i: waves.length,
          });
          waveEnemies = [];
        }

        const enemy = createEnemy({
          type: 'x',
          x,
          y: y - 28,
        });
        state.enemies.push(enemy);
        waveEnemies.push(enemy);
        waves.push({
          enemies: waveEnemies,
          x_lock: x - config.width + 64,
          i: waves.length,
        });
      } else if (spec === '|') {
        waves.push({
          enemies: waveEnemies,
          x_lock: x - config.width,
          i: waves.length,
        });
        waveEnemies = [];
      } else if (spec.toUpperCase() === spec) {
        // uppercase is enemy
        const type = spec.toLowerCase();
        const enemy = createEnemy({
          type,
          x,
          y: y - 16,
        });
        state.enemies.push(enemy);
        waveEnemies.push(enemy);
      } else {
        // lowercase is block
        const type = `block-${spec}`;
        const block = matter.add.sprite(x+16, y+16, type, null, { shape: physicsShapes[type] });
        block.name = block;
        blocks.push(block);
      }
    });
  });

  level.width = cols.length * 32;
  level.waves = waves;
  level.blocks = blocks;
}

function create() {
  const { game, level } = state;
  const { matter } = game;

  state.matter = matter;

  state.background = game.add.sprite(400, 300, level.name);

  createMap();

  const ground = state.ground = createGround();
  const ceiling = state.ceiling = createCeiling();
  const leftWall = state.leftWall = createWall(false, -40, 400);
  const rightWall = state.rightWall = createWall(true, level.width + 40, 400);

  const hero = state.hero = createHero(state.initialHeroPosition, true);

  const sidekick = state.sidekick = createSidekick(state.initialSidekickPosition, true);

  // target, round pixels for jitter, lerpx, lerpy, offsetx, offsety
  game.cameras.main.startFollow(hero, false, 0.05, 0, 0, 270);

  game.cameras.main.setBounds(0, 0, level.width, 1080 * 2);

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
    if (isEnemy && isPlayer && !a.isRespawning && !b.isRespawning) {
      const { Vector } = Phaser.Physics.Matter.Matter;
      const aMomentum = Vector.mult(a.cachedVelocity, a.body.mass);
      const bMomentum = Vector.mult(b.cachedVelocity, b.body.mass);
      const relativeMomentum = Vector.sub(aMomentum, bMomentum);
      const impact = Vector.magnitude(relativeMomentum);
      const damage = impact / 5;
      const duration = impact;
      a.currentHP = Math.max(0, a.currentHP - damage);
      b.currentHP = Math.max(0, b.currentHP - damage);

      [a, b].forEach((character) => {
        const percent = damage / character.maxHP;
        let start = 0;
        const end = damage * 3;
        if (character.damageTween) {
          start = character.damageTween.getValue();
          character.damageTween.stop();
        }

        character.damageTween = game.tweens.addCounter({
          from: start,
          to: end,
          duration,
          onUpdate: () => {
            const tint = Phaser.Display.Color.Interpolate.ColorWithColor(whiteColor, redColor, 100, character.damageTween.getValue());
            const color = Phaser.Display.Color.ObjectToColor(tint).color;
            character.setTint(color);
          },
          onComplete: () => {
            character.damageTween = game.tweens.addCounter({
              from: end,
              to: 0,
              duration,
              onUpdate: () => {
                const tint = Phaser.Display.Color.Interpolate.ColorWithColor(whiteColor, redColor, 100, character.damageTween.getValue());
                const color = Phaser.Display.Color.ObjectToColor(tint).color;
                character.setTint(color);
              },
            });
          },
        });
      });

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
  const { waveEnemies, enemies, game, level, victory } = state;

  if (victory) {
    return;
  }

  updateHero();
  updateSidekick();

  // dont update offscreen enemies
  waveEnemies.forEach(enemy => updateEnemy(enemy));

  if (waveEnemies.length === 0) {
    delete state.camera_lock;

    if (level.waves.length) {
      const wave = level.waves.shift();
      state.waveEnemies = wave.enemies;
      state.x_lock = wave.x_lock;
    } else {
      delete state.x_lock;
    }
  }

  updateCameraAndBounds();
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

  if (x_lock) {
    rightWall.x = x_lock + config.width + 50;
  } else {
    rightWall.x = level.width + 50;
  }

  Phaser.Physics.Matter.Matter.Body.setPosition(ceiling, {
    x: 400 + leftBound,
    y: ceiling.position.y,
  });

  ground.x = config.width / 2 + leftBound;

  leftWall.x = Math.max(-50, leftBound - 50);

  // parallax should depend on bg width and level width
  // worldView.x = 0 means we show bg's left border
  // worldView.x = lvl.width means we show bg's right border
  state.background.x = state.background.width / 2 + leftBound * (state.background.width / (level.width - config.width));
}

function respawnIfNeeded(character) {
  const { game, hero, background } = state;
  let { sidekick } = state;

  if (character.currentHP > 0) {
    return;
  }

  if (character.isRespawnBeginning) {
    return;
  }

  if (character === hero) {
    if (state.throwState === 'hold') {
      sidekick = state.sidekick = replaceSidekick(sidekick);
    }

    state.throwState = 'calm';

    background.heroDieTween = game.tweens.addCounter({
      from: 0,
      to: 70,
      duration: 300,
      onUpdate: () => {
        const tint = Phaser.Display.Color.Interpolate.ColorWithColor(whiteColor, redColor, 100, background.heroDieTween.getValue());
        const color = Phaser.Display.Color.ObjectToColor(tint).color;
        background.setTint(color);
      },
    });
  } else if (character === sidekick) {
    state.throwState = 'calm';
  }

  game.tweens.add({
    targets: character,
    alpha: 0,
    duration: 1000,
    onComplete: () => {
      character.y = state.ceiling.position.y + character.height / 2;
      character.x = game.cameras.main.scrollX + 64;
      character.isRespawnBeginning = false;
      character.currentHP = character.maxHP;
      character.setVelocityX(0);
      character.setVelocityY(0);

      if (character === sidekick) {
        character.isRespawning = false;
      }

      game.tweens.add({
        targets: character,
        alpha: 1,
        duration: 300,
      });

      game.time.addEvent({
        delay: 1000,
        callback: () => {
          if (character === hero) {
            background.heroDieTween = game.tweens.addCounter({
              from: background.heroDieTween.getValue(),
              to: 0,
              duration: 300,
              onUpdate: () => {
                const tint = Phaser.Display.Color.Interpolate.ColorWithColor(whiteColor, redColor, 100, background.heroDieTween.getValue());
                const color = Phaser.Display.Color.ObjectToColor(tint).color;
                background.setTint(color);
              },
            });
          }
        },
      });
    },
  });

  character.isRespawnBeginning = true;
  character.isRespawning = true;
  character.setVelocityX(0);
  character.setVelocityY(0);
}

function updateSidekick() {
  const { game, hero, keys } = state;
  let { sidekick } = state;

  if (sidekick.x > hero.x + config.width) {
    sidekick.setVelocityX(0);
  }

  const dx = hero.x - sidekick.x;
  const dy = hero.y - sidekick.y;

  updateCachedVelocityFor(sidekick);
  updateHpBarFor(sidekick);
  respawnIfNeeded(sidekick);

  if (sidekick.isRespawnBeginning || hero.isRespawning) {
    return;
  }

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

          hero.applyForce({
            x: dx < 0 ? 0.005 : -0.005,
            y: dy < 0 ? 0.005 : -0.005,
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
        } else if (sidekick.currentHP / sidekick.maxHP >= 0.5) {
          // wiggle but don't move. and only when he's not
          // totally afraid of hero
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
      sidekick.x = hero.x + (state.facingRight ? 10 : -10) + sidekick.xHold;
      sidekick.y = hero.y + 10 + sidekick.yHold;

      if (zDownStart) {
        state.throwState = 'throw';

        // recreate a new sidekick because re-adding to
        // physics seems unsupported
        sidekick = state.sidekick = replaceSidekick(sidekick);

        sidekick.applyForce({
          x: state.facingRight ? 0.75 : -0.75,
          y: Phaser.Math.FloatBetween(-0.20, 0),
        });

        hero.applyForce({
          x: state.facingRight ? -0.1 : 0.1,
          y: -0.01,
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

function winLevel() {
  const { background, game, matter, hero, sidekick, level, levelExit } = state;
  const { blocks } = level;
  matter.world.pause();
  state.victory = true;

  background.victoryTween = game.tweens.addCounter({
    from: 0,
    to: 70,
    duration: 300,
    onUpdate: () => {
      const tint = Phaser.Display.Color.Interpolate.ColorWithColor(whiteColor, greenColor, 100, background.victoryTween.getValue());
      const color = Phaser.Display.Color.ObjectToColor(tint).color;
      background.setTint(color);
    },
  });

  [hero, sidekick].forEach((character) => {
    const { hpBar } = character;
    const { border, fill } = hpBar;

    game.tweens.add({
      targets: [border, fill],
      y: border.y - 30,
      alpha: 0,
      angle: 12,
      ease: 'Cubic.easeIn',
      duration: 500,
    });
  });

  game.tweens.add({
    targets: levelExit.sprite,
    y: levelExit.sprite.y - 30,
    angle: 12,
    alpha: 0,
    ease: 'Cubic.easeIn',
    duration: 500,
  });

  blocks.forEach((block) => {
    const { x, y } = block;
    const dx = x - hero.x;
    const dy = y - hero.y;
    const theta = Math.atan2(dy, dx);

    game.tweens.add({
      targets: block,
      x: x + config.width * Math.cos(theta),
      y: y + config.width * Math.sin(theta),
      ease: 'Cubic.easeIn',
      duration: 3000,
    });
  });
}

function updateHero() {
  const { game, matter, hero, cursors, keys, throwState, sidekick, levelExit } = state;

  updateCachedVelocityFor(hero);
  updateHpBarFor(hero);
  respawnIfNeeded(hero);

  if (hero.isRespawning) {
    if (hero.touching.bottom && !hero.isRespawnBeginning) {
      game.cameras.main.shake(100, 0.03);
      hero.isRespawning = false;
    }
    return;
  }

  if (levelExit) {
    const dx = levelExit.x - hero.x;
    const dy = levelExit.y - hero.y;
    if (dx*dx+dy*dy < 30*30) {
      winLevel();
      return;
    }
  }

  const { velocity } = hero.body;
  if (cursors.left.isDown) {
    state.facingRight = false;
    hero.setFlipX(true);
    hero.applyForce({
      x: throwState === 'hold' ? -0.025 : -0.1,
      y: 0,
    });
  }

  if (cursors.right.isDown) {
    state.facingRight = true;
    hero.setFlipX(false);
    hero.applyForce({
      x: throwState === 'hold' ? 0.025 : 0.1,
      y: 0,
    });
  }

  // if we are walking while holding
  sidekick.xHold = 0;
  if (throwState === 'hold') {
    if (Math.abs(hero.body.velocity.x) > 1) {
      sidekick.xHold = -hero.body.velocity.x / 2;
    }

    if ((cursors.left.isDown || cursors.right.isDown) && hero.touching.bottom) {
      if (!sidekick.yHoldTween) {
        if (sidekick.yRecoverTween) {
          sidekick.yRecoverTween.stop();
          delete sidekick.yRecoverTween;
        }
        sidekick.yHoldTween = game.tweens.addCounter({
          from: sidekick.yHoldFrom || 0,
          to: 100,
          ease: 'Quad.easeInOut',
          duration: 100,
          onUpdate: () => {
            if (sidekick.yHoldTween) {
              sidekick.yHold = (sidekick.yHoldUp ? -3 : 3) * sidekick.yHoldTween.getValue() / 100;
            }
          },
          onComplete: () => {
            sidekick.yHoldUp = !sidekick.yHoldUp;
            sidekick.yHoldFrom = -100;
            delete sidekick.yHoldTween;
          },
        });
      }
    } else if (sidekick.yHold !== 0) {
      if (!sidekick.yRecoverTween) {
        if (sidekick.yHoldTween) {
          sidekick.yHoldTween.stop();
          delete sidekick.yHoldTween;
        }
        sidekick.yRecoverTween = game.tweens.addCounter({
          from: sidekick.yHold,
          to: 0,
          duration: 100,
          ease: 'Quad.easeInOut',
          onUpdate: () => {
            if (sidekick.yRecoverTween) {
              sidekick.yHold = sidekick.yRecoverTween.getValue();
            }
          },
          onComplete: () => {
            delete sidekick.yRecoverTween;
            sidekick.yHoldFrom = 0;
          },
        });
      }
    }
  }

  if (hero.touching.bottom && cursors.up.isDown) {
    hero.applyForce({
      x: 0,
      y: throwState === 'hold' ? -0.16 : -0.33,
    });
  }

  if (velocity.x > 5) hero.setVelocityX(5);
  else if (velocity.x < -5) hero.setVelocityX(-5);
}

