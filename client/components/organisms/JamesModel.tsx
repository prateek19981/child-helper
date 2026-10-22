import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MouthPose } from "../../lib/lipsync";
import { CLOSED_MOUTH } from "../../lib/lipsync";
import type { MascotMood } from "./Mascot.styles";

const nav = globalThis.navigator as Navigator & { userAgent?: string };
if (nav && typeof nav.userAgent !== "string") {
  try {
    Object.defineProperty(nav, "userAgent", { value: "react-native", configurable: true });
  } catch {
    nav.userAgent = "react-native";
  }
}

// 83 bone matrices do not fit in the vertex-uniform limit, and Expo cannot
// upload three's float bone texture (no EXT_color_buffer_float). Pack each
// matrix element into an RGBA8 texel and read it back as a float.
const BONE_MAP_SKINNING = /* glsl */ `
#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform sampler2D jamesBoneMap;
	float jamesUnpack(vec4 c) {
		uvec4 b = uvec4(c * 255.0 + 0.5);
		return uintBitsToFloat(b.r | (b.g << 8u) | (b.b << 16u) | (b.a << 24u));
	}
	mat4 getBoneMatrix(const in float i) {
		int size = textureSize(jamesBoneMap, 0).x;
		int base = int(i) * 16;
		vec4 c0 = vec4(
			jamesUnpack(texelFetch(jamesBoneMap, ivec2(base % size, base / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 1) % size, (base + 1) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 2) % size, (base + 2) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 3) % size, (base + 3) / size), 0))
		);
		vec4 c1 = vec4(
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 4) % size, (base + 4) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 5) % size, (base + 5) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 6) % size, (base + 6) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 7) % size, (base + 7) / size), 0))
		);
		vec4 c2 = vec4(
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 8) % size, (base + 8) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 9) % size, (base + 9) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 10) % size, (base + 10) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 11) % size, (base + 11) / size), 0))
		);
		vec4 c3 = vec4(
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 12) % size, (base + 12) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 13) % size, (base + 13) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 14) % size, (base + 14) / size), 0)),
			jamesUnpack(texelFetch(jamesBoneMap, ivec2((base + 15) % size, (base + 15) / size), 0))
		);
		return mat4(c0, c1, c2, c3);
	}
#endif
`;
THREE.ShaderChunk.skinning_pars_vertex = BONE_MAP_SKINNING;

const BONE_MAP_WIDTH = 64;
const boneMaps = new WeakMap<THREE.Skeleton, THREE.DataTexture>();

const JAMES_GLB = require("@/assets/james.glb");
const JAMES_BODY = require("@/assets/james-body.jpg");
const JAMES_FACE = require("@/assets/james-face.png");
const JAMES_FALLBACK = require("@/assets/james.png");

const MOUTH_KEYS = ["mouth_open", "mouth_wide", "mouth_round"] as const;

type LoadedGltf = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

type Props = {
  mood?: MascotMood;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Mouth shape while a voice clip is playing. Ignored unless mood is speaking. */
  mouth?: MouthPose;
  /** Camera distance. Larger draws the character smaller. */
  fit?: number;
};

function boneMapFor(skeleton: THREE.Skeleton): THREE.DataTexture {
  const existing = boneMaps.get(skeleton);
  if (existing) return existing;
  const height = Math.max(1, Math.ceil((skeleton.bones.length * 16) / BONE_MAP_WIDTH));
  const data = new Uint8Array(BONE_MAP_WIDTH * height * 4);
  const tex = new THREE.DataTexture(data, BONE_MAP_WIDTH, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  boneMaps.set(skeleton, tex);
  return tex;
}

function writeBoneMaps(root: THREE.Object3D) {
  const seen = new Set<THREE.Skeleton>();
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || seen.has(mesh.skeleton)) return;
    seen.add(mesh.skeleton);
    const skeleton = mesh.skeleton;
    skeleton.update();
    const tex = boneMapFor(skeleton);
    const data = tex.image.data as Uint8Array;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const floats = skeleton.boneMatrices;
    const count = Math.min(floats.length, data.byteLength / 4);
    for (let i = 0; i < count; i++) view.setFloat32(i * 4, floats[i], true);
    tex.needsUpdate = true;
  });
}

