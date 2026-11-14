import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('Geometry Normals Test', () => {
  it('checks ShapeGeometry winding and normals', () => {
    // Current winding in Scene3DCanvas:
    // Left boundary (+y) from x=-10 to 120, then Right boundary (-y) from x=120 to -10
    const shapeCW = new THREE.Shape();
    shapeCW.moveTo(-10, 4.8);
    shapeCW.lineTo(120, 4.8);
    shapeCW.lineTo(120, -4.8);
    shapeCW.lineTo(-10, -4.8);
    shapeCW.closePath();

    const geoCW = new THREE.ShapeGeometry(shapeCW);
    geoCW.computeVertexNormals();
    const normalsCW = geoCW.attributes.normal.array;
    console.log('CW Shape normal z:', normalsCW[2]);

    // Counter-clockwise winding:
    // Right boundary (-y) from x=-10 to 120, then Left boundary (+y) from x=120 to -10
    const shapeCCW = new THREE.Shape();
    shapeCCW.moveTo(-10, -4.8);
    shapeCCW.lineTo(120, -4.8);
    shapeCCW.lineTo(120, 4.8);
    shapeCCW.lineTo(-10, 4.8);
    shapeCCW.closePath();

    const geoCCW = new THREE.ShapeGeometry(shapeCCW);
    geoCCW.computeVertexNormals();
    const normalsCCW = geoCCW.attributes.normal.array;
    console.log('CCW Shape normal z:', normalsCCW[2]);

    expect(normalsCCW[2]).toBeGreaterThan(0);
  });
});

