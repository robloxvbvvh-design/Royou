// Простая физика на AABB-коробках: лучи, столкновения, поиск земли.
// Коллайдер: { minx, miny, minz, maxx, maxy, maxz, walk?: bool }

export function makeCollider(cx, y, cz, w, h, d, extra) {
  return { minx: cx - w / 2, maxx: cx + w / 2, miny: y, maxy: y + h, minz: cz - d / 2, maxz: cz + d / 2, ...extra };
}

// Пересечение луча с коробкой. Возвращает t или -1.
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minx || ox > b.maxx) return -1; }
  else { let t1 = (b.minx - ox) / dx, t2 = (b.maxx - ox) / dx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.miny || oy > b.maxy) return -1; }
  else { let t1 = (b.miny - oy) / dy, t2 = (b.maxy - oy) / dy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minz || oz > b.maxz) return -1; }
  else { let t1 = (b.minz - oz) / dz, t2 = (b.maxz - oz) / dz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  return tmin;
}

// Ближайшее попадание луча в карту → t или -1
export function raycastWorld(cols, ox, oy, oz, dx, dy, dz, maxT) {
  let best = -1;
  for (let i = 0; i < cols.length; i++) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, cols[i], best >= 0 ? best : maxT);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

// Высота верхней поверхности под точкой (ниже fromY)
export function groundAt(cols, x, z, fromY, r = 0) {
  let best = -Infinity, which = null;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (x + r < c.minx || x - r > c.maxx || z + r < c.minz || z - r > c.maxz) continue;
    if (c.maxy <= fromY + 0.01 && c.maxy > best) { best = c.maxy; which = c; }
  }
  return { y: best, col: which };
}

// Свободен ли объём (персонаж: радиус r, высота h) в точке
export function volumeClear(cols, x, y, z, r, h) {
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (x + r > c.minx && x - r < c.maxx && z + r > c.minz && z - r < c.maxz && y + h > c.miny && y < c.maxy) return false;
  }
  return true;
}
