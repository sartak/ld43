/* @flow */
import Phaser from 'phaser';
import heroSprite from './assets/hero.png';
import stageImage from './assets/stage.png';
import physicsShapes from './assets/physics.json';

// SACRIFICES MUST BE MADE

const config = {
  type: Phaser.AUTO,
  parent: 'engine',
  width: 800,
  height: 600,
  physics: {
    default: 'matter',
    matter: {
      debug: true,
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

const state = {};
window.state = state;

export default function startGame() {
  return new Phaser.Game(config);
}

function preload() {
  const game = state.game = this;
  game.load.image('hero', heroSprite);
  game.load.image('stage', stageImage);
}

function create() {
  const { game } = state;
  const { matter } = game;

  matter.world.setBounds(0, 0, config.width, config.height);

  game.add.sprite(400, 300, 'stage');

  const hero = state.hero = matter.add.sprite(400, 300, 'hero', null, { shape: physicsShapes.hero });

  state.cursors = game.input.keyboard.createCursorKeys();
}

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
  if (cursors.down.isDown) {
    hero.y += 10;
  }
}

