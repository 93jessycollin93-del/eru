import * as THREE from "three";

/**
 * The sky: a gradient that follows the clock, broken cloud that drifts and is lit from the sun's side,
 * a sun disc that burns through thin cloud, and stars and a moon at night. One dome, one shader.
 *
 * The same shader also lights the world. Every so often the sky is rendered into a small cube map and
 * filtered (PMREM) into `environment`, which every PBR material uses for ambient light and
 * reflections: car paint and glass mirror the clouds, walls pick up the sky's colour, and night is
 * dark because the sky is. That costs a few milliseconds every ten game minutes, nothing per frame.
 */

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 horizon, zenith, sunColor, sunDir, cloudLit, cloudDark, groundColor;
  uniform float daylight, cover, time, forEnv, sunDisc;
  varying vec3 vDir;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      s += a * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 dir = normalize(vDir);
    vec3 sun = normalize(sunDir);
    float up = max(dir.y, 0.0);
    float toSun = max(dot(dir, sun), 0.0);

    // Clear sky behind the cloud: deeper overhead, pale at the horizon, warm round a low sun.
    vec3 col = mix(horizon, zenith, pow(up, 0.5));
    col += sunColor * (pow(toSun, 6.0) * 0.25 + pow(toSun, 64.0) * 0.6) * daylight;

    // Stars and a moon, only when it's dark (the "sun" direction is the moon's at night).
    float night = 1.0 - smoothstep(0.0, 0.25, daylight);
    if (night > 0.0 && dir.y > 0.0) {
      vec2 sp = dir.xz / (dir.y + 0.35) * 160.0;
      vec2 cell = floor(sp);
      float star = hash(cell);
      vec2 off = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float d = length(fract(sp) - 0.5 - off * 0.6);
      float twinkle = 0.75 + 0.25 * sin(time * 2.0 + star * 60.0);
      col += vec3(0.85, 0.9, 1.0) * step(0.965, star) * smoothstep(0.12, 0.0, d) * twinkle * night * 1.6 * smoothstep(0.0, 0.2, dir.y);
      float moon = smoothstep(0.9994, 0.9997, dot(dir, sun));
      col = mix(col, vec3(0.9, 0.93, 1.0) * 1.8, moon * night);
      col += vec3(0.35, 0.42, 0.6) * pow(toSun, 300.0) * 0.5 * night;
    }

    // Cloud layer on a plane overhead, drifting with the wind; lit from the sun's side.
    float sunThrough = 1.0;
    if (dir.y > -0.02) {
      vec2 uv = dir.xz / (dir.y + 0.16) * 1.15 + vec2(time * 0.006, time * 0.0025);
      float base = fbm(uv);
      #if OCTAVES > 3
        float density = smoothstep(1.0 - cover - 0.12, 1.0 - cover + 0.3, base + 0.18 * fbm(uv * 3.1 + 40.0));
        // Thicker cloud between here and the sun is darker; edges facing it are bright.
        float toward = fbm(uv + normalize(sun.xz + 0.001) * 0.22);
        float shade = clamp(0.5 + (base - toward) * 2.2, 0.0, 1.0);
      #else
        // Low quality: one noise lookup. Thick cloud is dark, thin cloud bright.
        float density = smoothstep(1.0 - cover - 0.12, 1.0 - cover + 0.3, base);
        float shade = clamp(1.4 - base * 1.6, 0.0, 1.0);
      #endif
      vec3 cloud = mix(cloudDark, cloudLit, shade);
      cloud += sunColor * pow(toSun, 10.0) * (1.0 - density) * 0.5 * daylight;
      // Distant cloud fades into the haze on the horizon.
      float haze = smoothstep(0.0, 0.22, dir.y);
      col = mix(col, cloud, density * haze);
      sunThrough = 1.0 - density * 0.94;
    }

    // The sun's disc, where cloud lets it through.
    col += sunColor * smoothstep(0.99955, 0.9998, dot(dir, sun)) * 28.0 * sunThrough * daylight * sunDisc;

    // Below the horizon: fog colour for the eye (distant ground fades into it), ground colour for lighting.
    vec3 below = mix(horizon, groundColor, forEnv);
    col = mix(below, col, smoothstep(-0.06, 0.03, dir.y));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const DAY_ZENITH = new THREE.Color("#4f6f95");
