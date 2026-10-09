import * as THREE from "three";

export interface HumanoidColors {
  skin: string;
  shirt: string;
  pants: string;
  shoes?: string;
}

/**
 * A low-poly person built from boxes, with pivoted limbs so it can be
 * animated procedurally. Feet sit at y = 0, height is about 1.8 m.
 */
export class Humanoid {
  readonly root = new THREE.Group();
  /** Rotates the whole body for falling over on death. */
  readonly body = new THREE.Group();
  readonly torso: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly armL = new THREE.Group();
  readonly armR = new THREE.Group();
  readonly legL = new THREE.Group();
  readonly legR = new THREE.Group();
  /** Attach held items here; it sits in the right hand. */
  readonly hand = new THREE.Group();
  private materials: THREE.MeshStandardMaterial[] = [];
  private phase = Math.random() * Math.PI * 2;

  constructor(colors: HumanoidColors) {
    const mat = (color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      this.materials.push(m);
      return m;
    };
    const skin = mat(colors.skin);
    const shirt = mat(colors.shirt);
    const pants = mat(colors.pants);
    const shoes = mat(colors.shoes ?? "#222222");

    const part = (w: number, h: number, d: number, m: THREE.Material, parent: THREE.Object3D, y: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    this.root.add(this.body);
    this.torso = part(0.46, 0.62, 0.26, shirt, this.body, 1.2);
    part(0.44, 0.14, 0.25, pants, this.body, 0.86);
    this.head = part(0.24, 0.27, 0.26, skin, this.body, 1.66);

    // Legs pivot at the hip, arms at the shoulder.
    for (const [leg, x] of [
      [this.legL, -0.12],
      [this.legR, 0.12],
    ] as const) {
      leg.position.set(x, 0.86, 0);
      part(0.18, 0.78, 0.2, pants, leg, -0.4);
      const shoe = part(0.19, 0.1, 0.28, shoes, leg, -0.81);
      shoe.position.z = 0.04;
      this.body.add(leg);
    }
    for (const [arm, x] of [
      [this.armL, -0.31],
      [this.armR, 0.31],
    ] as const) {
      arm.position.set(x, 1.47, 0);
      part(0.14, 0.34, 0.16, shirt, arm, -0.15);
      part(0.12, 0.32, 0.13, skin, arm, -0.47);
      this.body.add(arm);
    }
    this.hand.position.set(0, -0.62, 0.02);
    this.armR.add(this.hand);
  }

  private shadows = true;
  /** Toggle shadow casting (distant characters skip it to save draw calls). */
  setShadows(on: boolean) {
    if (on === this.shadows) return;
    this.shadows = on;
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = on;
    });
  }

  setTint(hex: number) {
    for (const m of this.materials) m.emissive.setHex(hex);
  }

  /**
   * Procedural walk cycle. speed in m/s drives stride; zombie mode holds the
   * arms out and adds a limp.
   */
  animate(dt: number, speed: number, opts: { zombie?: boolean; crouch?: boolean; aim?: boolean; attack?: number } = {}) {
    const stride = Math.min(1, speed / 3);
    this.phase += dt * (3 + speed * 2.2);
    const swing = Math.sin(this.phase) * 0.7 * stride;

    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    const crouch = opts.crouch ? 1 : 0;
    this.body.position.y = -0.28 * crouch + Math.abs(Math.cos(this.phase)) * 0.04 * stride;
    this.torso.rotation.x = 0.35 * crouch;
    if (crouch) {
      this.legL.rotation.x = swing * 0.6 - 0.5;
      this.legR.rotation.x = -swing * 0.6 - 0.5;
    }

    if (opts.zombie) {
      const sway = Math.sin(this.phase * 0.5) * 0.12;
      this.armL.rotation.x = -1.35 + sway;
      this.armR.rotation.x = -1.45 - sway;
      this.armL.rotation.z = 0.08;
      this.armR.rotation.z = -0.08;
      this.head.rotation.z = Math.sin(this.phase * 0.3) * 0.25;
      this.head.rotation.x = 0.2;
      this.torso.rotation.x = 0.15;
    } else {
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = opts.aim ? -1.5 : swing * 0.8;
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
    }

    // Attack swing: 0 → 1 over the attack, arm whips down across the body.
    if (opts.attack !== undefined && opts.attack > 0) {
      const t = opts.attack;
      const arc = t < 0.4 ? -2.6 * (t / 0.4) : -2.6 + 3.2 * ((t - 0.4) / 0.6);
      this.armR.rotation.x = arc;
      this.armR.rotation.z = -0.3;
      if (opts.zombie) this.armL.rotation.x = arc;
    }
  }

  /** Lie the body on the ground. t goes 0 → 1. */
  fall(t: number) {
    const e = Math.min(1, t);
    this.body.rotation.x = -(Math.PI / 2) * (e * e);
    this.body.position.y = 0.12 * e;
    this.body.position.z = 0.9 * e;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

/** Simple held-item meshes. */
export function makeHeldItem(id: string): THREE.Object3D | null {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, color: string, y: number, z = 0) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }),
    );
    m.position.set(0, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (id) {
    case "pistol":
      box(0.05, 0.12, 0.06, "#1d1d1d", -0.02);
      box(0.05, 0.06, 0.22, "#262626", 0.03, 0.08);
      // Barrel (local +z) points out of the fist along the forearm.
      g.rotation.x = Math.PI / 2;
      return g;
    case "baseball_bat":
      box(0.05, 0.85, 0.05, "#8a6a42", -0.38);
      box(0.08, 0.35, 0.08, "#8a6a42", -0.7);
      g.rotation.x = -Math.PI / 2;
      return g;
    case "fire_axe":
      box(0.05, 0.9, 0.05, "#7a2a20", -0.4);
      box(0.04, 0.18, 0.28, "#9aa0a6", -0.8, 0.1);
      g.rotation.x = -Math.PI / 2;
      return g;
    case "kitchen_knife":
      box(0.03, 0.1, 0.03, "#222", -0.03);
      box(0.015, 0.2, 0.04, "#c0c4c8", -0.17);
      g.rotation.x = -Math.PI / 2;
      return g;
    default:
      return null;
  }
}
