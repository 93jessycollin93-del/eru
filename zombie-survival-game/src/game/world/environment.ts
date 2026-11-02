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
  private fog: THREE.FogExp2;

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

  update(minutes: number, focus: THREE.Vector3) {
    const light = this.daylight(minutes);
    const h = minutes / 60;
    const dusk = light > 0 && light < 1 ? 1 - Math.abs(light - 0.5) * 2 : 0;

    // Sun arcs east to west; at night the "sun" is a dim bluish moon.
    const angle = ((h - 6) / 14) * Math.PI;
    const isDay = light > 0.02;
    const dir = isDay
      ? new THREE.Vector3(Math.cos(angle) * 80, Math.max(12, Math.sin(angle) * 90), 35)
      : new THREE.Vector3(-30, 70, -40);
    this.sun.position.copy(focus).add(dir);
    this.sunDir.copy(dir).normalize();
    this.sun.target.position.copy(focus);
    this.sun.intensity = isDay ? 0.3 + light * 2.0 : 0.35;
    this.sun.color.set(isDay ? (dusk > 0.3 ? "#ffb98a" : "#fff1dc") : "#7d8fb3");
    // Strong sky fill keeps shadowed sides readable; nights stay dark but navigable.
    this.hemi.intensity = 0.35 + light * 1.0;
    this.hemi.color.set(isDay ? "#c4ced3" : "#4a5878");

    if (light >= 1) this.skyColor.copy(SKY_DAY);
    else if (light <= 0) this.skyColor.copy(SKY_NIGHT);
    else if (light < 0.5) lerpColor(SKY_NIGHT, SKY_DUSK, light * 2, this.skyColor);
    else lerpColor(SKY_DUSK, SKY_DAY, (light - 0.5) * 2, this.skyColor);

    this.fog.color.copy(this.skyColor);
    this.fog.density = 0.0075 + (1 - light) * 0.018;
  }
}
