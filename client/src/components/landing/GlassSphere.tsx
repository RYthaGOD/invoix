import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

// Simplified continent coordinates (latitude, longitude)
const continentData = {
  northAmerica: [
    [-170, 70], [-140, 70], [-130, 60], [-125, 50], [-125, 40], [-120, 35],
    [-115, 32], [-105, 30], [-100, 28], [-95, 29], [-90, 30], [-85, 28],
    [-80, 25], [-75, 25], [-70, 22], [-65, 10], [-82, 8], [-90, 15],
    [-95, 18], [-100, 20], [-105, 25], [-110, 30], [-120, 35], [-130, 42],
    [-140, 55], [-160, 65], [-170, 70]
  ],
  southAmerica: [
    [-80, 12], [-75, 10], [-70, 5], [-65, 0], [-60, -5], [-55, -10],
    [-52, -20], [-55, -30], [-60, -40], [-65, -50], [-70, -55],
    [-72, -50], [-75, -40], [-78, -30], [-80, -15], [-82, -5], [-80, 5],
    [-80, 12]
  ],
  europe: [
    [-10, 60], [0, 60], [10, 58], [20, 55], [30, 60], [40, 55],
    [45, 50], [40, 45], [30, 40], [20, 35], [10, 36], [0, 38],
    [-8, 43], [-10, 50], [-10, 60]
  ],
  africa: [
    [-18, 35], [-10, 32], [0, 30], [10, 33], [20, 30], [30, 25],
    [40, 15], [50, 10], [52, 0], [50, -10], [40, -20], [30, -25],
    [20, -30], [15, -35], [20, -34], [30, -30], [35, -25], [40, -18],
    [35, -10], [30, 0], [25, 10], [20, 15], [10, 20], [0, 15],
    [-10, 10], [-15, 15], [-18, 25], [-18, 35]
  ],
  asia: [
    [40, 60], [50, 65], [60, 70], [70, 75], [80, 70], [90, 65],
    [100, 60], [110, 55], [120, 50], [130, 45], [140, 40], [145, 35],
    [140, 30], [130, 25], [120, 22], [110, 20], [100, 10], [95, 5],
    [90, 0], [85, 5], [80, 10], [70, 15], [60, 20], [50, 25],
    [45, 30], [40, 40], [40, 50], [40, 60]
  ],
  australia: [
    [115, -10], [125, -12], [135, -15], [145, -20], [150, -25],
    [153, -30], [150, -38], [145, -40], [135, -38], [125, -35],
    [115, -30], [110, -22], [113, -15], [115, -10]
  ]
};

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

export function GlassSphere() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0x4F46E5, 1, 20);
    pointLight1.position.set(-5, 0, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x9333EA, 1, 20);
    pointLight2.position.set(5, 0, -5);
    scene.add(pointLight2);

    // Create globe made of tiny balls - BIGGER
    const globeGroup = new THREE.Group();
    const sphereRadius = 2; // Increased from 1.5
    const particleCount = 3000; // More particles
    const particles: THREE.Mesh[] = [];

    // Ball geometry (shared for performance)
    const ballGeometry = new THREE.SphereGeometry(0.018, 8, 8); // Slightly bigger balls

    // Multiple colors for variety
    const colors = [
      0x4F46E5, // Indigo
      0x6366F1, // Light indigo
      0x8B5CF6, // Purple
      0x3B82F6, // Blue
      0x06B6D4, // Cyan
      0x9333EA  // Deep purple
    ];

    // Distribute particles on sphere surface using Fibonacci sphere
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      const color = colors[Math.floor(Math.random() * colors.length)];
      const ballMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
      });

      const ball = new THREE.Mesh(ballGeometry, ballMaterial);
      ball.position.set(
        x * sphereRadius,
        y * sphereRadius,
        z * sphereRadius
      );

      (ball as any).originalPosition = ball.position.clone();
      (ball as any).phase = Math.random() * Math.PI * 2;
      (ball as any).speed = 0.5 + Math.random() * 0.5;

      globeGroup.add(ball);
      particles.push(ball);
    }

    scene.add(globeGroup);

    // Add subtle glow sphere in center
    const glowGeometry = new THREE.SphereGeometry(sphereRadius * 0.95, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x4F46E5,
      transparent: true,
      opacity: 0.03,
      side: THREE.BackSide
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    globeGroup.add(glowSphere);

    // Create continent outlines
    const continentLines: THREE.Line[] = [];

    Object.values(continentData).forEach((continent) => {
      const points: THREE.Vector3[] = [];

      continent.forEach(([lng, lat]) => {
        const point = latLngToVector3(lat, lng, sphereRadius + 0.02);
        points.push(point);
      });

      // Close the path
      if (points.length > 0) {
        points.push(points[0].clone());
      }

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.7,
        linewidth: 2
      });

      const line = new THREE.Line(lineGeometry, lineMaterial);
      globeGroup.add(line);
      continentLines.push(line);
    });

    // Add connection lines between nearby particles (fewer for performance)
    const connectionLines: THREE.Line[] = [];
    const maxConnectionDistance = 0.35;
    const maxConnections = 200;

    for (let i = 0; i < Math.min(particleCount, 150); i++) {
      const particle1 = particles[i];
      let connectionCount = 0;

      for (let j = i + 1; j < particleCount && connectionCount < 2; j++) {
        const particle2 = particles[j];
        const distance = particle1.position.distanceTo(particle2.position);

        if (distance < maxConnectionDistance && connectionLines.length < maxConnections) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            particle1.position,
            particle2.position
          ]);
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x4F46E5,
            transparent: true,
            opacity: 0.1
          });
          const line = new THREE.Line(lineGeometry, lineMaterial);
          globeGroup.add(line);
          connectionLines.push(line);
          connectionCount++;
        }
      }
    }

    // Animation
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Rotate globe
      globeGroup.rotation.y = elapsedTime * 0.1;
      globeGroup.rotation.x = Math.sin(elapsedTime * 0.08) * 0.1;

      // Subtle pulse effect on particles
      particles.forEach((particle) => {
        const phase = (particle as any).phase;
        const speed = (particle as any).speed;
        const scale = 1 + Math.sin(elapsedTime * speed + phase) * 0.25;
        particle.scale.setScalar(scale);
      });

      // Gentle camera orbit
      camera.position.x = Math.sin(elapsedTime * 0.08) * 0.3;
      camera.position.y = Math.cos(elapsedTime * 0.12) * 0.3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Start animation
    setTimeout(() => {
      setIsLoaded(true);
      animate();
    }, 100);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      renderer.dispose();

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className={`w-full h-full transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ maxWidth: '800px', maxHeight: '800px' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary opacity-20 animate-pulse" />
        </div>
      )}
    </div>
  );
}
