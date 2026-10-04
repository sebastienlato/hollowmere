/* Cross-module registries, filled while building the world. */
export const lights = [];        // { pos: Vector3, base, seed, zone, obj?, local? }
export const spirits = [];       // { id, obj, center: Vector3, found, dwell, reveal, zone }
export const interactives = [];  // meshes; userData: { tex, onClick, onHover, onLeave, cursor }
export const updaters = [];      // fn(dt, t, state)

export function addInteractive(mesh, handlers) {
  Object.assign(mesh.userData, handlers);
  interactives.push(mesh);
  return mesh;
}
