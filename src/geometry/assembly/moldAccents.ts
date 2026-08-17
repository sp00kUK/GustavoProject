/**
 * Profile curves and lathe mesh generators for authentic mold base moldings and top rims.
 * Extracted directly from the user's BambuStudio 3MF files.
 */
import type { PrintableMesh } from '../../types';
import { MeshBuilder } from '../mesh/MeshBuilder';
import { cleanMesh, computeMeshStats, flipWinding } from '../mesh/meshOps';

export interface ProfilePoint {
  y: number;
  r: number;
}

export const BASE_PROFILE_600ML: ProfilePoint[] = [
  {
    "y": -87.5,
    "r": 48.51
  },
  {
    "y": -86.5,
    "r": 48.51
  },
  {
    "y": -86,
    "r": 48.52
  },
  {
    "y": -85.5,
    "r": 48.56
  },
  {
    "y": -85,
    "r": 48.62
  },
  {
    "y": -84.5,
    "r": 48.72
  },
  {
    "y": -84,
    "r": 48.83
  },
  {
    "y": -83.5,
    "r": 48.97
  },
  {
    "y": -83,
    "r": 49.13
  },
  {
    "y": -82.5,
    "r": 49.42
  },
  {
    "y": -82,
    "r": 49.64
  },
  {
    "y": -81.5,
    "r": 49.84
  },
  {
    "y": -81,
    "r": 50.02
  },
  {
    "y": -80.5,
    "r": 50.17
  },
  {
    "y": -80,
    "r": 50.3
  },
  {
    "y": -79.5,
    "r": 50.4
  },
  {
    "y": -79,
    "r": 50.47
  },
  {
    "y": -78.5,
    "r": 50.52
  },
  {
    "y": -78,
    "r": 50.54
  },
  {
    "y": -77.5,
    "r": 50.54
  },
  {
    "y": -77,
    "r": 50.52
  },
  {
    "y": -76.5,
    "r": 50.47
  },
  {
    "y": -76,
    "r": 50.4
  },
  {
    "y": -75.5,
    "r": 50.3
  },
  {
    "y": -75,
    "r": 50.24
  },
  {
    "y": -74.5,
    "r": 50.11
  },
  {
    "y": -74,
    "r": 49.84
  },
  {
    "y": -73.5,
    "r": 49.64
  },
  {
    "y": -73,
    "r": 49.44
  },
  {
    "y": -72.5,
    "r": 49.26
  },
  {
    "y": -72,
    "r": 49.02
  },
  {
    "y": -71.5,
    "r": 48.87
  },
  {
    "y": -71,
    "r": 48.75
  },
  {
    "y": -70.5,
    "r": 48.66
  },
  {
    "y": -70,
    "r": 48.59
  },
  {
    "y": -69.5,
    "r": 48.53
  },
  {
    "y": -69,
    "r": 48.51
  },
  {
    "y": -68,
    "r": 43.32
  },
  {
    "y": -67,
    "r": 43.26
  },
  {
    "y": -65.5,
    "r": 48.51
  },
  {
    "y": -65,
    "r": 48.57
  },
  {
    "y": -64.5,
    "r": 48.71
  },
  {
    "y": -64,
    "r": 48.82
  },
  {
    "y": -63.5,
    "r": 49.07
  },
  {
    "y": -63,
    "r": 49.33
  },
  {
    "y": -62.5,
    "r": 49.58
  },
  {
    "y": -62,
    "r": 49.78
  },
  {
    "y": -61.5,
    "r": 49.93
  },
  {
    "y": -61,
    "r": 50.03
  },
  {
    "y": -60.5,
    "r": 50.06
  },
  {
    "y": -60,
    "r": 50.06
  },
  {
    "y": -59.5,
    "r": 50.04
  },
  {
    "y": -59,
    "r": 49.97
  },
  {
    "y": -58.5,
    "r": 49.86
  },
  {
    "y": -58,
    "r": 49.69
  },
  {
    "y": -57.5,
    "r": 49.46
  },
  {
    "y": -57,
    "r": 49.2
  },
  {
    "y": -56.5,
    "r": 48.91
  },
  {
    "y": -56,
    "r": 48.73
  },
  {
    "y": -55.5,
    "r": 48.61
  },
  {
    "y": -55,
    "r": 48.53
  },
  {
    "y": -54.5,
    "r": 48.5
  },
  {
    "y": -54,
    "r": 43.23
  },
  {
    "y": -53.5,
    "r": 48.5
  },
  {
    "y": -53,
    "r": 48.49
  },
  {
    "y": -52.5,
    "r": 48.08
  }
];
export const RIM_PROFILE_600ML: ProfilePoint[] = [
  {
    "y": 52.5,
    "r": 47.99
  },
  {
    "y": 53,
    "r": 48.05
  },
  {
    "y": 53.5,
    "r": 48.05
  },
  {
    "y": 54,
    "r": 48.01
  },
  {
    "y": 54.5,
    "r": 47.82
  },
  {
    "y": 55,
    "r": 48.05
  },
  {
    "y": 57.5,
    "r": 43.27
  },
  {
    "y": 60,
    "r": 48.05
  },
  {
    "y": 61,
    "r": 48.01
  },
  {
    "y": 61.5,
    "r": 48.05
  },
  {
    "y": 62,
    "r": 48.05
  },
  {
    "y": 62.5,
    "r": 47.98
  }
];

