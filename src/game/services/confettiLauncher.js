import Phaser from 'phaser';

const CONFETTI_COLORS = [0xa2ecd3, 0xffb84d, 0xa5daf3, 0xd4aeae, 0xffffff, 0xff7aa2, 0x8ff0ff];
const CONFETTI_COUNT = 140;
const GLOW_DOT_COLORS = [0x39ff14, 0x00f5ff, 0xfff44f, 0xff3bd4, 0xff5a1f, 0xffffff];
const GLOW_DOT_COUNT = 55;
const SIZE_SCALE = 0.5;
const RISE_BASE_DURATION = 950;
const RISE_SIZE_DURATION = 35;
const FALL_BASE_DURATION = 1500;
const FALL_SIZE_DURATION = 80;
const MAX_PIECE_HEIGHT = (9 + 3 * 3) * SIZE_SCALE;
const DISPLAY_DURATION = RISE_BASE_DURATION
  + MAX_PIECE_HEIGHT * RISE_SIZE_DURATION
  + FALL_BASE_DURATION
  + MAX_PIECE_HEIGHT * FALL_SIZE_DURATION;

export class ConfettiLauncher {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
  }

  play() {
    this.clear();
    this.getPieces().forEach((piece) => this.addPiece(piece));
  }

  getDisplayDuration() {
    return DISPLAY_DURATION;
  }

  clear() {
    this.objects.forEach((object) => {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    });
    this.objects = [];
  }

  getPieces() {
    return [
      ...this.getRectanglePieces(),
      ...this.getGlowDotPieces(),
    ];
  }

  getRectanglePieces() {
    return Array.from({ length: CONFETTI_COUNT }, (_item, index) => {
      return this.makePiece(index, 'rectangle');
    });
  }

  getGlowDotPieces() {
    return Array.from({ length: GLOW_DOT_COUNT }, (_item, index) => {
      return this.makePiece(index + CONFETTI_COUNT, 'circle');
    });
  }

  makePiece(index, kind) {
    const angle = this.getLaunchAngle(index);
    const distance = 230 + index % 7 * 28;
    const startX = this.scene.scale.width / 2;
    const startY = this.scene.scale.height - 8;
    const height = this.getPieceHeight(index, kind);

    return {
      apexY: startY + Math.sin(angle) * distance,
      color: this.getColor(index, kind),
      fallX: startX + Math.cos(angle) * (distance + 90),
      fallY: this.scene.scale.height + 100,
      height,
      kind,
      rotation: Phaser.Math.DegToRad(index * 29 % 180),
      riseDuration: RISE_BASE_DURATION + height * RISE_SIZE_DURATION,
      startX,
      startY,
      width: this.getPieceWidth(index, kind),
    };
  }

  getLaunchAngle(index) {
    const spreadIndex = index % 35;
    const wave = Math.floor(index / 35);
    const baseAngle = 205 + spreadIndex * 130 / 34;
    const waveOffset = wave * 4 - 6;

    return Phaser.Math.DegToRad(baseAngle + waveOffset);
  }

  addPiece(piece) {
    const confetti = this.makeGameObject(piece);
    confetti.setDepth(1001);
    confetti.setRotation(piece.rotation);
    this.objects.push(confetti);
    this.scene.tweens.add(this.getHorizontalTween(confetti, piece));
    this.scene.tweens.add(this.getRiseTween(confetti, piece));
  }

  makeGameObject(piece) {
    if (piece.kind === 'circle') {
      const dot = this.scene.add.circle(piece.startX, piece.startY, piece.width, piece.color, 1);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      return dot;
    }

    return this.scene.add.rectangle(
      piece.startX,
      piece.startY,
      piece.width,
      piece.height,
      piece.color,
      1,
    );
  }

  getHorizontalTween(confetti, piece) {
    return {
      targets: confetti,
      duration: piece.riseDuration + this.getFallDuration(piece),
      ease: 'Linear',
      x: piece.fallX,
    };
  }

  getRiseTween(confetti, piece) {
    return {
      targets: confetti,
      angle: confetti.angle + 240,
      duration: piece.riseDuration,
      ease: 'Cubic.easeOut',
      scaleX: 1.35,
      y: piece.apexY,
      onComplete: () => this.startFall(confetti, piece),
    };
  }

  startFall(confetti, piece) {
    if (!confetti.active) {
      return;
    }

    this.scene.tweens.add(this.getFallTween(confetti, piece));
  }

  getFallTween(confetti, piece) {
    return {
      targets: confetti,
      angle: confetti.angle + 420 + piece.width * 24,
      alpha: 0,
      duration: this.getFallDuration(piece),
      ease: 'Sine.easeIn',
      scaleX: 0.6,
      y: piece.fallY,
      onComplete: () => this.destroyObject(confetti),
    };
  }

  getFallDuration(piece) {
    return FALL_BASE_DURATION + piece.height * FALL_SIZE_DURATION;
  }

  destroyObject(object) {
    this.objects = this.objects.filter((item) => item !== object);

    if (object.active) {
      object.destroy();
    }
  }

  getPieceHeight(index, kind) {
    if (kind === 'circle') {
      return (8 + index % 4) * SIZE_SCALE;
    }

    return (9 + index % 4 * 3) * SIZE_SCALE;
  }

  getPieceWidth(index, kind) {
    if (kind === 'circle') {
      return (4 + index % 5) * SIZE_SCALE;
    }

    return (5 + index % 3 * 3) * SIZE_SCALE;
  }

  getColor(index, kind) {
    if (kind === 'circle') {
      return GLOW_DOT_COLORS[index % GLOW_DOT_COLORS.length];
    }

    return CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  }
}
