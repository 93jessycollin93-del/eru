import * as THREE from "three";

/** Overcast sky dome: a vertical gradient with a soft sun glow through cloud. */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private uniforms = {
    zenith: { value: new THREE.Color("#7d8a92") },
    horizon: { value: new THREE.Color("#a7b0b2") },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color("#fff1dc") },
    sunStrength: { value: 0.3 },
  };

  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 zenith, horizon, sunColor, sunDir;
        uniform float sunStrength;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.6));
          float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 8.0);
          col += sunColor * glow * sunStrength;
          // Below the horizon fades into the fog colour.
          col = mix(horizon, col, smoothstep(-0.05, 0.05, vDir.y));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(horizon: THREE.Color, sunDir: THREE.Vector3, daylight: number, camera: THREE.Camera) {
    this.uniforms.horizon.value.copy(horizon);
    // Zenith is a touch darker and cooler than the horizon, as under cloud cover.
    this.uniforms.zenith.value.copy(horizon).multiplyScalar(0.78).lerp(new THREE.Color("#5c6b78"), 0.15 * daylight);
    this.uniforms.sunDir.value.copy(sunDir).normalize();
    this.uniforms.sunStrength.value = 0.35 * daylight;
    this.mesh.position.copy(camera.position);
  }
}