function uploadBoneMap(renderer: THREE.WebGLRenderer, tex: THREE.DataTexture) {
  const props = renderer.properties.get(tex) as { __webglTexture?: WebGLTexture | null };
  const glTex = props.__webglTexture;
  if (!glTex) {
    tex.needsUpdate = true;
    return;
  }
  const image = tex.image as { data: ArrayBufferView; width: number; height: number };
  const gl = renderer.getContext();
  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
  tex.needsUpdate = false;
}

function hookBoneMaps(root: THREE.Object3D) {
  const seen = new Set<THREE.Skeleton>();
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const tex = boneMapFor(mesh.skeleton);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.jamesBoneMap = { value: tex };
      };
      mat.needsUpdate = true;
    }
    if (seen.has(mesh.skeleton)) return;
    seen.add(mesh.skeleton);
    mesh.onBeforeRender = (renderer) => {
      uploadBoneMap(renderer, tex);
    };
  });
}

async function fileTexture(moduleId: number): Promise<THREE.Texture> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("James texture has no local URI");
  const image = {
    localUri: uri,
    width: asset.width || 2048,
    height: asset.height || 2048,
    downloadAsync: () => asset.downloadAsync(),
  };
  const texture = new THREE.Texture(image as unknown as HTMLImageElement);
  // glTF UVs start at the top-left of the image, so the image must not be flipped.
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function applyJamesTextures(root: THREE.Object3D, body: THREE.Texture, face: THREE.Texture) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const standard = mat as THREE.MeshStandardMaterial;
      if (!standard?.isMeshStandardMaterial) continue;
      const name = standard.name.replace(/\.\d+$/, "");
      standard.metalness = 0;
      if (name.includes("Body")) {
        standard.map = body;
        standard.roughness = 0.6;
      } else if (name.includes("Brows") || name.includes("Eyes") || name.includes("Mouth")) {
        standard.map = face;
        standard.alphaTest = 0.45;
        standard.transparent = false;
        standard.side = THREE.DoubleSide;
        standard.roughness = 0.5;
      } else {
        standard.roughness = name.includes("Teeth") ? 0.4 : 0.7;
      }
      standard.needsUpdate = true;
    }
  });
}

function setMouth(root: THREE.Object3D, pose: MouthPose) {
  const values: Record<(typeof MOUTH_KEYS)[number], number> = {
    mouth_open: pose.open,
    mouth_wide: pose.wide,
    mouth_round: pose.round,
  };
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dict || !influences) return;
    for (const name of MOUTH_KEYS) {
      const index = dict[name];
      if (index != null) influences[index] = values[name];
    }
  });
}

function placeCamera(camera: THREE.PerspectiveCamera, size: THREE.Vector3, fit: number) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect > 0 ? camera.aspect : 1;
  const halfH = Math.tan(fov * 0.5);
  const halfW = halfH * aspect;
  // Fit the height and the arm span. The default fit draws him at 2x that size.
  const dist = Math.max((size.y * 0.5) / halfH, (size.x * 0.5) / halfW, 0.5) * fit;
  // Exported facing is +Z, which is the camera side.
  camera.position.set(0, size.y * 0.02, dist);
  camera.near = Math.max(dist / 100, 0.05);
  camera.far = dist * 100;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

async function readGlbBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    return await new File(uri).arrayBuffer();
  } catch (first) {
    console.warn("[JamesModel] File.arrayBuffer failed, trying fetch", first);
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`fetch(${uri}) → ${res.status}`);
    return await res.arrayBuffer();
  }
}

