// Recherche par grille (grossière puis affinée) du point maximisant `score(x,y)` parmi ceux où
// `isValid(x,y)` est vrai, à l'intérieur de la boîte englobante de `points`. Cède périodiquement
// la main (setTimeout 0) pour ne jamais bloquer le thread principal, même sur une grande zone.
export async function findBestPositionInPolygon({ points, isValid, score, yieldEvery = 200 }) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    let best = null;
    let evaluated = 0;

    async function scan(x0, x1, y0, y1, step) {
        for (let x = x0; x <= x1; x += step) {
            for (let y = y0; y <= y1; y += step) {
                if (isValid(x, y)) {
                    const s = score(x, y);
                    if (!best || s > best.score) {
                        best = { x, y, score: s };
                    }
                }
                evaluated++;
                if (evaluated % yieldEvery === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }
    }

    // Passe grossière : ~40 pas sur la plus grande dimension de la boîte englobante.
    const coarseStep = Math.max(4, Math.max(maxX - minX, maxY - minY) / 40);
    await scan(minX, maxX, minY, maxY, coarseStep);

    if (best) {
        // Raffinement autour du meilleur point grossier, sur un pas ~8x plus fin.
        const fineStep = Math.max(2, coarseStep / 8);
        await scan(best.x - coarseStep, best.x + coarseStep, best.y - coarseStep, best.y + coarseStep, fineStep);
    }

    return best; // { x, y, score } ou null si aucun point valide
}
