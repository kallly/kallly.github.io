export function distance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

// Test point-dans-polygone par ray-casting. `points` : [{x,y}, ...] dans le même repère que x/y.
export function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        const intersects = (yi > y) !== (yj > y)
            && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
        if (intersects) {
            inside = !inside;
        }
    }
    return inside;
}

// Distance perpendiculaire (bornée aux extrémités) entre (px,py) et le segment [(x1,y1)-(x2,y2)].
// Utilisé par PathModel.findAt pour la détection au clic sur une polyligne ouverte
// (un chemin n'a pas d'intérieur comme un polygone, donc pointInPolygon ne s'applique pas).
export function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return distance(px, py, x1, y1);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    return distance(px, py, x1 + t * dx, y1 + t * dy);
}

// Longueur totale d'une polyligne (somme des segments). `points` : [{x,y}, ...].
export function polylineLength(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += distance(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    return total;
}

// Longueur de la portion du segment [(x1,y1)-(x2,y2)] contenue dans le disque de centre (cx,cy)
// et de rayon r — clippe le segment au cercle en résolvant |P(t) - centre|² = r² (t ∈ [0,1]).
export function segmentLengthInCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    if (a === 0) {
        return 0;
    }

    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    const discriminant = b * b - 4 * a * c;
    const segmentLength = Math.sqrt(a);

    if (discriminant < 0) {
        // Aucun croisement avec le cercle : le segment est entièrement dedans (c < 0) ou dehors.
        return c < 0 ? segmentLength : 0;
    }

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = Math.max(0, (-b - sqrtDisc) / (2 * a));
    const t2 = Math.min(1, (-b + sqrtDisc) / (2 * a));

    return t2 > t1 ? (t2 - t1) * segmentLength : 0;
}

// Vrai si le disque de centre (x,y) et de rayon `radius` est entièrement contenu dans le polygone
// `points` : le centre doit être dedans, ET aucune arête ne doit passer à moins de `radius`
// (sinon le cercle en dépasserait). Suppose un polygone simple (non auto-intersectant),
// hypothèse raisonnable pour une zone dessinée à la main (PolygonModel).
export function isCircleInPolygon(x, y, radius, points) {
    if (!pointInPolygon(x, y, points)) {
        return false;
    }
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        if (distanceToSegment(x, y, points[j].x, points[j].y, points[i].x, points[i].y) < radius) {
            return false;
        }
    }
    return true;
}
