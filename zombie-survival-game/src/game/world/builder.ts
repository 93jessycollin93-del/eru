import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Collects many small static geometries and merges them into one mesh per
 * colour, so the whole town renders in a few dozen draw calls.
 */
export class MeshBuilder {
  private buckets = new Map<string, THREE.BufferGeometry[]>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();

  material(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = color + JSON.stringify(opts);
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...opts });
      this.materials.set(key, mat);
    }
    return key;
  }

  add(geo: THREE.BufferGeometry, materialKey: string) {
    let bucket = this.buckets.get(materialKey);
    if (!bucket) this.buckets.set(materialKey, (bucket = []));
    // Strip to the attributes every geometry shares so merging never fails.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") geo.deleteAttribute(name);
    }
    bucket.push(geo.index ? geo.toNonIndexed() : geo);
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    for (const [key, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.materials.get(key));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.buckets.clear();
    return group;
  }
}
