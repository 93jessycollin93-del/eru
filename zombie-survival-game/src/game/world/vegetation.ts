import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { range } from "../../sim/rng";
import type { ColliderWorld } from "./colliders";
import { TOWN_RADIUS, WORLD_HALF, type Terrain } from "./terrain";
import type { Rect } from "./town";

const inside = (x: number, z: number, r: Rect, m: number) =>
  x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m;

/** Pine forests outside town, scattered deciduous trees and bushes inside it. */
export function generateVegetation(
  rng: () => number,
  terrain: Terrain,
  colliders: ColliderWorld,
  occupied: Rect[],
): THREE.Group {
  const group = new THREE.Group();
  const density = createNoise2D(rng);
  const pines: THREE.Matrix4[] = [];
  const leafy: THREE.Matrix4[] = [];
  const bushes: THREE.Matrix4[] = [];

  const free = (x: number, z: number, margin: number) => !occupied.some((r) => inside(x, z, r, margin));
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const place = (list: THREE.Matrix4[], x: number, z: number, scale: number, trunkRadius: number) => {
    const y = terrain.height(x, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale)));
    if (trunkRadius > 0) {
      const r = trunkRadius * scale;
      colliders.add({ minX: x - r, maxX: x + r, minY: y - 1, maxY: y + 6 * scale, minZ: z - r, maxZ: z + r, occludes: true });
    }
  };

  for (let i = 0; i < 9000 && pines.length + leafy.length < 2600; i++) {
    const x = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    const z = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    const d = Math.hypot(x, z);
    const forest = density(x * 0.008, z * 0.008) * 0.5 + 0.5;
    if (d < TOWN_RADIUS + 10) {
      // A few yard trees in town.
      if (rng() > 0.04 || !free(x, z, 3)) continue;
      place(leafy, x, z, range(rng, 0.8, 1.2), 0.25);
      continue;
    }
    if (rng() > forest * forest * 1.6) continue;
    if (!free(x, z, 3)) continue;
    if (rng() < 0.78) place(pines, x, z, range(rng, 0.8, 1.5), 0.22);
    else place(leafy, x, z, range(rng, 0.8, 1.3), 0.25);
  }
  for (let i = 0; i < 1400; i++) {
    const x = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    const z = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    if (!free(x, z, 1)) continue;
    place(bushes, x, z, range(rng, 0.6, 1.3), 0);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: "#4a3a2c", roughness: 1 });
  const pineMat = new THREE.MeshStandardMaterial({ color: "#2b3d26", roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: "#46552c", roughness: 1 });
  const bushMat = new THREE.MeshStandardMaterial({ color: "#3d4a27", roughness: 1 });

  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };

  const pineTrunk = new THREE.CylinderGeometry(0.15, 0.25, 4, 6).translate(0, 2, 0);
  const pineTop = new THREE.ConeGeometry(1.8, 6.5, 7).translate(0, 5.5, 0);
  const pineTop2 = new THREE.ConeGeometry(1.3, 4, 7).translate(0, 8, 0);
  instanced(pineTrunk, trunkMat, pines);
  instanced(pineTop, pineMat, pines);
  instanced(pineTop2, pineMat, pines);

  const leafTrunk = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6).translate(0, 1.6, 0);
  const leafTop = new THREE.IcosahedronGeometry(2.2, 0).translate(0, 4.4, 0);
  instanced(leafTrunk, trunkMat, leafy);
  instanced(leafTop, leafMat, leafy);

  instanced(new THREE.IcosahedronGeometry(0.7, 0).translate(0, 0.4, 0), bushMat, bushes);

  return group;
}
