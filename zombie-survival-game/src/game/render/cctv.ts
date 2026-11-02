import * as THREE from "three";
import type { NetworkSpec } from "../../sim/network";

const W = 320;
const H = 240;
/** Seconds between channel renders. Each channel refreshes at ~1-2 fps, like a real NVR remote view. */
const FRAME_INTERVAL = 0.16;

export interface CctvChannel {
  channel: number;
  label: string;
  ip: string;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  online: boolean;
}

type Mounts = Partial<Record<string, { pos: THREE.Vector3; target: THREE.Vector3 }>>;

/**
 * Live CCTV: real cameras in the world rendered offscreen, one channel at a
 * time, into small canvases that the camera viewer shows.
 */
export class CctvSystem {
  channels: CctvChannel[] = [];
  nvrName = "";
  private target = new THREE.WebGLRenderTarget(W, H, { samples: 0 });
  private pixels = new Uint8Array(W * H * 4);
  private timer = 0;
  private next = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
  ) {}

  setup(spec: NetworkSpec, mounts: Mounts) {
    const nvr = spec.hosts.find((h) => h.kind === "nvr");
    this.nvrName = nvr ? `${nvr.hostname} (${nvr.ip})` : "";
    for (const h of spec.hosts) {
      if (!h.camera) continue;
      const m = mounts[h.camera.mount];
      if (!m) continue;
      const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 150);
      camera.position.copy(m.pos);
      camera.lookAt(m.target);
      camera.updateMatrixWorld();
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      this.channels.push({ channel: h.camera.channel, label: h.camera.label, ip: h.ip, camera, canvas, online: false });
    }
    this.channels.sort((a, b) => a.channel - b.channel);
  }

  /** Render the next channel if it's time. */
  update(dt: number, isUp: (ip: string) => boolean, daylight: number, clock: string) {
    if (!this.channels.length) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = FRAME_INTERVAL;
    const ch = this.channels[this.next % this.channels.length];
    this.next++;
    ch.online = isUp(ch.ip);
    if (ch.online) this.renderChannel(ch, daylight);
    else this.noSignal(ch);
    this.overlay(ch, clock);
  }

  /** Render every channel now (when the viewer opens, so no feed starts black). */
  renderAll(isUp: (ip: string) => boolean, daylight: number, clock: string) {
    for (const ch of this.channels) {
      ch.online = isUp(ch.ip);
      if (ch.online) this.renderChannel(ch, daylight);
      else this.noSignal(ch);
      this.overlay(ch, clock);
    }
  }

  private renderChannel(ch: CctvChannel, daylight: number) {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.shadowMap.autoUpdate;
    // Reuse this frame's shadow map rather than re-rendering it per camera.
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.target);
    r.render(this.scene, ch.camera);
    r.readRenderTargetPixels(this.target, 0, 0, W, H, this.pixels);
    r.setRenderTarget(prevTarget);
    r.shadowMap.autoUpdate = prevAuto;

    const ctx = ch.canvas.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    // Auto-exposure like a real camera: aim the average brightness at mid-grey.
    let sum = 0;
    for (let i = 0; i < this.pixels.length; i += 16) sum += this.pixels[i] * 0.299 + this.pixels[i + 1] * 0.587 + this.pixels[i + 2] * 0.114;
    const mean = sum / (this.pixels.length / 16) + 1;
    // At night the camera switches to infrared: brighter, flatter, noisier.
    const ir = daylight < 0.3;
    const gain = Math.min(ir ? 6 : 4, Math.max(1, (ir ? 120 : 105) / mean));
    const noiseAmt = 10 + gain * (ir ? 9 : 5);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4; // GL rows are bottom-up
      const dst = y * W * 4;
      const scan = y % 2 ? 0.93 : 1;
      for (let x = 0; x < W; x++) {
        const i = src + x * 4;
        let l = (this.pixels[i] * 0.299 + this.pixels[i + 1] * 0.587 + this.pixels[i + 2] * 0.114) * gain;
        l = (l - 128) * 1.1 + 128 + (Math.random() - 0.5) * noiseAmt;
        l = Math.max(0, Math.min(255, l * scan));
        const o = dst + x * 4;
        img.data[o] = l;
        img.data[o + 1] = l;
        img.data[o + 2] = l;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private noSignal(ch: CctvChannel) {
    const ctx = ch.canvas.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const l = Math.random() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = l;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = "rgba(0,0,40,0.75)";
    ctx.fillRect(W / 2 - 60, H / 2 - 14, 120, 28);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 14px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("NO SIGNAL", W / 2, H / 2 + 5);
    ctx.textAlign = "left";
  }

  private overlay(ch: CctvChannel, clock: string) {
    const ctx = ch.canvas.getContext("2d")!;
    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 2;
    ctx.fillStyle = "#f2f2f2";
    ctx.fillText(`CH${String(ch.channel).padStart(2, "0")} ${ch.label}`, 8, 16);
    ctx.textAlign = "right";
    ctx.fillText(clock, W - 8, H - 8);
    ctx.textAlign = "left";
    if (ch.online) {
      ctx.fillStyle = "#e33";
      ctx.beginPath();
      ctx.arc(W - 14, 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2f2f2";
      ctx.textAlign = "right";
      ctx.fillText("REC", W - 22, 16);
      ctx.textAlign = "left";
    }
    ctx.shadowBlur = 0;
  }

  dispose() {
    this.target.dispose();
  }
}
