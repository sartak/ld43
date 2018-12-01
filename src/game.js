/* @flow */
import Phaser from 'phaser';
import heroSprite from './assets/hero.png';
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
  game.load.image('sky', skyImage);
  game.load.image('ground', groundImage);
}

function createHero(x, y) {
  const { game } = state;

  const hero = game.matter.add.sprite(0, 0, 'hero', null);

  const { Body, Bodies } = Phaser.Physics.Matter.Matter;
  const { width: w, height: h } = hero;

  const sensors = {
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

  return hero;
}

function create() {
  const { game } = state;
  const { matter } = game;

  matter.world.setBounds(0, 0, config.width, config.height);

  game.add.sprite(400, 300, 'sky');
  const ground = state.ground = matter.add.sprite(400, config.height - (config.groundHeight/2), 'ground', null, { shape: physicsShapes.ground });

  // +20 for a little bit of dynamism on load
  const hero = state.hero = createHero(100, 20 + config.height - (config.characterHeight/2));

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
}

// parameter t is milliseconds since load
function update() {
  const { hero, cursors } = state;
  if (cursors.left.isDown) {
    hero.x -= 10;
  }
  if (cursors.right.isDown) {
    hero.x += 10;
  }
  if (cursors.up.isDown) {
    hero.y -= 10;
  }
}

