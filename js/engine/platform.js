import { runtime } from '../runtime.js';

// Platform class
export class Platform {
    constructor(x, y, width, height, color, kind = 'photo') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.kind = kind;
    }

    draw() {
        const ctx = runtime.ctx;
        if (!ctx) return;

        // Special glow effect for goal platform
        const goal = runtime.getGoal?.();
        if (this.kind === 'goal' && goal) {
            const glowIntensity = 0.7 + Math.sin(goal.animation * 2) * 0.3;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15 * glowIntensity;
        }

        // Draw platforms as a series of connected square blocks
        const blockSize = runtime.getScaledBlockSize?.() ?? 20;
        const numBlocks = Math.floor(this.width / blockSize);
        const remainingWidth = this.width - (numBlocks * blockSize);
        const rows = Math.max(1, Math.ceil(this.height / blockSize));

        if (this.kind === 'shadow') {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            return;
        }

        for (let row = 0; row < rows; row++) {
            const blockY = this.y + (row * blockSize);
            const rowHeight = Math.min(blockSize, this.height - (row * blockSize));

            // Draw individual blocks
            for (let i = 0; i < numBlocks; i++) {
                const blockX = this.x + (i * blockSize);

                // Main block fill (square blocks)
                ctx.fillStyle = this.color;
                ctx.fillRect(blockX, blockY, blockSize, rowHeight);

                // Block outline
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(blockX, blockY, blockSize, rowHeight);

                // Top highlight for each block (top row only)
                if (row === 0) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(blockX + 1, blockY + 1);
                    ctx.lineTo(blockX + blockSize - 1, blockY + 1);
                    ctx.stroke();
                }
            }

            // Handle remaining width (partial block at end)
            if (remainingWidth > 0) {
                const blockX = this.x + (numBlocks * blockSize);

                ctx.fillStyle = this.color;
                ctx.fillRect(blockX, blockY, remainingWidth, rowHeight);

                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(blockX, blockY, remainingWidth, rowHeight);

                if (row === 0) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(blockX + 1, blockY + 1);
                    ctx.lineTo(blockX + remainingWidth - 1, blockY + 1);
                    ctx.stroke();
                }
            }
        }

        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}
