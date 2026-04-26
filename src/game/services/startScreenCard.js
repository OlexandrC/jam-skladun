const CARD_WIDTH = 560;
const CARD_HEIGHT = 340;
const CARD_RADIUS = 24;
const CARD_BACKGROUND = 0x232a3a;
const CARD_BORDER = 0xa2ecd3;
const BUTTON_COLOR = 0x43c77f;
const BUTTON_HOVER_COLOR = 0x62d995;
const BUTTON_TEXT_COLOR = '#102418';
const TITLE_Y = -92;
const TEXT_Y = -8;
const BUTTON_Y = 112;
const BUTTON_WIDTH = 148;
const BUTTON_HEIGHT = 48;
const INSTRUCTION_LINES = [
  '- Use generate button to generate a new level.',
  '- Add objects to the level to place blue into green.',
  '- Use play button.',
];

export class StartScreenCard {
  constructor(scene, onStart) {
    this.scene = scene;
    this.onStart = onStart;
    this.container = this.makeContainer();
    this.addStaticChildren();
    this.hide();
  }

  show() {
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

    container.setDepth(1110);
    return container;
  }

  addStaticChildren() {
    this.container.add(this.makeBackdrop());
    this.container.add(this.makeCardBackground());
    this.container.add(this.makeTitle());
    this.container.add(this.makeInstructions());
    this.container.add(this.makeStartButton());
  }

  makeBackdrop() {
    const backdrop = this.scene.add.rectangle(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height,
      0x000000,
      0.68,
    );

    backdrop.setInteractive();
    return backdrop;
  }

  makeCardBackground() {
    const background = this.scene.add.graphics();

    background.fillStyle(CARD_BACKGROUND, 0.97);
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

  makeTitle() {
    const title = this.scene.add.text(0, TITLE_Y, 'Place blue into green.', {
      align: 'center',
      color: '#eef4ff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: '700',
    });

    title.setOrigin(0.5);
    return title;
  }

  makeInstructions() {
    const text = this.scene.add.text(0, TEXT_Y, INSTRUCTION_LINES.join('\n'), {
      align: 'center',
      color: '#a8b3c7',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      lineSpacing: 12,
      wordWrap: {
        width: 470,
        useAdvancedWrap: true,
      },
    });

    text.setOrigin(0.5);
    return text;
  }

  makeStartButton() {
    const background = this.scene.add.rectangle(
      0,
      BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      BUTTON_COLOR,
      1,
    );
    const label = this.scene.add.text(0, BUTTON_Y, 'START', {
      color: BUTTON_TEXT_COLOR,
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: '700',
    });

    background.setStrokeStyle(1, CARD_BORDER, 0.85);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => background.setFillStyle(BUTTON_HOVER_COLOR, 1));
    background.on('pointerout', () => background.setFillStyle(BUTTON_COLOR, 1));
    background.on('pointerup', () => this.onStart?.());
    label.setOrigin(0.5);
    return this.scene.add.container(0, 0, [background, label]);
  }
}
