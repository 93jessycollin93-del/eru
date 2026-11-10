import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/**
 * low: phones and weak graphics. Edges smoothed after the fact, no ambient occlusion or bloom, a thin scatter of grass.
 * medium: laptops. Adds bloom, finer clouds and a fuller field of grass.
 * high: a real graphics card. Adds 4× multisampling, ambient occlusion and the densest grass.
 */
export type Quality = "low" | "medium" | "high";

/**
 * Tarkov-style grade, applied last in display space: muted colour, cool
 * shadows and warm highlights, a little contrast, vignette, film grain and
 * slight lens fringing. Saturation also drains with blood loss.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    saturation: { value: 0.78 },
    contrast: { value: 1.08 },
    shadowTint: { value: new THREE.Vector3(0.93, 0.98, 1.04) },
    highlightTint: { value: new THREE.Vector3(1.04, 1.0, 0.93) },
    vignette: { value: 0.3 },
    grain: { value: 0.045 },
    aberration: { value: 0.012 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, saturation, contrast, vignette, grain, aberration;
    uniform vec3 shadowTint, highlightTint;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + d * aberration * r2).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - d * aberration * r2).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, saturation);
      col *= mix(shadowTint, highlightTint, smoothstep(0.05, 0.75, l));
      col = (col - 0.5) * contrast + 0.5;
      col *= 1.0 - vignette * smoothstep(0.1, 0.6, r2 * 2.0);
      col += (rand(vUv * 1024.0 + fract(time * 13.0)) - 0.5) * grain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export class PostFX {
  readonly composer: EffectComposer;
  private gtao: GTAOPass;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private fxaa: ShaderPass;
  /** Multisampled render targets are only usable where float colour buffers are. */
  private msaa: boolean;
  private size = new THREE.Vector3(1, 1, 1);
  private time = 0;
  private noAO: THREE.Object3D[] = [];
  quality: Quality;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, quality: Quality) {
    const size = renderer.getSize(new THREE.Vector2());
    this.msaa = renderer.capabilities.isWebGL2 !== false && (renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
    this.composer = new EffectComposer(renderer, this.target(quality));
    this.composer.addPass(new RenderPass(scene, camera));

    this.gtao = new GTAOPass(scene, camera, size.x, size.y);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.9;
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.composer.addPass(this.gtao);
    // See-through things (window glass) stay out of the AO normal pass so they
    // neither shade themselves nor hide the occlusion of what's behind them.
    const gtao = this.gtao as unknown as { overrideVisibility: () => void };
    const hide = gtao.overrideVisibility.bind(this.gtao);
    gtao.overrideVisibility = () => {
      hide();
      for (const o of this.noAO) o.visible = false;
    };

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Low quality smooths edges after the fact (one cheap pass); high quality multisamples the scene itself.
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.quality = quality;
    this.gtao.enabled = quality === "high";
    this.bloom.enabled = quality !== "low";
    this.fxaa.enabled = !(quality === "high" && this.msaa);
  }

  /** The buffers every pass draws into: HDR, and 4× multisampled on high quality. */
  private target(q: Quality) {
    return new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q === "high" && this.msaa ? 4 : 0 });
  }

  /** Keep an object out of ambient occlusion (transparent glass). */
  excludeFromAO(o: THREE.Object3D) {
    this.noAO.push(o);
  }

  setQuality(q: Quality) {
    if (q === this.quality) return;
    const wasMultisampled = !this.fxaa.enabled;
    this.quality = q;
    this.gtao.enabled = q === "high";
    this.bloom.enabled = q !== "low";
    this.fxaa.enabled = !(q === "high" && this.msaa);
    // Multisampling is a property of the buffers: swap them when it turns on or off.
    if (wasMultisampled === this.fxaa.enabled) {
      this.composer.reset(this.target(q));
      this.setSize(this.size.x, this.size.y, this.size.z);
    }
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.size.set(w, h, pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.fxaa.material.uniforms.resolution.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
  }

  /** bloodPercent 0..100 drains colour as the survivor loses blood. */
  render(dt: number, bloodPercent = 100) {
    this.time += dt;
    const u = this.grade.uniforms;
    u.time.value = this.time;
    u.saturation.value = 0.78 * (0.25 + 0.75 * Math.min(1, bloodPercent / 100));
    this.composer.render(dt);
  }
}
