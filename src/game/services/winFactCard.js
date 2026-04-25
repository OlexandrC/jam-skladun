const CARD_WIDTH = 430;
const CARD_HEIGHT = 500;
const CARD_RADIUS = 24;
const IMAGE_MAX_WIDTH = 320;
const IMAGE_MAX_HEIGHT = 210;
const IMAGE_Y = -74;
const TEXT_Y = 110;
const BUTTON_Y = 204;
const BUTTON_WIDTH = 132;
const BUTTON_HEIGHT = 42;
const CARD_BACKGROUND = 0x232a3a;
const CARD_BORDER = 0xa2ecd3;
const BUTTON_COLOR = 0x2f394d;
const BUTTON_HOVER_COLOR = 0x3b4860;

export class WinFactCard {
  constructor(scene, onClose) {
    this.scene = scene;
    this.onClose = onClose;
    this.image = null;
    this.text = this.makeText();
    this.container = this.makeContainer();
    this.addStaticChildren();
    this.hide();
  }

  show(factEntry) {
    if (!factEntry || !this.scene.textures.exists(factEntry.imageKey)) {
      return;
    }

    this.setImage(factEntry.imageKey);
    this.text.setText(factEntry.text);
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  makeContainer() {
    const container = this.scene.add.container(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
    );

    container.setDepth(1105);
    return container;
  }

  addStaticChildren() {
    this.container.add(this.makeBackdrop());
    this.container.add(this.makeCardBackground());
    this.container.add(this.text);
    this.container.add(this.makeCloseButton());
  }

  makeBackdrop() {
    return this.scene.add.rectangle(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height,
      0x000000,
      0.58,
    );
  }

  makeCardBackground() {
    const background = this.scene.add.graphics();

    background.fillStyle(CARD_BACKGROUND, 0.96);
    background.lineStyle(2, CARD_BORDER, 0.95);
    background.fillRoundedRect(
      -CARD_WIDTH / 2,
      -CARD_HEIGHT / 2,
      CARD_WIDTH,
      CARD_HEIGHT,
      CARD_RADIUS,
    );
    background.strokeRoundedRect(
      -CARD_WIDTH / 2,
      -CARD_HEIGHT / 2,
      CARD_WIDTH,
      CARD_HEIGHT,
      CARD_RADIUS,
    );
    return background;
  }

  makeText() {
    const text = this.scene.add.text(0, TEXT_Y, '', {
      align: 'center',
      color: '#eef4ff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: '700',
      wordWrap: {
        width: 320,
        useAdvancedWrap: true,
      },
    });

    text.setOrigin(0.5);
    return text;
  }

  makeCloseButton() {
    const background = this.scene.add.rectangle(
      0,
      BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      BUTTON_COLOR,
      1,
    );
    const label = this.scene.add.text(0, BUTTON_Y, 'Close', {
      color: '#eef4ff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    });

    background.setStrokeStyle(1, CARD_BORDER, 0.8);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => background.setFillStyle(BUTTON_HOVER_COLOR, 1));
    background.on('pointerout', () => background.setFillStyle(BUTTON_COLOR, 1));
    background.on('pointerup', () => this.onClose?.());
    label.setOrigin(0.5);
    return this.scene.add.container(0, 0, [background, label]);
  }

  setImage(imageKey) {
    if (!this.image) {
      this.image = this.scene.add.image(0, IMAGE_Y, imageKey);
      this.container.addAt(this.image, 2);
    } else {
      this.image.setTexture(imageKey);
    }

    this.fitImage(this.image, imageKey);
  }

  fitImage(image, imageKey) {
    const sourceImage = this.scene.textures.get(imageKey).getSourceImage();

    if (!sourceImage?.width || !sourceImage?.height) {
      image.setScale(1);
      return;
    }

    const scale = Math.min(
      IMAGE_MAX_WIDTH / sourceImage.width,
      IMAGE_MAX_HEIGHT / sourceImage.height,
    );

    image.setScale(scale);
  }
}
