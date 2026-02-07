import { runtime } from '../runtime.js';

// Goal class - represents the end goal for the level
export class Goal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const blockSize = runtime.getScaledBlockSize?.() ?? 20;
        this.width = blockSize;   // Portal is one block wide
        this.height = blockSize * 2;  // Portal is 2 blocks tall
        this.animation = 0;
    }

    update() {
        this.animation += 0.05;
    }

    checkCollision(player) {
        // Check if player overlaps with the portal
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    draw() {
        const ctx = runtime.ctx;
        if (!ctx) return;

        // Draw portal as shimmering gateway
        ctx.save();

        const glowIntensity = 0.7 + Math.sin(this.animation * 2) * 0.3;

        // Outer glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20 * glowIntensity;

        // Portal gradient (vertical)
        const gradient = ctx.createLinearGradient(
            this.x, this.y,
            this.x, this.y + this.height
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 165, 0, 0.3)');

        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Portal frame/border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Sparkle particles
        ctx.shadowBlur = 0;
        for (let i = 0; i < 3; i++) {
            const sparkleY = this.y + (Math.sin(this.animation * 3 + i * 2) + 1) * this.height / 2;
            ctx.fillStyle = `rgba(255, 255, 255, ${glowIntensity})`;
            ctx.fillRect(this.x + this.width / 2 - 1, sparkleY, 2, 2);
        }

        ctx.restore();
    }
}
