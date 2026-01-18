import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

// Icon Components (inline SVG to avoid lucide-react dependency issues)
const MicIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
);

const MessageSquareIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);

interface WelcomeScreenProps {
    onStart: (mode: 'voice' | 'chat') => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // 3D Scene Setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0a0a0a'); // Matte black
        scene.fog = new THREE.FogExp2('#0a0a0a', 0.002);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;
        camera.position.y = 10;
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        mountRef.current.appendChild(renderer.domElement);

        // City Wireframe (Abstract Representation)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15 });

        const buildings: THREE.LineSegments[] = [];
        const group = new THREE.Group();

        // Create a robust city grid
        for (let i = 0; i < 150; i++) {
            const h = Math.random() * 8 + 1;
            const w = Math.random() * 2 + 1;
            const d = Math.random() * 2 + 1;
            const x = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;

            // Don't place too close to center
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

            const mesh = new THREE.LineSegments(edges, material);
            mesh.scale.set(w, h, d);
            mesh.position.set(x, h / 2, z);
            group.add(mesh);
            buildings.push(mesh);
        }

        // Add pulsing floor grid
        const gridHelper = new THREE.GridHelper(200, 50, 0x111111, 0x111111);
        group.add(gridHelper);

        scene.add(group);

        // Animation Loop
        let frameId: number;
        const animate = () => {
            frameId = requestAnimationFrame(animate);

            // Rotate city slowly
            group.rotation.y += 0.001;

            // Pulse effect via camera movement
            const time = Date.now() * 0.0005;
            camera.position.y = 10 + Math.sin(time) * 1;

            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
            {/* 3D Background */}
            <div ref={mountRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }} />

            {/* Header / Brand (Top Left) */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 20,
                padding: '32px 48px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: 'white',
                    fontFamily: "'Inter', sans-serif"
                }}>
                    {/* Logo Mark */}
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'rgba(0, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)'
                    }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            background: '#00ffff',
                            borderRadius: '50%',
                            boxShadow: '0 0 10px #00ffff'
                        }} />
                    </div>

                    {/* Brand Name */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                            fontSize: '1.4rem',
                            fontWeight: 800,
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            background: 'linear-gradient(90deg, #fff, #ccc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            textShadow: '0 0 20px rgba(255,255,255,0.3)'
                        }}>
                            Boston Visit
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Overlay */}
            <div style={{
                position: 'absolute',
                zIndex: 10,
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                padding: '24px'
            }}>

                {/* Hero Text */}
                <div style={{ textAlign: 'center', marginBottom: '60px', maxWidth: '800px' }}>
                    <h1 style={{
                        fontSize: '5rem',
                        fontWeight: 800,
                        letterSpacing: '-2px',
                        marginBottom: '10px',
                        background: 'linear-gradient(180deg, #ffffff 0%, #888888 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 30px rgba(0,255,255,0.2)'
                    }}>
                        THE HEARTBEAT
                    </h1>
                    <h2 style={{
                        fontSize: '2.5rem',
                        fontWeight: 300,
                        color: 'white',
                        marginBottom: '24px',
                        letterSpacing: '4px',
                        textTransform: 'uppercase',
                        textShadow: '0 0 10px rgba(0,0,0,0.8)'
                    }}>
                        OF THE CITY
                    </h2>
                    <p style={{
                        fontSize: '1.25rem',
                        color: '#fff',
                        fontWeight: 400,
                        lineHeight: 1.4,
                        textShadow: '0 0 10px rgba(0,0,0,0.8), 0 0 5px rgba(255,255,255,0.3)'
                    }}>
                        The heartbeat of the city, in your hands.
                    </p>
                    <p style={{
                        fontSize: '1.25rem',
                        color: '#ccc',
                        fontWeight: 300,
                        marginTop: '4px',
                        textShadow: '0 0 10px rgba(0,0,0,0.8)'
                    }}>
                        Guiding students, parents, and locals.
                    </p>
                </div>

                {/* Interaction Choice Tiles */}
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    width: '100%',
                    maxWidth: '800px'
                }}>

                    {/* Option 1: Voice */}
                    <button
                        onClick={() => onStart('voice')}
                        style={{
                            background: 'rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '16px',
                            padding: '24px 20px',
                            width: '240px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'cyan';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,255,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ marginBottom: '12px', color: 'cyan', filter: 'drop-shadow(0 0 5px rgba(0,255,255,0.6))' }}>
                            <MicIcon />
                        </div>
                        <h2 style={{
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            marginBottom: '8px',
                            color: 'white',
                            textShadow: '0 0 10px rgba(255,255,255,0.4)'
                        }}>
                            Speak to the City
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: '#ddd', lineHeight: 1.4, textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>
                            ElevenLabs AI Voice Navigation
                        </p>
                    </button>

                    {/* Option 2: Chat */}
                    <button
                        onClick={() => onStart('chat')}
                        style={{
                            background: 'rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '16px',
                            padding: '24px 20px',
                            width: '240px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'white';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 0 30px rgba(255,255,255,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ marginBottom: '12px', color: 'white', filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.6))' }}>
                            <MessageSquareIcon />
                        </div>
                        <h2 style={{
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            marginBottom: '8px',
                            color: 'white',
                            textShadow: '0 0 10px rgba(255,255,255,0.4)'
                        }}>
                            Interactive Search
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: '#ddd', lineHeight: 1.4, textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>
                            Gemini-powered Vibe Explorer
                        </p>
                    </button>

                </div>

                {/* Footer */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    fontSize: '0.75rem',
                    color: '#666',
                    letterSpacing: '0.5px'
                }}>
                    Powered by Gemini and ElevenLabs
                </div>

            </div>
        </div>
    );
};

export default WelcomeScreen;
