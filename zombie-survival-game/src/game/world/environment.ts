import * as THREE from "three";

const lerpColor = (a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) => out.copy(a).lerp(b, t);

const SKY_DAY = new THREE.Color("#8d979b");
const SKY_DUSK = new THREE.Color("#7a5a4e");
const SKY_NIGHT = new THREE.Color("#0b0f16");

/** Sun, moon, ambient light and fog driven by the in-game clock. */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly skyColor = new THREE.Color();
  /** Direction towards the sun (or moon at night). */
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  /** 0–1, peaking at sunrise and sunset. */
  dusk = 0;
  /**
   * Whether the filtered sky (scene.environment) is lighting the world. When it isn't (Low quality),
   * the hemisphere light does the whole job of ambient light, as it used to.
   */
  skyLit = true;
  private fog: THREE.FogExp2;
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private snapped = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.fog = new THREE.FogExp2(SKY_DAY.getHex(), 0.012);
    scene.fog = this.fog;
    scene.background = this.skyColor;

    this.hemi = new THREE.HemisphereLight("#b9c4c9", "#7a7462", 0.6);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff1dc", 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -45;
    s.right = 45;
    s.top = 45;
    s.bottom = -45;
    s.near = 1;
    s.far = 200;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);
  }

  /** How bright it is, 0 (night) .. 1 (noon). Zombies use this for sight range. */
  daylight(minutes: number): number {
    const h = minutes / 60;
    // Sunrise 6:00, sunset 20:00, with an hour of twilight either side.
    if (h < 5 || h > 21) return 0;
    if (h < 7) return (h - 5) / 2;
    if (h > 19) return (21 - h) / 2;
    return 1;
  }

  /**
   * How much of the sky is cloud, 0.3 (broken) to 0.92 (solid overcast), drifting over hours and
   * days. A fixed function of the game clock: the same day always has the same weather.
   */
  cloudCover(totalMinutes: number): number {
    const t = totalMinutes / 1440;
    const n = Math.sin(t * 2.1 + 0.6) * 0.5 + Math.sin(t * 5.3 + 2.0) * 0.3 + Math.sin(t * 0.37 + 4.0) * 0.4;
    return Math.max(0.3, Math.min(0.92, 0.66 + n * 0.26));
  }

  update(minutes: number, focus: THREE.Vector3, cover = 0.66) {
    const light = this.daylight(minutes);
    const h = minutes / 60;
    const dusk = light > 0 && light < 1 ? 1 - Math.abs(light - 0.5) * 2 : 0;
    this.dusk = dusk;

    // Sun arcs east to west; at night the "sun" is a dim bluish moon.
    const angle = ((h - 6) / 14) * Math.PI;
    const isDay = light > 0.02;
    const dir = isDay
      ? new THREE.Vector3(Math.cos(angle) * 80, Math.max(12, Math.sin(angle) * 90), 35)
      : new THREE.Vector3(-30, 70, -40);
    this.sunDir.copy(dir).normalize();
    // Move the shadow map in whole texels, so shadow edges don't shimmer as you walk.
    const cam = this.sun.shadow.camera;
    const texel = (cam.right - cam.left) / this.sun.shadow.mapSize.x;
    this.right.set(0, 1, 0).cross(this.sunDir).normalize();
    this.up.copy(this.sunDir).cross(this.right);
    const fx = focus.dot(this.right);
    const fy = focus.dot(this.up);
    this.snapped
      .copy(focus)
      .addScaledVector(this.right, Math.round(fx / texel) * texel - fx)
      .addScaledVector(this.up, Math.round(fy / texel) * texel - fy);
    this.sun.position.copy(this.snapped).add(dir);
    this.sun.target.position.copy(this.snapped);
    // Heavy cloud takes the edge off the sun: softer shadows, flatter light.
    const through = 1 - Math.max(0, cover - 0.35) * 0.9;
    // By night it's the moon: enough, through broken cloud, to make out shapes and find your way.
    this.sun.intensity = isDay ? (0.3 + light * 2.4) * through : 0.95 * through;
    this.sun.color.set(isDay ? (dusk > 0.3 ? "#ffb98a" : "#fff1dc") : "#7d8fb3");
    // The filtered sky (scene.environment) is the ambient light now; this is a floor under it,
    // so shadowed sides stay readable and nights dark but navigable.
    this.hemi.intensity = this.skyLit ? (isDay ? 0.1 + light * 0.22 : 0.55) : isDay ? 0.4 + light * 0.95 : 0.6;
    this.hemi.color.set(isDay ? "#c4ced3" : "#4a5878");

    if (light >= 1) this.skyColor.copy(SKY_DAY);
    else if (light <= 0) this.skyColor.copy(SKY_NIGHT);
    else if (light < 0.5) lerpColor(SKY_NIGHT, SKY_DUSK, light * 2, this.skyColor);
    else lerpColor(SKY_DUSK, SKY_DAY, (light - 0.5) * 2, this.skyColor);

    this.fog.color.copy(this.skyColor);
    this.fog.density = 0.0075 + (1 - light) * 0.018;
  }
}
