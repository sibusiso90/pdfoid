import React, { useRef, useState } from 'react';
import { Button } from './ui';

interface SignaturePadProps {
    onSave: (dataUrl: string) => void;
    onCancel: () => void;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
    const [mode, setMode] = useState<'draw' | 'type'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawStateRef = useRef<{ drawing: boolean; lastX: number; lastY: number } | null>(null);

    const saveTypedSignature = () => {
        const text = typedSignature.trim();
        if (!text) return;
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#111827';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = '96px cursive';
        ctx.fillText(text, 20, canvas.height / 2);

        onSave(canvas.toDataURL('image/png'));
    };

    const saveDrawnSignature = () => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        onSave(canvas.toDataURL('image/png'));
    };

    const clearCanvas = () => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onCancel}>
            <div className="w-[min(92vw,520px)] rounded-2xl bg-[var(--pdfoid-surface)] shadow-[var(--pdfoid-shadow)] border border-[var(--pdfoid-border)] p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-[var(--pdfoid-text)]">Create signature</h3>
                    <button className="text-sm text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]" onClick={onCancel} type="button">
                        Close
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 mb-4 bg-[var(--pdfoid-surface-2)] p-1 rounded-lg">
                    <button
                        onClick={() => setMode('draw')}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'draw' ? 'bg-[var(--pdfoid-surface)] shadow-sm text-[var(--pdfoid-text)]' : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'}`}
                    >
                        Draw
                    </button>
                    <button
                        onClick={() => setMode('type')}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'type' ? 'bg-[var(--pdfoid-surface)] shadow-sm text-[var(--pdfoid-text)]' : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'}`}
                    >
                        Type
                    </button>
                </div>

                {mode === 'type' ? (
                    <div className="space-y-3">
                        <input
                            className="w-full rounded-lg border border-[var(--pdfoid-border-strong)] bg-[var(--pdfoid-surface-2)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--pdfoid-ring)]"
                            placeholder="Type your name"
                            value={typedSignature}
                            onChange={(e) => setTypedSignature(e.target.value)}
                            autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => setTypedSignature('')}>Clear</Button>
                            <Button type="button" variant="primary" size="sm" onClick={saveTypedSignature}>Save</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <canvas
                            ref={drawCanvasRef}
                            width={480}
                            height={180}
                            className="w-full rounded-lg border border-[var(--pdfoid-border)] bg-white touch-none"
                            onMouseDown={(e) => {
                                const canvas = drawCanvasRef.current;
                                if (!canvas) return;
                                const rect = canvas.getBoundingClientRect();
                                const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
                                const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
                                drawStateRef.current = { drawing: true, lastX: x, lastY: y };
                            }}
                            onMouseMove={(e) => {
                                const canvas = drawCanvasRef.current;
                                const state = drawStateRef.current;
                                if (!canvas || !state?.drawing) return;
                                const ctx = canvas.getContext('2d');
                                if (!ctx) return;
                                const rect = canvas.getBoundingClientRect();
                                const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
                                const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

                                ctx.lineWidth = 2;
                                ctx.lineCap = 'round';
                                ctx.lineJoin = 'round';
                                ctx.strokeStyle = '#111827';

                                ctx.beginPath();
                                ctx.moveTo(state.lastX, state.lastY);
                                // Simple quadratic smoothing for signature
                                const midX = (state.lastX + x) / 2;
                                const midY = (state.lastY + y) / 2;
                                ctx.quadraticCurveTo(midX, midY, x, y);
                                ctx.stroke();

                                drawStateRef.current = { drawing: true, lastX: x, lastY: y };
                            }}
                            onMouseUp={() => {
                                if (drawStateRef.current) drawStateRef.current.drawing = false;
                            }}
                            onMouseLeave={() => {
                                if (drawStateRef.current) drawStateRef.current.drawing = false;
                            }}
                            // Touch support
                            onTouchStart={(e) => {
                                e.preventDefault();
                                const canvas = drawCanvasRef.current;
                                if (!canvas) return;
                                const rect = canvas.getBoundingClientRect();
                                const touch = e.touches[0];
                                const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
                                const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;
                                drawStateRef.current = { drawing: true, lastX: x, lastY: y };
                            }}
                            onTouchMove={(e) => {
                                e.preventDefault();
                                const canvas = drawCanvasRef.current;
                                const state = drawStateRef.current;
                                if (!canvas || !state?.drawing) return;
                                const ctx = canvas.getContext('2d');
                                if (!ctx) return;
                                const rect = canvas.getBoundingClientRect();
                                const touch = e.touches[0];
                                const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
                                const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;

                                ctx.lineWidth = 2;
                                ctx.lineCap = 'round';
                                ctx.lineJoin = 'round';
                                ctx.strokeStyle = '#111827';

                                ctx.beginPath();
                                ctx.moveTo(state.lastX, state.lastY);
                                const midX = (state.lastX + x) / 2;
                                const midY = (state.lastY + y) / 2;
                                ctx.quadraticCurveTo(midX, midY, x, y);
                                ctx.stroke();

                                drawStateRef.current = { drawing: true, lastX: x, lastY: y };
                            }}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                if (drawStateRef.current) drawStateRef.current.drawing = false;
                            }}
                        />
                        <div className="grid grid-cols-3 gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={clearCanvas}>
                                Clear
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button type="button" variant="primary" size="sm" onClick={saveDrawnSignature}>
                                Save
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
