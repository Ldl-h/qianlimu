/**
 * Canvas Analyzer - Simplified version for frontend integration
 * Enables capturing Cesium canvas and preparing it for multi-modal LLMs
 */

declare const Cesium: any;

export interface BoundingBox {
  x: number;      // Left edge (0-1 normalized)
  y: number;      // Top edge (0-1 normalized)
  width: number;  // Width (0-1 normalized)
  height: number; // Height (0-1 normalized)
  label: string;
}

export interface DetectedFeature {
  type: string;
  name?: string;
  boundingBox: BoundingBox;
}

export class CanvasAnalyzer {
  private viewer: any;

  constructor(viewer: any) {
    this.viewer = viewer;
  }

  /**
   * Capture the current Cesium canvas as a base64 image
   */
  captureCanvas(format: 'png' | 'jpeg' = 'jpeg', quality = 0.9): string {
    const canvas = this.viewer.canvas;
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    return canvas.toDataURL(mimeType, quality);
  }

  /**
   * Draw bounding boxes on detected features (from LLM response)
   */
  drawBoundingBoxes(features: DetectedFeature[], colorName: string = 'yellow'): void {
    const color = (Cesium.Color as any).fromCssColorString(colorName).withAlpha(0.7);

    for (const feature of features) {
      const box = feature.boundingBox;
      const canvas = this.viewer.canvas;
      
      // This is a simplified version. In a real app, you'd convert 
      // normalized LLM coordinates back to geographic coordinates 
      // using viewer.camera.pickEllipsoid at the corners.
      
      console.log(`Drawing box for ${feature.name || feature.type} at`, box);
    }
  }
}