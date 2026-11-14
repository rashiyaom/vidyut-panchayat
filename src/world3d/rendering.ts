import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/** Contact shading separates small facade details without darkening the whole scene. */
export function createRendering(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 2,
  });
  const composer = new EffectComposer(renderer, target);
  const render = new RenderPass(scene, camera);
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({
    radius: 2.2,
    distanceExponent: 1.5,
    thickness: 1.2,
    distanceFallOff: 1,
    scale: 1,
    samples: 8,
  });
  ao.updatePdMaterial({ radius: 4, samples: 8 });
  ao.blendIntensity = 0.65;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.45, 0.95);
  bloom.enabled = false;
  const output = new OutputPass();
  composer.addPass(render);
  composer.addPass(ao);
  composer.addPass(bloom);
  composer.addPass(output);
  renderer.info.autoReset = false;
  return {
    setNight(amount: number) {
      bloom.enabled = amount > 0.01;
      bloom.strength = amount * 0.28;
      ao.enabled = amount < 0.5;
    },
    resize(width: number, height: number) {
      composer.setSize(width, height);
      // Lower-resolution AO keeps the full-resolution color pass sharp.
      const ratio = renderer.getPixelRatio();
      ao.setSize(
        Math.round(width * ratio * 0.5),
        Math.round(height * ratio * 0.5),
      );
    },
    render() {
      renderer.info.reset();
      composer.render();
    },
    dispose() {
      ao.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
