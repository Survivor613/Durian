"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

type TableSceneProps = { isDrawing: boolean; canDraw?: boolean };

// 模块级加载卡背纹理：避免 useLoader 的 Suspense 在组件树中没有边界时导致白屏
let cardBackTexture: THREE.Texture | null = null;
if (typeof window !== "undefined") {
  cardBackTexture = new THREE.TextureLoader().load("/assets/card-back.png");
  cardBackTexture.colorSpace = THREE.SRGBColorSpace;
  cardBackTexture.anisotropy = 4;
}

const glowColor = new THREE.Color("#f0a34b");

function DeckModel({ isDrawing, canDraw, xPos, zPos }: TableSceneProps & { xPos: number; zPos: number }) {
  const deck = useRef<THREE.Group>(null);
  const drawStartRef = useRef<number | null>(null);
  useFrame(({ clock }, delta) => {
    if (!deck.current) return;
    // 轮到你抽牌时：牌堆自身发光呼吸（贴着牌堆轮廓亮，而不是外框）
    const target = canDraw ? 0.34 + 0.26 * Math.sin(clock.elapsedTime * 4.2) : 0;
    const glow = THREE.MathUtils.damp(deck.current.userData.glow ?? 0, target, 10, delta);
    deck.current.userData.glow = glow;
    for (const child of deck.current.children) {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material?.emissive) {
        material.emissive.copy(glowColor);
        material.emissiveIntensity = glow;
      }
    }
    const topCard = deck.current.children[deck.current.children.length - 1] as THREE.Mesh | undefined;
    if (!topCard) return;
    const material = topCard.material as THREE.MeshStandardMaterial;
    // 抽牌：顶牌先被捻起，再朝玩家方向抽出并消失，是一次完整"取走第一张"的动作
    if (isDrawing && drawStartRef.current === null) drawStartRef.current = clock.elapsedTime;
    if (!isDrawing) drawStartRef.current = null;
    if (drawStartRef.current === null) {
      // 复位：顶牌安静躺在牌堆上（与 JSX 里 index=8 的初始摆放一致）
      topCard.visible = true;
      topCard.position.set(0.045, 0.08 + 8 * 0.05, 0);
      topCard.rotation.z = -0.012;
      material.transparent = false;
      material.opacity = 1;
      return;
    }
    const t = clock.elapsedTime - drawStartRef.current;
    const lift = THREE.MathUtils.smoothstep(t, 0, 0.18);   // 捻起
    const sweep = THREE.MathUtils.smoothstep(t, 0.18, 0.75); // 朝玩家抽出
    const gone = t > 1.05;                                  // 已收进手里
    topCard.visible = !gone;
    topCard.position.set(0.045 + sweep * 0.5, 0.08 + 8 * 0.05 + lift * 0.35 + sweep * 1.1, sweep * 4.2);
    topCard.rotation.z = -0.012 + lift * 0.1 + sweep * 0.55;
    material.transparent = sweep > 0;
    material.opacity = 1 - THREE.MathUtils.smoothstep(t, 0.6, 1.0);
  });

  return <group ref={deck} position={[xPos, 0.05, zPos]} rotation={[0, -0.14, 0.05]}>
    {Array.from({ length: 9 }, (_, index) => <RoundedBox key={index} args={[1.35, 0.09, 2.0]} radius={0.06} smoothness={3} position={[((index * 7) % 3 - 1) * 0.045, 0.08 + index * 0.05, ((index * 5) % 3 - 1) * 0.04]} rotation={[0, (index % 2 ? 1 : -1) * (0.03 + (index % 3) * 0.02), (index % 2 ? 0.012 : -0.012)]}>
      <meshStandardMaterial map={cardBackTexture ?? undefined} color={cardBackTexture ? "#ffffff" : "#633525"} roughness={0.75} metalness={0.03} />
    </RoundedBox>)}
  </group>;
}

function CanvasLifecycle({ onReady, onUnavailable }: { onReady: () => void; onUnavailable: () => void }) {
  const gl = useThree((three) => three.gl);
  const renderedRef = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      renderedRef.current = false;
      onUnavailable();
    };
    const handleRestored = () => {
      renderedRef.current = false;
      onUnavailable();
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [gl, onUnavailable]);

  useFrame(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;
    onReady();
  });
  return null;
}

function SceneContents({ isDrawing, canDraw }: TableSceneProps) {
  // 正交相机 + 固定 zoom：牌堆离屏幕中心的距离是固定像素数，画布越矮牌堆相对越靠上，
  // 导致手机上牌堆显示位置和 DOM 的点击热区错位。
  // 按画布实际高度反推 z，让牌堆始终落在距顶部约 66% 的位置（屏幕下半，z 为正即靠镜头一侧），
  // 与热区（top 66% 附近）重合；同理按画布宽度反推 x，与热区的水平位置（left 67%）重合。
  const size = useThree((three) => three.size);
  const deckZ = ((0.66 - 0.5) * size.height / 52) * Math.SQRT2;
  const deckX = ((0.67 - 0.5) * size.width) / 52;
  return <>
    <ambientLight intensity={1.35} />
    <directionalLight position={[-3, 7, 4]} intensity={2.3} castShadow />
    <DeckModel isDrawing={isDrawing} canDraw={canDraw} xPos={deckX} zPos={deckZ} />
  </>;
}

export function TableScene({ isDrawing, canDraw }: TableSceneProps) {
  const [canvasReady, setCanvasReady] = useState(false);
  const handleReady = useCallback(() => setCanvasReady(true), []);
  const handleUnavailable = useCallback(() => setCanvasReady(false), []);

  return <div className={`table-scene ${canvasReady ? "is-ready" : ""}`} aria-hidden="true">
    <Canvas
      orthographic
      camera={{ position: [0, 7, 7], zoom: 52 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      fallback={<div className="table-scene-fallback" />}
      style={{ background: "transparent" }}
    >
      <CanvasLifecycle onReady={handleReady} onUnavailable={handleUnavailable} />
      <SceneContents isDrawing={isDrawing} canDraw={canDraw} />
    </Canvas>
  </div>;
}
