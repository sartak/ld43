/* @flow */
import Phaser from "phaser";
import skyImg from "./assets/sky.png";
import cloudsImg from "./assets/clouds.png";
import platformImg from "./assets/platform.png";
import starImg from "./assets/star.png";
import bombImg from "./assets/bomb.png";
import yellowImg from "./assets/yellow.png";
import smokeImg from "./assets/smoke.png";
import dudeImg from "./assets/dude.png";
import jumpSound from "./assets/jump.wav";
import starSound from "./assets/star.wav";
import bombSound from "./assets/bomb.wav";
import testMusic from "./assets/test.mp3";
import physicsData from "./assets/physics.json";

var config = {
  type: Phaser.AUTO,
  parent: "engine",
  width: 800,
  height: 600,
  physics: {
    default: "matter",
    matter: {}
  },
  scene: {
    preload,
    create,
    update
  }
};

var game;
export default function startGame() {
  game = new Phaser.Game(config);
}

function preload() {
  this.load.image("sky", skyImg);
  this.load.image("clouds", cloudsImg);
  this.load.image("ground", platformImg);
  this.load.image("star", starImg);
  this.load.image("bomb", bombImg);
  this.load.image("yellow", yellowImg);
  this.load.image("smoke", smokeImg);
  this.load.spritesheet("dude", dudeImg, {
    frameWidth: 32,
    frameHeight: 48
  });
  this.load.audio("jump", jumpSound);
  this.load.audio("star", starSound);
  this.load.audio("bomb", bombSound);
  this.load.audio("bgm", testMusic);
}

var scene;
var player;
var cursors;
var stars = [];
var bombs = [];
var score = 0;
var scoreText;
var gameOver = false;
var tintTween;
var recoveringTint;
var round = 1;

function ruckus() {
  setTimeout(() => {
    bombs.forEach(bomb => {
      bomb.applyForce({
        x: Phaser.Math.FloatBetween(0, 0.02) - 0.01,
        y: Phaser.Math.FloatBetween(0, 0.02)
      });
    });
    stars.forEach(star => {
      star.applyForce({
        x: Phaser.Math.FloatBetween(0, 0.02) - 0.01,
        y: Phaser.Math.FloatBetween(0, -0.02)
      });
    });
  }, 40);
}

function createStars(count) {
  for (let i = 0; i < count; ++i) {
    const star = scene.matter.add.sprite(
      Phaser.Math.Between(390, 410),
      Phaser.Math.Between(0, 10),
      "star",
      null,
      { shape: physicsData.star }
    );
    star.setName("star");
    star.applyForce({
      x: Phaser.Math.FloatBetween(0, 0.06) - 0.03,
      y: Phaser.Math.FloatBetween(0, 0.06) - 0.03
    });
    stars.push(star);

    var particles = scene.add.particles("yellow");

    var emitter = particles.createEmitter({
      scaleX: { start: 0.2, end: 0.05 },
      scaleY: { start: 0.2, end: 0.05 },
      alpha: { start: 0.8, end: 0.2 },
      gravityY: 200,
      x: 0,
      y: 1,
      speed: 50,
      lifespan: 400,
      blendMode: "ADD"
    });
    emitter.startFollow(star);

    star.particles = particles;
    star.emitter = emitter;
  }
}

function createBomb() {
  const bomb = scene.matter.add.sprite(
    Phaser.Math.Between(390, 410),
    Phaser.Math.Between(0, 10),
    "bomb",
    null,
    { shape: physicsData.bomb }
  );
  bomb.setName("bomb");
  bomb.applyForce({
    x: Phaser.Math.FloatBetween(0, 0.06) - 0.03,
    y: Phaser.Math.FloatBetween(0, 0.06) - 0.03
  });
  bombs.push(bomb);

  var particles = scene.add.particles("smoke");

  var emitter = particles.createEmitter({
    scale: { start: 0.3, end: 0.6 },
    gravityY: -100,
    x: 0,
    y: 0,
    speed: 1,
    lifespan: 2000,
    quantity: 1
    //tint: { start: 0xE78518, end: 0xFFFFFF },
  });

  emitter.startFollow(bomb);

  bomb.particles = particles;
  bomb.emitter = emitter;
  return bomb;
}

function hitBomb(player, bomb) {
  scene.matter.world.pause();
  scene.matter.world.remove(player);

  tintTween.stop();

  scene.cameras.main.shake(200, 0.05);
  tintTween = scene.tweens.addCounter({
    from: 0,
    to: 100,
    duration: 300,
    onUpdate: () => {
      const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 0, b: 0 },
        100,
        tintTween.getValue()
      );
      const color = Phaser.Display.Color.ObjectToColor(tint).color;
      player.setTint(color);
    }
  });

  player.anims.play("turn");
  scene.sound.play("bomb");
  gameOver = true;

  scene.tweens.add({
    targets: player,
    y: player.body.position.y - 50,
    duration: 500,
    ease: "Quad.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: player,
        y: player.body.position.y + 800,
        duration: 2500,
        ease: "Quad.easeIn"
      });
    }
  });

  scene.tweens.add({
    targets: player,
    angle: player.angle + 720,
    duration: 3000,
    ease: "Quad.easeOut"
  });
}