async function loadJames(): Promise<LoadedGltf> {
  const asset = Asset.fromModule(JAMES_GLB);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("james.glb has no local URI");
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

export function JamesModel({ mood = "idle", size = 180, style, mouth, fit = 1.85 / 2 }: Props) {
  const moodRef = useRef(mood);
  const mouthRef = useRef(mouth ?? CLOSED_MOUTH);
  const fitRef = useRef(fit);
  const frameRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const viewRef = useRef(0);
  const [ready, setReady] = useState(false);

  moodRef.current = mood;
  mouthRef.current = mouth ?? CLOSED_MOUTH;
  fitRef.current = fit;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const view = ++viewRef.current;
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    THREE.ShaderChunk.skinning_pars_vertex = BONE_MAP_SKINNING;
    try {
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
        30,
        gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1),
        0.1,
        100
      );
      scene.add(new THREE.HemisphereLight(0xfff2e0, 0x6b8cff, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(1.5, 3.5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xb8d0ff, 0.45);
      fill.position.set(-2.5, 1.5, 2);
      scene.add(fill);

      const [gltf, body, face] = await Promise.all([loadJames(), fileTexture(JAMES_BODY), fileTexture(JAMES_FACE)]);
      if (!aliveRef.current || view !== viewRef.current) return;

      const root = gltf.scene;
      applyJamesTextures(root, body, face);
      hookBoneMaps(root);
      scene.add(root);
      root.updateMatrixWorld(true);
      writeBoneMaps(root);

      const mixer = new THREE.AnimationMixer(root);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of gltf.animations ?? []) {
        const action = mixer.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        actions[clip.name] = action;
      }
      let currentClip = "";
      const playForMood = (mood: MascotMood) => {
        const name = mood === "speaking" ? "Talking" : mood === "idle" ? "Entry" : "HeadNod";
        const next = actions[name] ?? actions.Talking;
        if (!next || currentClip === name) return;
        const prev = actions[currentClip];
        next.reset().fadeIn(prev ? 0.25 : 0).play();
        prev?.fadeOut(0.25);
        currentClip = name;
      };
      playForMood(moodRef.current);

      const bounds = new THREE.Box3().setFromObject(root);
      const boundsSize = bounds.getSize(new THREE.Vector3());
      root.position.sub(bounds.getCenter(new THREE.Vector3()));
      let appliedFit = Number.NaN;
      if (aliveRef.current) setReady(true);

      const clock = new THREE.Clock();
      let elapsed = 0;
      const render = () => {
        if (!aliveRef.current || view !== viewRef.current) return;
        const dt = clock.getDelta();
        elapsed += dt;
        if (appliedFit !== fitRef.current) {
          placeCamera(camera, boundsSize, fitRef.current);
          appliedFit = fitRef.current;
        }
        playForMood(moodRef.current);
        mixer.update(dt);
        root.updateMatrixWorld(true);
        writeBoneMaps(root);
        const speaking = moodRef.current === "speaking";
        const pose = mouthRef.current;
        const driven = speaking && pose.open + pose.wide + pose.round > 0.02;
        setMouth(
          root,
          driven
            ? pose
            : speaking
              ? { open: 0.25 + 0.4 * Math.abs(Math.sin(elapsed * 9)), wide: 0, round: 0 }
              : CLOSED_MOUTH
        );
        renderer.render(scene, camera);
        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(render);
      };
      render();
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.warn("[JamesModel] failed to load:", message);
      if (err instanceof Error && err.stack) console.warn(err.stack);
    }
  };

  return (
    <View style={[{ overflow: "visible", padding: 0 }, style ?? { width: size, height: size }]}>
      {!ready ? (
        <Image source={JAMES_FALLBACK} style={StyleSheet.absoluteFill} resizeMode="contain" />
      ) : null}
      <GLView
        key={fit}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", padding: 0 }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}
