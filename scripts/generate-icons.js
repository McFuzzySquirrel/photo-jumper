#!/usr/bin/env node
/**
 * Generate PWA icons from SVG source
 * 
 * This script creates PNG icons at various sizes required for PWA manifest.
 * Run with: node scripts/generate-icons.js
 * 
 * Requires: sharp (npm install sharp --save-dev)
 * Or use an online SVG to PNG converter if sharp is not available.
 */

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'icons');
  const svgPath = path.join(iconsDir, 'icon.svg');
  
  if (!fs.existsSync(svgPath)) {
    console.error('Source SVG not found:', svgPath);
    process.exit(1);
  }
  
  // Try to use sharp if available
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('sharp not installed. Creating placeholder icons...');
    console.log('For production icons, either:');
    console.log('  1. npm install sharp --save-dev && node scripts/generate-icons.js');
    console.log('  2. Use an online SVG to PNG converter');
    
    // Create simple placeholder files
    for (const size of ICON_SIZES) {
      const outputPath = path.join(iconsDir, `icon-${size}.png`);
      // Create a minimal 1x1 PNG as placeholder
      const minimalPng = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27,
        0x0A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
        0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(outputPath, minimalPng);
      console.log(`Created placeholder: ${outputPath}`);
    }
    return;
  }
  
  // Generate icons with sharp
  const svgBuffer = fs.readFileSync(svgPath);
  
  for (const size of ICON_SIZES) {
    const outputPath = path.join(iconsDir, `icon-${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`Generated: ${outputPath}`);
  }
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
