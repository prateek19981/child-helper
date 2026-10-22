import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MascotMood } from "./Mascot.styles";

// React Native exposes `navigator` without `userAgent`. GLTFLoader calls
// `navigator.userAgent.indexOf(...)` while parsing and throws otherwise.
const nav = globalThis.navigator as Navigator & { userAgent?: string };
if (nav && typeof nav.userAgent !== "string") {
  try {
    Object.defineProperty(nav, "userAgent", { value: "react-native", configurable: true });
  } catch {
    nav.userAgent = "react-native";
  }
}

// Expo GL does not reliably update three's float bone texture each frame, so
// skinned meshes freeze. Read bones from a uniform array instead, and push the
// values every frame from onBeforeRender (MeshStandardMaterial only uploads
// custom uniforms once unless we do this).
THREE.ShaderChunk.skinning_pars_vertex = /* glsl */ `
#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform mat4 boneMatricesArray[ BONE_COUNT ];
	mat4 getBoneMatrix( const in float i ) {
		return boneMatricesArray[ int( i ) ];
	}
#endif
`;

const BEAR_GLB = require("@/assets/koober_bear.glb");
const BEAR_FALLBACK = require("@/assets/koober-bear.png");

type LoadedGltf = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

type Props = {
  mood?: MascotMood;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type SceneHandle = {
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current?: string;
  smileLips?: THREE.Group;
  jaw?: THREE.Object3D;
  jawRest?: THREE.Quaternion;
};

function clipNameForMood(mood: MascotMood): string {
  if (mood === "speaking") return "Talking";
  return "Idle";
}

function updateSmileForMood(handle: SceneHandle, mood: MascotMood) {
  const smile = handle.smileLips;
  if (!smile) return;

  if (mood === "speaking" || mood === "retry") {
    smile.visible = false;
  } else {
    smile.visible = true;
    smile.scale.setScalar(mood === "success" ? 1.2 : 0.9);
  }
}

function playClip(handle: SceneHandle, name: string, mood: MascotMood) {
  if (handle.current !== name) {
    const next = handle.actions[name] ?? handle.actions.Idle;
    if (next) {
      const prev = handle.current ? handle.actions[handle.current] : undefined;
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
      prev?.fadeOut(0.2);
      handle.current = name;
    }
  }
  updateSmileForMood(handle, mood);
}

/** Cream + rose curved lips for a readable smile on the snout. */
function createSmileLips(): THREE.Group {
  const group = new THREE.Group();
  group.name = "SmileLips";

  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.26, 0.02, 0),
    new THREE.Vector3(0, -0.2, 0.02),
    new THREE.Vector3(0.26, 0.02, 0)
  );

  const cream = new THREE.MeshStandardMaterial({
    color: 0xf3e0cf,
    roughness: 0.65,
    metalness: 0,
  });
  const rose = new THREE.MeshStandardMaterial({
    color: 0xd46a78,
    roughness: 0.4,
    metalness: 0.02,
  });

  const rim = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.045, 10, false), cream);
  const lip = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.028, 10, false), rose);
  lip.position.z = 0.012;
  group.add(rim);
  group.add(lip);

  // Soft corners so it reads as a D-smile, not a flat line.
  const cornerGeo = new THREE.SphereGeometry(0.04, 12, 10);
  for (const x of [-0.26, 0.26]) {
    const c = new THREE.Mesh(cornerGeo, rose);
    c.position.set(x, 0.02, 0.01);
    group.add(c);
  }

  return group;
}

function attachSmileLips(root: THREE.Object3D): { smile: THREE.Group; jaw?: THREE.Bone; jawRest?: THREE.Quaternion } {
  const smile = createSmileLips();
  const head = root.getObjectByName("Head");
  const jaw = root.getObjectByName("Jaw") as THREE.Bone | undefined;

  if (head) {
    head.add(smile);
    // Head-local: sit on the snout (Jaw hangs roughly along −Z in this rig).
    smile.position.set(0, 0.12, -0.32);
    smile.rotation.set(0.35, 0, 0);
  } else {
    root.add(smile);
    smile.position.set(0, 0.15, 0.55);
  }

  return {
    smile,
    jaw: jaw ?? undefined,
    jawRest: jaw ? jaw.quaternion.clone() : undefined,
  };
}

/** Frame the full bear with padding so arms/ears are not cropped. */
function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  // Pull back far enough that arms/ears stay inside the view during Talking.
  const dist = ((maxDim * 0.5) / Math.tan(fov * 0.5)) * 2.85;
  camera.position.set(0, size.y * 0.04, dist);
  camera.near = Math.max(dist / 100, 0.05);
  camera.far = dist * 100;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return size.y;
}

function boneMatrixData(skeleton: THREE.Skeleton, count: number): Float32Array {
  // computeBoneTexture() pads the array; only the first `count` matrices are bones.
  return skeleton.boneMatrices.length >= count * 16
    ? skeleton.boneMatrices.subarray(0, count * 16)
    : skeleton.boneMatrices;
}

function skinWithUniformBones(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;

    const skeleton = mesh.skeleton;
    const count = skeleton.bones.length;
    mesh.userData.boneCount = count;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      mat.defines = { ...mat.defines, BONE_COUNT: count };
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.boneMatricesArray = { value: boneMatrixData(skeleton, count) };
        mat.userData.boneShader = shader;
      };
      mat.needsUpdate = true;
    }

    // MeshStandardMaterial only uploads custom uniforms once. Push bone matrices
    // every draw call so the pose actually animates on Expo GL.
    mesh.onBeforeRender = (renderer) => {
      skeleton.update();
      const data = boneMatrixData(skeleton, count);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const gl = renderer.getContext();

      for (const mat of list) {
        const shader = mat.userData.boneShader as
          | { uniforms: { boneMatricesArray?: { value: Float32Array } } }
          | undefined;
        if (shader?.uniforms.boneMatricesArray) {
          shader.uniforms.boneMatricesArray.value = data;
        }

        const props = (
          renderer as THREE.WebGLRenderer & {
            properties: { get: (m: THREE.Material) => { program?: { program: WebGLProgram } } };
          }
        ).properties.get(mat);
        const program = props?.program?.program;
        if (!program) continue;

        const loc =
          gl.getUniformLocation(program, "boneMatricesArray") ??
          gl.getUniformLocation(program, "boneMatricesArray[0]");
        if (loc) gl.uniformMatrix4fv(loc, false, data);
      }
    };
  });
}

