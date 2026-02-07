import { runtime } from '../runtime.js';
import {
    COLLECTIBLE_LETTER_FLOAT_SPEED,
    COLLECTIBLE_LETTER_FONT_SIZE_RATIO
} from '../config.js';

// Letter class for collectible letters
export class Letter {
    constructor(char, x, y, index) {
        this.char = char;
        this.x = x;
        this.y = y;
        const letterSize = runtime.getScaledLetterSize?.() ?? 20;
        this.width = letterSize;
        this.height = letterSize;
        this.collected = false;
        this.index = index;  // Position in the target word
        this.animation = 0;
    }

    update() {
        // Increment animation for floating effect
        this.animation += COLLECTIBLE_LETTER_FLOAT_SPEED;
    }

    checkCollision(player) {
        return !this.collected &&
               player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    draw() {
        if (this.collected) return;
        const ctx = runtime.ctx;
        if (!ctx) return;

        // Floating animation
        const floatOffset = Math.sin(this.animation) * 3;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2 + floatOffset;

        // Draw circular background with glow
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Draw black outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw the letter (scale font size with letter size)
        const fontSize = Math.max(12, Math.floor(this.width * COLLECTIBLE_LETTER_FONT_SIZE_RATIO));
        ctx.fillStyle = '#000';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.char, centerX, centerY);
    }
}
