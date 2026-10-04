import * as THREE from 'three';
import { tex, planeFor } from '../assets.js';
import { COMMON, U, glowMaterial, sigilMaterial, ghostMaterial } from '../shaders.js';
import { addInteractive, updaters, spirits } from './registry.js';
import { makeCandles, makeFog } from './props.js';

function ballMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U, map: { value: map }, uEnergy: { value: 0 },
      uSphere: { value: new THREE.Vector3(0.499, 0.704, 0.39) }, uTexAspect: { value: 1024 / 1536 },
      uSwirl: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uEnergy; uniform vec3 uSphere; uniform float uTexAspect; uniform float uSwirl;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec4 t = texture2D(map, vUv);
        if(t.a < 0.01) discard;
        vec3 col = t.rgb * (0.35 + sceneLight(vWorld) * 0.5);
        vec2 q = vUv - uSphere.xy; q.y /= uTexAspect;
        vec2 sp = q / uSphere.z;
        float rr = length(sp);
        if(rr < 1.0){
          float tt = uTime * 0.3 + uSwirl;
          float ang = atan(sp.y, sp.x) + tt + (1.0 - rr) * (2.5 + uEnergy * 3.0);
          vec2 w = vec2(cos(ang), sin(ang)) * rr;
          float n = fbm(w * 2.3 + vec2(tt * 0.5, -tt * 0.35));
          float n2 = fbm(w * 4.2 - n * 1.6 + tt * 0.8);
          vec3 smoke = mix(vec3(0.32, 0.06, 0.55), vec3(0.3, 1.0, 0.62), smoothstep(0.35, 0.75, n2));
          smoke = mix(smoke, vec3(0.9, 1.0, 0.95), smoothstep(0.72, 0.95, n2) * 0.6);
          float dens = pow(clamp(n * 1.35, 0.0, 1.0), 2.2);
          float inner = smoothstep(1.0, 0.8, rr);
          col += smoke * dens * inner * (0.55 + uEnergy * 1.6);
          col += vec3(0.45, 1.0, 0.75) * pow(max(1.0 - rr, 0.0), 3.5) * (0.1 + uEnergy * 1.0);
          // keep painted glass reflections on top
          float refl = smoothstep(0.35, 0.8, dot(t.rgb, vec3(0.33)));
          col += t.rgb * refl * 0.35;
        }
        col = mix(col, uFogColor, fogFactor(vDist));
        gl_FragColor = vec4(col, t.a);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

export function buildOracle({ onTouch }) {
  const C = new THREE.Vector3(0, 1.4, -200);
  const group = new THREE.Group();
  group.position.copy(C);
  group.userData.shiftX = 2.4;

  const H = 6;
  const ballMat = ballMaterial(tex.crystal_ball);
  const ball = new THREE.Mesh(planeFor(tex.crystal_ball, H), ballMat);
  ball.userData.tex = tex.crystal_ball;
  const sphereY = (0.704 - 0.5) * H;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), glowMaterial(0x6dffb0, { intensity: 0.14, power: 2.0 }));
  glow.position.set(0, sphereY, -0.3);
  group.add(glow, ball);

  makeCandles(group, -3.5, -2.05, 0.4, 2.3, 'oracle');
  makeCandles(group, 3.6, -2.15, 0.2, 2.0, 'oracle', true);

  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), sigilMaterial(0x9b6dff, { opacity: 0.6, spin: -0.07 }));
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = -3.1;
  group.add(sigil);
  makeFog(group, 0, -2.4, 1.5, 30, 4, 0.4, 0x4d4280);
  makeFog(group, 0, 2, -8, 50, 14, 0.28, 0x3a2f5e);

  // a spirit lurks behind the oracle
  const wraith = new THREE.Mesh(planeFor(tex.ghost_wraith, 8), ghostMaterial(tex.ghost_wraith, { tint: 0xd7b8ff }));
  wraith.position.set(-6.2, 1.4, -5);
  group.add(wraith);
  spirits.push({ id: 'oracle', obj: wraith, center: new THREE.Vector3(), zone: 'oracle', found: false, dwell: 0, reveal: 0 });

  let energy = 0, burst = 0, hover = 0;
  addInteractive(ball, {
    cursor: true,
    hoverSound: 'orb',
    onHover: () => { hover = 1; },
    onLeave: () => { hover = 0; },
    onClick: () => { burst = 1; onTouch(); },
  });

  updaters.push((dt, t) => {
    if (!group.visible) return;
    burst = Math.max(0, burst - dt * 0.45);
    energy = THREE.MathUtils.lerp(energy, hover * 0.45 + burst * 1.2, 0.08);
    ballMat.uniforms.uEnergy.value = energy;
    ballMat.uniforms.uSwirl.value += dt * energy * 2.5;
    glow.material.uniforms.uIntensity.value = 0.12 + energy * 0.35 + Math.sin(t * 1.4) * 0.04;
    wraith.position.y = 1.4 + Math.sin(t * 0.6) * 0.3;
    ball.position.y = Math.sin(t * 0.8) * 0.04;
  });

  return { group };
}