export const BASE_PROFILE_1L: ProfilePoint[] = [
  {
    "y": -103.47,
    "r": 57.6
  },
  {
    "y": -102.47,
    "r": 57.6
  },
  {
    "y": -101.97,
    "r": 57.6
  },
  {
    "y": -101.47,
    "r": 57.64
  },
  {
    "y": -100.97,
    "r": 57.7
  },
  {
    "y": -100.47,
    "r": 57.79
  },
  {
    "y": -99.97,
    "r": 57.91
  },
  {
    "y": -99.47,
    "r": 57.98
  },
  {
    "y": -98.97,
    "r": 58.15
  },
  {
    "y": -98.47,
    "r": 58.34
  },
  {
    "y": -97.97,
    "r": 58.57
  },
  {
    "y": -97.47,
    "r": 58.82
  },
  {
    "y": -96.97,
    "r": 59.07
  },
  {
    "y": -96.47,
    "r": 59.3
  },
  {
    "y": -95.97,
    "r": 59.5
  },
  {
    "y": -95.47,
    "r": 59.58
  },
  {
    "y": -94.97,
    "r": 59.73
  },
  {
    "y": -94.47,
    "r": 59.85
  },
  {
    "y": -93.97,
    "r": 59.94
  },
  {
    "y": -93.47,
    "r": 59.99
  },
  {
    "y": -92.97,
    "r": 60.01
  },
  {
    "y": -92.47,
    "r": 60.02
  },
  {
    "y": -91.97,
    "r": 60.01
  },
  {
    "y": -91.47,
    "r": 59.97
  },
  {
    "y": -90.97,
    "r": 59.94
  },
  {
    "y": -90.47,
    "r": 59.85
  },
  {
    "y": -89.97,
    "r": 59.73
  },
  {
    "y": -89.47,
    "r": 59.58
  },
  {
    "y": -88.97,
    "r": 59.4
  },
  {
    "y": -88.47,
    "r": 59.3
  },
  {
    "y": -87.97,
    "r": 59.07
  },
  {
    "y": -87.47,
    "r": 58.82
  },
  {
    "y": -86.97,
    "r": 58.5
  },
  {
    "y": -86.47,
    "r": 58.3
  },
  {
    "y": -85.97,
    "r": 58.12
  },
  {
    "y": -85.47,
    "r": 58.03
  },
  {
    "y": -84.97,
    "r": 57.89
  },
  {
    "y": -84.47,
    "r": 57.78
  },
  {
    "y": -83.97,
    "r": 57.69
  },
  {
    "y": -83.47,
    "r": 57.66
  },
  {
    "y": -82.97,
    "r": 57.61
  },
  {
    "y": -82.47,
    "r": 57.6
  },
  {
    "y": -81.47,
    "r": 51.33
  },
  {
    "y": -80.97,
    "r": 51.34
  },
  {
    "y": -79.97,
    "r": 51.32
  },
  {
    "y": -79.47,
    "r": 51.34
  },
  {
    "y": -78.97,
    "r": 51.34
  },
  {
    "y": -78.47,
    "r": 57.61
  },
  {
    "y": -77.97,
    "r": 57.67
  },
  {
    "y": -77.47,
    "r": 57.75
  },
  {
    "y": -76.97,
    "r": 57.92
  },
  {
    "y": -76.47,
    "r": 58.17
  },
  {
    "y": -75.97,
    "r": 58.38
  },
  {
    "y": -75.47,
    "r": 58.7
  },
  {
    "y": -74.97,
    "r": 58.91
  },
  {
    "y": -74.47,
    "r": 59.16
  },
  {
    "y": -73.97,
    "r": 59.3
  },
  {
    "y": -73.47,
    "r": 59.4
  },
  {
    "y": -72.97,
    "r": 59.47
  },
  {
    "y": -72.47,
    "r": 59.48
  },
  {
    "y": -71.97,
    "r": 59.48
  },
  {
    "y": -71.47,
    "r": 59.44
  },
  {
    "y": -70.97,
    "r": 59.37
  },
  {
    "y": -70.47,
    "r": 59.25
  },
  {
    "y": -69.97,
    "r": 59.1
  },
  {
    "y": -69.47,
    "r": 58.85
  },
  {
    "y": -68.97,
    "r": 58.61
  },
  {
    "y": -68.47,
    "r": 58.31
  },
  {
    "y": -67.97,
    "r": 58.12
  },
  {
    "y": -67.47,
    "r": 57.91
  },
  {
    "y": -66.97,
    "r": 57.79
  },
  {
    "y": -66.47,
    "r": 57.68
  },
  {
    "y": -65.97,
    "r": 57.65
  },
  {
    "y": -65.47,
    "r": 51.44
  },
  {
    "y": -64.97,
    "r": 51.44
  },
  {
    "y": -64.47,
    "r": 57.63
  },
  {
    "y": -63.97,
    "r": 57.63
  },
  {
    "y": -63.47,
    "r": 57.32
  }
];
export const RIM_PROFILE_1L: ProfilePoint[] = [
  {
    "y": 63.36,
    "r": 56.99
  },
  {
    "y": 63.86,
    "r": 57.09
  },
  {
    "y": 64.36,
    "r": 57.09
  },
  {
    "y": 64.86,
    "r": 57.09
  },
  {
    "y": 65.36,
    "r": 56.79
  },
  {
    "y": 65.86,
    "r": 56.93
  },
  {
    "y": 66.36,
    "r": 57.09
  },
  {
    "y": 66.86,
    "r": 51.34
  },
  {
    "y": 67.86,
    "r": 51.33
  },
  {
    "y": 68.36,
    "r": 51.34
  },
  {
    "y": 68.86,
    "r": 51.33
  },
  {
    "y": 69.36,
    "r": 51.38
  },
  {
    "y": 69.86,
    "r": 51.33
  },
  {
    "y": 70.36,
    "r": 51.33
  },
  {
    "y": 70.86,
    "r": 51.31
  },
  {
    "y": 71.36,
    "r": 51.31
  },
  {
    "y": 71.86,
    "r": 57.09
  },
  {
    "y": 72.36,
    "r": 57.09
  },
  {
    "y": 73.36,
    "r": 56.96
  },
  {
    "y": 73.86,
    "r": 57.09
  },
  {
    "y": 74.36,
    "r": 51.31
  },
  {
    "y": 74.86,
    "r": 57.09
  }
];

