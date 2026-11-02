import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Surface, TextureLibrary } from "../render/textures";

/**
 * Collects many small static geometries and merges them into one mesh per
 * material, so the whole town renders in a few dozen draw calls. Texture
 * coordinates are projected in world space (box mapping), so surfaces keep a
 * real-world scale no matter how big each box is.
 */
export class MeshBuilder {
  private buckets = new Map<string, THREE.BufferGeometry[]>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private tiles = new Map<string, number>();

  constructor(private textures?: TextureLibrary) {}

  material(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}, surface?: Surface) {
    const key = color + JSON.stringify(opts) + (surface ?? "");
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...opts });
      if (surface && this.textures) {
        const maps = this.textures.get(surface);
        mat.map = maps.map;
        mat.normalMap = maps.normalMap;
        mat.roughnessMap = maps.roughnessMap;
        mat.normalScale.set(0.8, 0.8);
        this.tiles.set(key, maps.tile);
      }
      this.materials.set(key, mat);
    }
    return key;
  }

  getMaterial(key: string) {
    return this.materials.get(key);
  }

  add(geo: THREE.BufferGeometry, materialKey: string) {
    let bucket = this.buckets.get(materialKey);
    if (!bucket) this.buckets.set(materialKey, (bucket = []));
    // Strip to the attributes every geometry shares so merging never fails.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") geo.deleteAttribute(name);
    }
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const tile = this.tiles.get(materialKey);
    if (tile) projectUVs(g, tile);
    bucket.push(g);
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

/** Box-project texture coordinates from world position, picking the axis each face points along. */
function projectUVs(g: THREE.BufferGeometry, tile: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  // Use the face normal (first vertex of each triangle) so a face never splits across projections.
  for (let i = 0; i < pos.count; i += 3) {
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const nz = Math.abs(nrm.getZ(i));
    for (let k = i; k < i + 3 && k < pos.count; k++) {
      const x = pos.getX(k);
      const y = pos.getY(k);
      const z = pos.getZ(k);
      let u: number, v: number;
      if (ny >= nx && ny >= nz) [u, v] = [x, z];
      else if (nx >= nz) [u, v] = [z, y];
      else [u, v] = [x, y];
      uv[k * 2] = u / tile;
      uv[k * 2 + 1] = v / tile;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
