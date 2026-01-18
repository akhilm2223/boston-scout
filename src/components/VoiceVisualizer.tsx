import React, { useRef, useEffect } from 'react';

interface VoiceVisualizerProps {
    audioLevel: number;
    isActive: boolean;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ audioLevel, isActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | undefined>();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
            ctx.scale(dpr, dpr);
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const bars = 32; // Number of frequency bars
        const barWidth = canvas.offsetWidth / bars;
        const centerY = canvas.offsetHeight / 2;

        let phase = 0;

        const animate = () => {
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!isActive) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            // Draw waveform bars
            for (let i = 0; i < bars; i++) {
                const x = i * barWidth + barWidth / 2;

                // Generate wave pattern with some randomness
                const baseHeight = Math.sin((i / bars) * Math.PI * 2 + phase) * 20;
                const audioHeight = audioLevel * 80; // Scale audio level
                const randomVariation = Math.random() * 10;
                const height = Math.abs(baseHeight) + audioHeight + randomVariation;

                // Create gradient for our cyan theme
                const gradient = ctx.createLinearGradient(x, centerY - height, x, centerY + height);
                gradient.addColorStop(0, 'rgba(0, 243, 255, 0.8)'); // Electric cyan
                gradient.addColorStop(0.5, 'rgba(0, 243, 255, 1)');
                gradient.addColorStop(1, 'rgba(0, 243, 255, 0.8)');

                ctx.fillStyle = gradient;
                ctx.fillRect(x - barWidth * 0.3, centerY - height / 2, barWidth * 0.6, height);

                // Add glow effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f3ff';
            }

            phase += 0.05;
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioLevel, isActive]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '120px',
                borderRadius: '12px',
                background: 'rgba(0, 0, 0, 0.3)',
            }}
        />
    );
};

export default VoiceVisualizer;