async function readGlbBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    return await new File(uri).arrayBuffer();
  } catch (first) {
    console.warn("[BearModel] File.arrayBuffer failed, trying fetch", first);
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`fetch(${uri}) → ${res.status}`);
    return await res.arrayBuffer();
  }
}

async function loadBearGltf(): Promise<LoadedGltf> {
  const asset = Asset.fromModule(BEAR_GLB);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("Bear GLB has no local URI — is .glb registered in metro assetExts?");

  const buffer = await readGlbBuffer(uri);
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      "",
      (gltf) => resolve(gltf as LoadedGltf),
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
}

export function BearModel({ mood = "idle", size = 180, style }: Props) {
  const moodRef = useRef(mood);
  const handleRef = useRef<SceneHandle | null>(null);
  const frameRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    moodRef.current = mood;
    if (handleRef.current) playClip(handleRef.current, clipNameForMood(mood), mood);
  }, [mood]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      // Expo's context is also an instance of WebGLRenderingContext, which
      // three >= 0.163 rejects as WebGL 1, so three is pinned to 0.162.
      const glAny = gl as ExpoWebGLRenderingContext & {
        getContextAttributes?: () => { alpha?: boolean } | null;
      };
      if (typeof glAny.getContextAttributes !== "function" || !glAny.getContextAttributes()) {
        glAny.getContextAttributes = () => ({ alpha: true });
      }
      const canvas = {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        clientWidth: gl.drawingBufferWidth,
        clientHeight: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => gl,
      };
      const renderer = new THREE.WebGLRenderer({
        canvas: canvas as unknown as HTMLCanvasElement,
        context: gl as unknown as WebGLRenderingContext,
        alpha: true,
        antialias: true,
      });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        28,
        gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1),
        0.1,
        100
      );

      scene.add(new THREE.HemisphereLight(0xfff2e0, 0x6b8cff, 1.15));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(2.2, 4.5, 3.5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xb8d0ff, 0.55);
      fill.position.set(-3, 2, 1.5);
      scene.add(fill);

      const gltf = await loadBearGltf();
      if (!aliveRef.current) return;

      const root = gltf.scene;
      // RN cannot load GLB-embedded image blobs ("Creating blobs from ArrayBuffer
      // are not supported"), so eye colors are solid materials — reinforce here.
      const eyeColor: Record<string, number> = {
        Iris: 0x47230f,
        Sclera: 0xf7f7f2,
        Pupil: 0x050505,
      };
      root.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        const eyeMesh = /^(Iris_|Sclera_|Pupil_)/i.test(mesh.name);
        if (eyeMesh) {
          mesh.visible = true;
          mesh.renderOrder = 2;
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const m = mat as THREE.MeshStandardMaterial;
          if (!m) continue;
          // Drop maps — Expo GLTFLoader cannot create Blob textures from the GLB.
          if (m.map) {
            m.map.dispose();
            m.map = null;
          }
          const key = (m.name || "").replace(/\.\d+$/, "");
          if (eyeColor[key] != null) {
            m.color.setHex(eyeColor[key]);
            m.roughness = key === "Sclera" ? 0.45 : 0.28;
            m.metalness = 0;
            m.needsUpdate = true;
          }
        }
      });
      skinWithUniformBones(root);
      const { smile, jaw, jawRest } = attachSmileLips(root);
      // Blender/glTF export faces −Z; spin 180° so the bear looks at the camera.
      root.rotation.y = Math.PI;
      scene.add(root);
      const height = fitCameraToObject(camera, root);
      const baseY = root.position.y;
      const baseRotY = root.rotation.y;

      const mixer = new THREE.AnimationMixer(root);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of gltf.animations ?? []) {
        const action = mixer.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;
        actions[clip.name] = action;
      }
      if (!Object.keys(actions).length) {
        console.warn("[BearModel] GLB has no animation clips");
      }
      const handle: SceneHandle = { mixer, actions, smileLips: smile, jaw, jawRest };
      handleRef.current = handle;
      playClip(handle, clipNameForMood(moodRef.current), moodRef.current);
      if (aliveRef.current) setReady(true);

      const clock = new THREE.Clock();
      let elapsed = 0;
      const render = () => {
        if (!aliveRef.current) return;
        const dt = clock.getDelta();
        elapsed += dt;
        mixer.update(dt);
        // Idle is mostly blinks; keep a light bob so the mascot always feels alive.
        root.position.y = baseY + Math.sin(elapsed * 2.2) * height * 0.015;
        root.rotation.y = baseRotY + Math.sin(elapsed * 0.7) * 0.1;
        renderer.render(scene, camera);
        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(render);
      };
      render();
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.warn("[BearModel] failed to load:", message);
      if (err instanceof Error && err.stack) console.warn(err.stack);
    }
  };

  return (
    <View style={[{ width: size, height: size, overflow: "visible" }, style]}>
      {!ready ? (
        <Image source={BEAR_FALLBACK} style={{ width: size, height: size }} resizeMode="contain" />
      ) : null}
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}
