"use client";

import React, { useRef, Suspense } from "react";
import { cn } from "@/lib/utils";

// Lazy load three.js components to avoid SSR/build issues
const Canvas = React.lazy(() =>
    import("@react-three/fiber").then(mod => ({ default: mod.Canvas }))
);
const PerspectiveCamera = React.lazy(() =>
    import("@react-three/drei").then(mod => ({ default: mod.PerspectiveCamera }))
);

interface DotGlobeHeroProps {
    rotationSpeed?: number;
    globeRadius?: number;
    className?: string;
    children?: React.ReactNode;
}

// Simple fallback component
const GlobeFallback = () => (
    <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/5 animate-pulse" />
    </div>
);

const Globe: React.FC<{
    rotationSpeed: number;
    radius: number;
}> = ({ rotationSpeed, radius }) => {
    const groupRef = useRef<any>(null);

    // Use useFrame only if available
    try {
        const { useFrame } = require("@react-three/fiber");
        useFrame(() => {
            if (groupRef.current) {
                groupRef.current.rotation.y += rotationSpeed;
                groupRef.current.rotation.x += rotationSpeed * 0.3;
                groupRef.current.rotation.z += rotationSpeed * 0.1;
            }
        });
    } catch (e) {
        // Fallback if useFrame not available
    }

    return (
        <group ref={groupRef}>
            <mesh>
                <sphereGeometry args={[radius, 64, 64]} />
                <meshBasicMaterial
                    color="#8b5cf6"
                    transparent
                    opacity={0.15}
                    wireframe
                />
            </mesh>
        </group>
    );
};

const DotGlobeHero = React.forwardRef<
    HTMLDivElement,
    DotGlobeHeroProps
>(({
    rotationSpeed = 0.005,
    globeRadius = 1,
    className,
    children,
    ...props
}, ref) => {
    const [hasError, setHasError] = React.useState(false);

    return (
        <div
            ref={ref}
            className={cn(
                "relative w-full min-h-screen bg-background overflow-hidden",
                className
            )}
            {...props}
        >
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
                {children}
            </div>

            {!hasError ? (
                <Suspense fallback={<GlobeFallback />}>
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <Canvas onError={() => setHasError(true)}>
                            <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={75} />
                            <ambientLight intensity={0.5} />
                            <pointLight position={[10, 10, 10]} intensity={1} />

                            <Globe
                                rotationSpeed={rotationSpeed}
                                radius={globeRadius}
                            />
                        </Canvas>
                    </div>
                </Suspense>
            ) : (
                <GlobeFallback />
            )}
        </div>
    );
});

DotGlobeHero.displayName = "DotGlobeHero";

export { DotGlobeHero, type DotGlobeHeroProps };
