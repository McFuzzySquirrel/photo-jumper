import { runtime } from '../runtime.js';
import {
    STUCK_CHECK_INTERVAL,
    STUCK_MOVEMENT_THRESHOLD,
    PLAYER_EYE_SIZE_RATIO,
    PLAYER_EYE_Y_RATIO,
    PLAYER_LEFT_EYE_X_RATIO,
    PLAYER_RIGHT_EYE_X_RATIO,
    PLAYER_PUPIL_SIZE_RATIO,
    JUMP_CUT_DAMPING,
    PLAYER_SPAWN_X
} from '../config.js';

// Player class
export class Player {
    constructor(x, y, getScaledPlayerSize, getScaledPlayerSpeed, getScaledPlayerJumpPower, getScaledPlayerGravity) {
        this.x = x;
        this.y = y;
        // Use scaled player size based on world dimensions
        const playerSize = getScaledPlayerSize();
        this.width = playerSize;
        this.height = playerSize;
        this.velocityX = 0;
        this.velocityY = 0;
        // Scale speed, jump power, and gravity to match world size
        this.speed = getScaledPlayerSpeed();
        this.jumpPower = getScaledPlayerJumpPower();
        this.gravity = getScaledPlayerGravity();
        this.onGround = false;
        this.jumpCutAllowed = false;  // Variable jump: true while rising and cut is possible
        this.lastPositionTime = Date.now();
        this.lastX = x;
        this.lastY = y;
        this.stuckCheckInterval = STUCK_CHECK_INTERVAL;
    }

    update() {
        const keys = runtime.getKeys?.() ?? {};
        const platforms = runtime.getPlatforms?.() ?? [];
        const worldWidth = runtime.getWorldWidth?.() ?? 0;
        const worldHeight = runtime.getWorldHeight?.() ?? 0;
        const touchJumpingRef = runtime.touchJumpingRef;

        // Horizontal movement
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            this.velocityX = -this.speed;
            this.lastPositionTime = Date.now(); // Reset stuck timer on input
        } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            this.velocityX = this.speed;
            this.lastPositionTime = Date.now(); // Reset stuck timer on input
        } else {
            this.velocityX *= 0.7; // Reduced friction for more responsive feel
        }

        // Jumping - variable height: hold for full jump, tap for short hop
        if ((keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' '] || (touchJumpingRef?.value)) && this.onGround) {
            this.velocityY = -this.jumpPower;
            this.onGround = false;
            this.jumpCutAllowed = true;  // Enable jump cut until apex or key release
            if (touchJumpingRef) touchJumpingRef.value = false; // Reset touch jump
            this.lastPositionTime = Date.now(); // Reset stuck timer on input
        }

        // Clear jump cut when player starts falling (reached apex)
        if (this.velocityY >= 0) {
            this.jumpCutAllowed = false;
        }

        // Apply gravity
        this.velocityY += this.gravity;

        // Update horizontal position
        this.x += this.velocityX;

        // Check horizontal platform collisions
        for (let platform of platforms) {
            if (platform.kind === 'shadow') continue;
            if (this.checkCollision(platform)) {
                // Push out from sides
                if (this.x + this.width / 2 < platform.x + platform.width / 2) {
                    this.x = platform.x - this.width;
                } else {
                    this.x = platform.x + platform.width;
                }
                this.velocityX = 0;
            }
        }

        // Update vertical position
        this.y += this.velocityY;

        // Check vertical platform collisions
        this.onGround = false;
        for (let platform of platforms) {
            if (platform.kind === 'shadow') continue;
            if (this.checkCollision(platform)) {
                // Landing on top of platform
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
                // Hitting platform from below
                else if (this.velocityY < 0 && this.y - this.velocityY >= platform.y + platform.height) {
                    this.y = platform.y + platform.height;
                    this.velocityY = 0;
                }
            }
        }

        // Boundary checks
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > worldWidth) this.x = worldWidth - this.width;

        // Check if player fell off
        if (this.y > worldHeight) {
            this.respawn();
        }

        // Stuck detection: if player hasn't moved significantly in a while
        const now = Date.now();
        const distMoved = Math.sqrt((this.x - this.lastX) ** 2 + (this.y - this.lastY) ** 2);

        if (now - this.lastPositionTime > this.stuckCheckInterval) {
            if (distMoved < STUCK_MOVEMENT_THRESHOLD && this.onGround) {
                // Player appears stuck, auto-respawn
                this.respawn();
                // Reset tracking variables after respawn to prevent immediate re-triggering
                this.lastX = this.x;
                this.lastY = this.y;
                this.lastPositionTime = Date.now();
            } else {
                // Update last known position when not stuck
                this.lastX = this.x;
                this.lastY = this.y;
                this.lastPositionTime = now;
            }
        }

        // Update score based on progress and time efficiency
        // Score = platforms reached * 100 - time penalty
        const heightProgress = Math.max(0, Math.floor((worldHeight - this.y) / 10));
        const elapsedSeconds = Math.floor((Date.now() - (runtime.getStartTime?.() ?? 0)) / 1000);
        const timePenalty = Math.floor(elapsedSeconds / 2); // -1 point every 2 seconds
        const currentScore = Math.max(0, heightProgress * 2 - timePenalty);

        if (runtime.getScore && runtime.setScore) {
            if (currentScore > runtime.getScore()) {
                runtime.setScore(currentScore);
            }
        }
    }

    checkCollision(platform) {
        return this.x < platform.x + platform.width &&
               this.x + this.width > platform.x &&
               this.y < platform.y + platform.height &&
               this.y + this.height > platform.y;
    }

    respawn() {
        const spawnY = runtime.getPlayerSpawnY?.() ?? 0;
        this.x = PLAYER_SPAWN_X;
        this.y = spawnY;  // Use the calculated spawn Y position
        this.velocityX = 0;
        this.velocityY = 0;
        if (runtime.getScore && runtime.setScore) {
            runtime.setScore(Math.max(0, runtime.getScore() - 10));
        }
    }

    draw() {
        const ctx = runtime.ctx;
        if (!ctx) return;

        // Draw shadow/outline for better visibility on photo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x + 2, this.y + 2, this.width, this.height);

        // Draw main body
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw border for visibility
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Draw eyes (scaled proportionally to player size using constants)
        const eyeSize = Math.max(2, Math.floor(this.width * PLAYER_EYE_SIZE_RATIO));
        const eyeY = this.y + Math.floor(this.height * PLAYER_EYE_Y_RATIO);
        const leftEyeX = this.x + Math.floor(this.width * PLAYER_LEFT_EYE_X_RATIO);
        const rightEyeX = this.x + Math.floor(this.width * PLAYER_RIGHT_EYE_X_RATIO);

        ctx.fillStyle = 'white';
        ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
        ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

        const pupilSize = Math.max(1, Math.floor(eyeSize * PLAYER_PUPIL_SIZE_RATIO));
        const pupilOffset = Math.floor((eyeSize - pupilSize) / 2);
        ctx.fillStyle = 'black';
        ctx.fillRect(leftEyeX + pupilOffset, eyeY + pupilOffset, pupilSize, pupilSize);
        ctx.fillRect(rightEyeX + pupilOffset, eyeY + pupilOffset, pupilSize, pupilSize);
    }
}

export function applyJumpCut(player) {
    if (player && player.jumpCutAllowed && player.velocityY < 0) {
        player.velocityY *= JUMP_CUT_DAMPING;
        player.jumpCutAllowed = false;
    }
}
