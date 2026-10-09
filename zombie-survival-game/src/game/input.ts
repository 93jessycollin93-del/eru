/** Keyboard and mouse state, with "pressed this frame" edges. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  leftDown = false;
  rightDown = false;
  leftPressed = false;
  /** Set by the game: only collect mouse look while true. */
  capturing = false;

  constructor(private target: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mousemove", this.onMouseMove);
    target.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    target.addEventListener("contextmenu", this.onContext);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.target.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.target.removeEventListener("contextmenu", this.onContext);
  }

  isDown(code: string) {
    return this.down.has(code);
  }

  wasPressed(code: string) {
    return this.pressed.has(code);
  }

  /** Call at the end of every frame. */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftPressed = false;
  }

  reset() {
    this.down.clear();
    this.pressed.clear();
    this.leftDown = this.rightDown = this.leftPressed = false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Don't steal keys from form fields.
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!e.repeat) this.pressed.add(e.code);
    this.down.add(e.code);
    if (["Tab", "Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => this.down.delete(e.code);
  private onBlur = () => this.reset();

  private onMouseMove = (e: MouseEvent) => {
    if (!this.capturing) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.leftDown = true;
      this.leftPressed = true;
    }
    if (e.button === 2) this.rightDown = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.leftDown = false;
    if (e.button === 2) this.rightDown = false;
  };

  private onContext = (e: Event) => e.preventDefault();
}