/**
 * Interpolates profile points to ensure vertical mesh resolution for relief displacement.
 */
export function resampleProfile(profile: ProfilePoint[], maxSpacing = 0.5): ProfilePoint[] {
  if (profile.length < 2) return profile;
  const resampled: ProfilePoint[] = [profile[0]];
  for (let i = 0; i < profile.length - 1; i++) {
    const p0 = profile[i];
    const p1 = profile[i + 1];
    const dy = p1.y - p0.y;
    const dr = p1.r - p0.r;
    const dist = Math.hypot(dy, dr);
    const steps = Math.max(1, Math.ceil(dist / maxSpacing));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      resampled.push({
        y: p0.y + dy * t,
        r: p0.r + dr * t,
      });
    }
  }
  return resampled;
}

/**
 * Revolve a 2D (r, y) profile into a watertight closed revolution solid.
 */
export function buildLatheAccent(
  profile: ProfilePoint[],
  radialSegments: number,
  closeBottom = true,
  closeTop = true,
): PrintableMesh {
  const denseProfile = resampleProfile(profile, 0.45);
  const nRings = denseProfile.length;
  const builder = new MeshBuilder((nRings + 2) * (radialSegments + 1), nRings * radialSegments * 2 + radialSegments * 2);
  const ringVerts: Uint32Array[] = [];

  for (let i = 0; i < nRings; i++) {
    const { y, r } = denseProfile[i];
    const ring = new Uint32Array(radialSegments);
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      ring[s] = builder.vertex(-1, x, y, z);
    }
    ringVerts.push(ring);
  }

  // Quads between consecutive rings
  for (let i = 0; i < nRings - 1; i++) {
    const r1 = ringVerts[i];
    const r2 = ringVerts[i + 1];
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      builder.quad(r1[s], r1[next], r2[next], r2[s]);
    }
  }

  // End caps
  if (closeBottom && nRings > 0) {
    const bottomCenter = builder.vertex(-1, 0, denseProfile[0].y, 0);
    const bottomRing = ringVerts[0];
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      builder.triangle(bottomCenter, bottomRing[next], bottomRing[s]);
    }
  }

  if (closeTop && nRings > 0) {
    const topCenter = builder.vertex(-1, 0, denseProfile[nRings - 1].y, 0);
    const topRing = ringVerts[nRings - 1];
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      builder.triangle(topCenter, topRing[s], topRing[next]);
    }
  }

  const cleaned = cleanMesh(builder.build()).mesh;
  if (computeMeshStats(cleaned).volume < 0) flipWinding(cleaned);
  return cleaned;
}
