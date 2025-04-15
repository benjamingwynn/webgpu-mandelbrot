/** [zr, zi, cr, ci, iteration, escaped] */
type IteratedMandelbrot = [number, number, number, number, number, boolean]

function iterateMandelbrot(zr: number, zi: number, cr: number, ci: number, iteration: number, alreadyDone: boolean): IteratedMandelbrot {
	if (alreadyDone) return [zr, zi, cr, ci, iteration + 1, alreadyDone]
	// z and c are complex numbers: { re, im }
	// Perform z = z^2 + c

	// z^2 = (zr + zi*i)^2 = zr^2 - zi^2 + 2*zr*zi*i
	const newRe = zr * zr - zi * zi + cr
	const newIm = 2 * zr * zi + ci

	const magnitude = Math.sqrt(newRe * newRe + newIm * newIm)

	return [newRe, newIm, cr, ci, iteration + 1, magnitude > 2]
}

function testPoint(x: number, y: number, maxIterations = 1000) {
	let state: IteratedMandelbrot = [0, 0, x, y, 0, false]

	while (state[4] < maxIterations) {
		state = iterateMandelbrot(...state)
		// if (state[5]) break
	}

	return state
}

// Try a point!
const x = -1
const y = -1
const rtn = testPoint(x, y)
console.log("*", x, ",", y, "iterations before escape", rtn[4], "/", rtn)