const OVERCAST_ZENITH = new THREE.Color("#7b858c");
const NIGHT_ZENITH = new THREE.Color("#04060b");
const DUSK_SUN = new THREE.Color("#ff9a5a");
const DAY_SUN = new THREE.Color("#fff0dc");
const MOON = new THREE.Color("#8fa3cc");
const GROUND = new THREE.Color("#3a3d2c");

export class SkyDome {
  readonly mesh: THREE.Mesh;
  /** Filtered sky for image-based lighting: assign to scene.environment. */
  environment: THREE.Texture | null = null;
  private uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color() },
    cloudLit: { value: new THREE.Color() },
    cloudDark: { value: new THREE.Color() },
    groundColor: { value: new THREE.Color() },
    daylight: { value: 1 },
    cover: { value: 0.6 },
    time: { value: 0 },
    forEnv: { value: 0 },
    sunDisc: { value: 1 },
  };
  private material: THREE.ShaderMaterial;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envScene = new THREE.Scene();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = "";
  private tmp = new THREE.Color();

  constructor(detail: "low" | "medium" | "high" = "high") {
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      defines: { OCTAVES: detail === "low" ? 3 : 5 },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader,
      fragmentShader,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    // A second dome with the same material, in its own scene, is what gets filtered into the environment.
    const envDome = new THREE.Mesh(this.mesh.geometry, this.material);
    envDome.frustumCulled = false;
    this.envScene.add(envDome);
  }

  setDetail(detail: "low" | "medium" | "high") {
    const octaves = detail === "low" ? 3 : 5;
    if (this.material.defines.OCTAVES === octaves) return;
    this.material.defines.OCTAVES = octaves;
    this.material.needsUpdate = true;
  }

  /**
   * horizon: the fog colour (the dome meets the fogged land in it). cover 0 (clear) to 1 (solid overcast).
   * dusk 0–1 peaks at sunrise and sunset.
   */
  update(horizon: THREE.Color, sunDir: THREE.Vector3, daylight: number, dusk: number, cover: number, dt: number, camera: THREE.Camera) {
    const u = this.uniforms;
    u.time.value += dt;
    u.daylight.value = daylight;
    u.cover.value = cover;
    u.horizon.value.copy(horizon);
    u.sunDir.value.copy(sunDir).normalize();
    // Zenith: blue through the gaps on a clear day, grey under heavy cloud, near black at night.
    u.zenith.value.copy(DAY_ZENITH).lerp(OVERCAST_ZENITH, cover * 0.75).multiplyScalar(0.25 + 0.75 * daylight).lerp(NIGHT_ZENITH, 1 - daylight);
    u.sunColor.value.copy(DAY_SUN).lerp(DUSK_SUN, dusk);
    if (daylight < 0.05) u.sunColor.value.copy(MOON);
    // Clouds take their light from the sky: bright tops by day, ember-lit at dusk, barely there at night.
    const lit = 0.05 + 0.95 * daylight;
    u.cloudLit.value.set("#e9ecee").lerp(this.tmp.set("#ffc9a0"), dusk * 0.8).multiplyScalar(lit);
    u.cloudDark.value.set("#6b7379").lerp(this.tmp.set("#4a4552"), dusk * 0.7).multiplyScalar(lit * (1 - cover * 0.25));
    u.groundColor.value.copy(GROUND).multiplyScalar(0.1 + 0.9 * daylight);
    this.mesh.position.copy(camera.position);
  }

  /**
   * Re-filter the sky into the environment map if the light has changed enough since last time
   * (`key` should change when it has: the caller passes a coarse time stamp). Returns true when it did.
   */
  updateEnvironment(renderer: THREE.WebGLRenderer, key: string): boolean {
    if (key === this.envKey && this.environment) return false;
    this.envKey = key;
    this.pmrem ??= new THREE.PMREMGenerator(renderer);
    const u = this.uniforms;
    u.forEnv.value = 1;
    // The sun's disc is a point of 28× white: filtered, it speckles rough surfaces. The sun light does that job.
    u.sunDisc.value = 0;
    const next = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
    u.forEnv.value = 0;
    u.sunDisc.value = 1;
    this.envTarget?.dispose();
    this.envTarget = next;
    this.environment = next.texture;
    return true;
  }
}