function destroyStar(star) {
  scene.matter.world.remove(star);
  stars = stars.filter(other => other !== star);

  star.emitter.stopFollow();
  star.particles.destroy();

  star.destroy();
}

function collectStar(player, star) {
  star.sayonara = true;
  scene.sound.play("star");
  ruckus();

  let tintStart = 0;
  if (tintTween) {
    if (recoveringTint) {
      tintStart = 100 - tintTween.getValue();
    } else {
      tintStart = tintTween.getValue();
    }
    tintTween.stop();
  }

  tintTween = scene.tweens.addCounter({
    from: tintStart,
    to: 100,
    duration: 300,
    onUpdate: () => {
      const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 255, b: 0 },
        100,
        tintTween.getValue()
      );
      const color = Phaser.Display.Color.ObjectToColor(tint).color;
      player.setTint(color);
    },
    onComplete: () => {
      recoveringTint = true;
      tintTween = scene.tweens.addCounter({
        from: 0,
        to: 100,
        duration: 150,
        onUpdate: () => {
          const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
            { r: 255, g: 255, b: 0 },
            { r: 255, g: 255, b: 255 },
            100,
            tintTween.getValue()
          );
          const color = Phaser.Display.Color.ObjectToColor(tint).color;
          player.setTint(color);
        }
      });
    }
  });
  recoveringTint = false;

  scene.cameras.main.shake(50, 0.01);

  destroyStar(star);

  if (stars.length === 0) {
    round++;
    createStars(10);

    if (round % 2 === 0) {
      createBomb();
    } else {
      const bomb1 = createBomb();
      const bomb2 = createBomb();
      window.constraint = scene.matter.add.constraint(bomb1, bomb2, 30, 0.75);
    }
  }

  score++;
  scoreText.setText(`round: ${round}  score: ${score}`);
}

function create() {
  scene = this;

  var music = this.sound.add("bgm");
  music.play("", { loop: true });

  this.add.image(400, 300, "sky");

  const clouds = this.add.image(-400, 300, "clouds");
  this.tweens.add({
    targets: clouds,
    repeat: -1,
    x: 1200,
    duration: 30000
  });

  this.matter.world.setBounds(0, 0, game.config.width, game.config.height);

  this.matter.add
    .sprite(400, 568, "ground", null, { shape: physicsData.platform })
    .setScale(2);
  this.matter.add.sprite(600, 400, "ground", null, {
    shape: physicsData.platform
  });
  this.matter.add.sprite(50, 250, "ground", null, {
    shape: physicsData.platform
  });
  this.matter.add.sprite(750, 220, "ground", null, {
    shape: physicsData.platform
  });
  cursors = this.input.keyboard.createCursorKeys();

  player = this.matter.add.sprite(100, 450, "dude", null, {
    shape: physicsData["dude-single"]
  });
  player.setName("player");

  this.anims.create({
    key: "left",
    frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "turn",
    frames: [{ key: "dude", frame: 4 }],
    frameRate: 20
  });

  this.anims.create({
    key: "right",
    frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1
  });

  createStars(10);

  scoreText = this.add.text(16, 16, `round: ${round}  score: ${score}`, {
    fontSize: "24px",
    fill: "#000"
  });

  this.matter.world.on("collisionstart", event => {
    event.pairs.forEach(({ bodyA, bodyB }) => {
      let a = bodyA.gameObject;
      let b = bodyB.gameObject;

      if (!a || !b) {
        return;
      }

      if (b === player) {
        [a, b] = [b, a];
      }

      if (b.sayonara) {
        return;
      }

      if (a === player && b.name === "star") {
        collectStar(a, b);
      }
      if (a === player && b.name === "bomb") {
        hitBomb(a, b);
      }
    });
  });
}

function update() {
  if (gameOver) {
    return;
  }

  if (cursors.left.isDown) {
    player.applyForce({ x: -0.001, y: 0 });
    player.anims.play("left", true);
  } else if (cursors.right.isDown) {
    player.applyForce({ x: 0.001, y: 0 });
    player.anims.play("right", true);
  } else {
    player.anims.play("turn");
  }

  if (cursors.up.isDown) {
    player.applyForce({ x: 0, y: -0.001 });
    //this.sound.play('jump');
  }

  // recover out of bounds stars
  stars.forEach(star => {
    const { x, y } = star.body.position;
    if (x < 0 || y < 0 || x > 800 || y > 534) {
      destroyStar(star);
      createStars(1);
    }
  });
}
