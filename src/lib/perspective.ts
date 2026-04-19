/**
 * Calculates a CSS matrix3d transform to map coordinates [0, 100]^2
 * to the quadrilateral defined by pts (which are also 0-100 percentages).
 */
export function getMatrix3d(pts: [number, number, number, number, number, number, number, number]): string {
  // Source points (normalized to 1.0 for calculation ease)
  // We want to map (0,0), (1,0), (1,1), (0,1) to the target pts
  const [x0, y0, x1, y1, x2, y2, x3, y3] = pts;

  // Use the algorithm to map a unit square to a quad
  // From: "Perspective Transforms" (Paul Heckbert)
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;

  let a, b, c, d, e, f, g, h;

  if (Math.abs(sx) < 1e-10 && Math.abs(sy) < 1e-10) {
    // Affine transform (parallelogram)
    a = x1 - x0;
    b = x3 - x0;
    c = x0;
    d = y1 - y0;
    e = y3 - y0;
    f = y0;
    g = 0;
    h = 0;
  } else {
    // Projective transform
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-10) return 'none'; // Degenerate

    g = (sx * dy2 - sy * dx2) / det;
    h = (sy * dx1 - sx * dy1) / det;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
  }

  // Currently the matrix maps [0, 1]^2 to the target points.
  // BUT the element's coordinate space is [0, rectWidth] x [0, rectHeight].
  // Since our target points are in 0-100 range (percentages of zone),
  // and we want to map those to the element's actual size,
  // we treat the element's size as 100x100 for the purpose of the mapping.
  // So we must divide the final matrix's x/y basis vectors by 100.
  
  const m = [
    a / 100, d / 100, 0, g / 100, // Column 1 (X basis)
    b / 100, e / 100, 0, h / 100, // Column 2 (Y basis)
    0,       0,       1, 0,       // Column 3 (Z basis - identity)
    c,       f,       0, 1        // Column 4 (Translation)
  ];

  return `matrix3d(${m.map(n => n.toFixed(6)).join(',')})`;
}
