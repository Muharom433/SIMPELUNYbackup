import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Eraser, RotateCcw, Check, Pen } from 'lucide-react';

export interface SignatureCanvasRef {
    clear: () => void;
    isEmpty: () => boolean;
    toDataURL: () => string;
    fromDataURL: (dataUrl: string) => void;
}

interface SignatureCanvasProps {
    width?: number;
    height?: number;
    penColor?: string;
    penWidth?: number;
    backgroundColor?: string;
    className?: string;
    onChange?: (dataUrl: string) => void;
    initialValue?: string;
    disabled?: boolean;
}

const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(({
    width = 400,
    height = 200,
    penColor = '#000000',
    penWidth = 2,
    backgroundColor = '#ffffff',
    className = '',
    onChange,
    initialValue,
    disabled = false,
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Load initial value if provided
        if (initialValue) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                setHasDrawn(true);
            };
            img.src = initialValue;
        }
    }, [width, height, backgroundColor, initialValue]);

    // Get position relative to canvas
    const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
        }
    };

    // Start drawing
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (disabled) return;
        e.preventDefault();

        const pos = getPosition(e);
        lastPos.current = pos;
        setIsDrawing(true);
    };

    // Draw line
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || disabled) return;
        e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const currentPos = getPosition(e);

        ctx.beginPath();
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();

        lastPos.current = currentPos;
        setHasDrawn(true);
    };

    // Stop drawing
    const stopDrawing = () => {
        if (isDrawing && hasDrawn) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            if (canvas && onChange) {
                onChange(canvas.toDataURL('image/png'));
            }
        }
        setIsDrawing(false);
    };

    // Clear canvas
    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);

        if (onChange) {
            onChange('');
        }
    };

    // Check if canvas is empty
    const isEmpty = () => !hasDrawn;

    // Get data URL
    const toDataURL = () => {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL('image/png') : '';
    };

    // Load from data URL
    const fromDataURL = (dataUrl: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            setHasDrawn(true);
        };
        img.src = dataUrl;
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        clear,
        isEmpty,
        toDataURL,
        fromDataURL,
    }));

    return (
        <div className={`w-full ${className}`}>
            {/* Canvas - responsive with 2:1 aspect ratio */}
            <div
                className={`relative border-2 rounded-lg overflow-hidden w-full ${disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-blue-400'
                    } transition-colors`}
                style={{ aspectRatio: '2/1' }}
            >
                <canvas
                    ref={canvasRef}
                    className={`touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                    style={{ width: '100%', height: '100%' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />

                {/* Placeholder text */}
                {!hasDrawn && !disabled && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center text-gray-400">
                            <Pen className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
                            <span className="text-xs sm:text-sm">Tanda tangan di sini</span>
                        </div>
                    </div>
                )}

                {/* Drawing indicator */}
                {isDrawing && (
                    <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                )}
            </div>

            {/* Controls */}
            {!disabled && (
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            onClick={clear}
                            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Reset</span>
                        </button>
                    </div>

                    {hasDrawn && (
                        <div className="flex items-center text-green-600 text-sm">
                            <Check className="w-4 h-4 mr-1" />
                            <span>Signed</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

SignatureCanvas.displayName = 'SignatureCanvas';

export default SignatureCanvas;
