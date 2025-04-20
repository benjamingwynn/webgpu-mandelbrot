// See: https://github.com/clickingbuttons/jeditrader/blob/a921a0e/shaders/src/fp64.wgsl
// Whitepaper: https://andrewthall.org/papers/dfp64_qf128.pdf
// WGSL port of https://github.com/visgl/luma.gl/blob/291a2fdfb1cfdb15405032b3dcbfbe55133ead61/modules/shadertools/src/modules/math/fp64/fp64-arithmetic.glsl.ts

// @global override 1.0: f32 = 1.0;

struct fp64 {
	high: f32,
	low: f32,
}

// Divide float number to high and low floats to extend fraction bits
fn split64(a: f32) -> fp64 {
	let c = (f32(1u << 12u) + 1.0) * a;
	let a_big = c - a;
	let a_hi = c * 1.0 - a_big;
	let a_lo = a * 1.0 - a_hi;
	return fp64(a_hi, a_lo);
}

// Special sum operation when a > b
fn quickTwoSum(a: f32, b: f32) -> fp64 {
	let x = (a + b) * 1.0;
	let b_virt = (x - a) * 1.0;
	let y = b - b_virt;
	return fp64(x, y);
}

fn twoSum(a: f32, b: f32) -> fp64 {
	let x = (a + b);
	let b_virt = (x - a) * 1.0;
	let a_virt = (x - b_virt) * 1.0;
	let b_err = b - b_virt;
	let a_err = a - a_virt;
	let y = a_err + b_err;
	return fp64(x, y);
}

fn twoSub(a: f32, b: f32) -> fp64 {
	let s = (a - b);
	let v = (s * 1.0 - a) * 1.0;
	let err = (a - (s - v) * 1.0) * 1.0 - (b + v);
	return fp64(s, err);
}

fn twoProd(a: f32, b: f32) -> fp64 {
	let x = a * b;
	let a2 = split64(a);
	let b2 = split64(b);
	let err1 = x - (a2.high * b2.high * 1.0) * 1.0;
	let err2 = err1 - (a2.low * b2.high * 1.0) * 1.0;
	let err3 = err2 - (a2.high * b2.low * 1.0) * 1.0;
	let y = a2.low * b2.low - err3;
	return fp64(x, y);
}

fn sum64(a: fp64, b: fp64) -> fp64 {
	var s = twoSum(a.high, b.high);
	var t = twoSum(a.low, b.low);
	s.low += t.high;
	s = quickTwoSum(s.high, s.low);
	s.low += t.low;
	s = quickTwoSum(s.high, s.low);
	return s;
}

fn sub64(a: fp64, b: fp64) -> fp64 {
	var s = twoSub(a.high, b.high);
	var t = twoSub(a.low, b.low);
	s.low += t.high;
	s = quickTwoSum(s.high, s.low);
	s.low += t.low;
	s = quickTwoSum(s.high, s.low);
	return fp64(s.high, s.low);
}

fn mul64(a: fp64, b: fp64) -> fp64 {
	var p = twoProd(a.high, b.high);
	p.low += a.high * b.low;
	p.low += a.low * b.high;
	p = quickTwoSum(p.high, p.low);
	return p;
}

fn vec4_sub64(a: array<fp64, 4>, b: array<fp64, 4>) -> array<fp64, 4> {
	return array<fp64, 4>(
		sub64(a[0], b[0]),
		sub64(a[1], b[1]),
		sub64(a[2], b[2]),
		sub64(a[3], b[3]),
	);
}

fn vec4_dot64(a: array<fp64, 4>, b: array<fp64, 4>) -> fp64 {
	var v = array<fp64, 4>();

	v[0] = mul64(a[0], b[0]);
	v[1] = mul64(a[1], b[1]);
	v[2] = mul64(a[2], b[2]);
	v[3] = mul64(a[3], b[3]);

	return sum64(sum64(v[0], v[1]), sum64(v[2], v[3]));
}

fn mat4_vec4_mul64(b: array<fp64, 16>, a: array<fp64, 4>) -> array<fp64, 4> {
	var res = array<fp64, 4>();
	var tmp = array<fp64, 4>();

	for (var i = 0u; i < 4u; i++) {
		for (var j = 0u; j < 4u; j++) {
			tmp[j] = b[j * 4u + i];
		}
		res[i] = vec4_dot64(a, tmp);
	}

	return res;
}

fn toVec4(v: array<fp64, 4>) -> vec4f {
	return vec4f(
		v[0].high + v[0].low,
		v[1].high + v[1].low,
		v[2].high + v[2].low,
		v[3].high + v[3].low,
	);
}

fn mat64(high: mat4x4f, low: mat4x4f) -> array<fp64, 16> {
	return array<fp64, 16>(
		fp64(high[0][0], low[0][0]),
		fp64(high[0][1], low[0][1]),
		fp64(high[0][2], low[0][2]),
		fp64(high[0][3], low[0][3]),

		fp64(high[1][0], low[1][0]),
		fp64(high[1][1], low[1][1]),
		fp64(high[1][2], low[1][2]),
		fp64(high[1][3], low[1][3]),

		fp64(high[2][0], low[2][0]),
		fp64(high[2][1], low[2][1]),
		fp64(high[2][2], low[2][2]),
		fp64(high[2][3], low[2][3]),

		fp64(high[3][0], low[3][0]),
		fp64(high[3][1], low[3][1]),
		fp64(high[3][2], low[3][2]),
		fp64(high[3][3], low[3][3]),
	);
}

fn vec4_64(high: vec4f, low: vec4f) -> array<fp64, 4> {
	return array<fp64, 4>(
		fp64(high[0], low[0]),
		fp64(high[1], low[1]),
		fp64(high[2], low[2]),
		fp64(high[3], low[3]),
	);
}
/// <end of f64 support>

// additionally we need sqrt
fn sqrt64(a: fp64) -> fp64 {
    // Handle special cases
    if (a.high <= 0.0 && a.low <= 0.0) {
        return fp64(0.0, 0.0);
    }

    // Initial approximation using single-precision sqrt
    let initial_guess = sqrt(a.high);
    var x = fp64(initial_guess, 0.0);

    // Newton-Raphson iterations: x = 0.5 * (x + a/x)
    // Just a few iterations are usually sufficient
    for (var i = 0; i < 3; i++) {
        // Calculate a/x
        let t1 = a.high / x.high;
        let t2 = split64(t1);
        let t3 = twoProd(t2.high, x.high);
        let t4 = sub64(a, t3);
        let t5 = t4.high / x.high;
        let t6 = fp64(t1, t5);

        // x = 0.5 * (x + a/x)
        let half = fp64(0.5, 0.0);
        let sum = sum64(x, t6);
        x = mul64(half, sum);
    }

    return x;
}

// compute.wgsl
@group(0) @binding(0) var<storage, read_write> rtn: array<f32>;
@group(0) @binding(1) var<storage, read_write> config: Config;

struct Config {
	width: f32,
	height: f32,
	cx_hi: f32,
	cx_lo: f32,
	cy_hi: f32,
	cy_lo: f32,
	scale_hi: f32,
	scale_lo: f32,
}

@compute @workgroup_size(1, 1) fn main(
	@builtin(global_invocation_id) id: vec3u
) {
	let pixel_index = id.y * u32(config.width) + id.x;
	let buffer_index = pixel_index * 12;

	let zr_hi = rtn[buffer_index + 0];
	let zr_lo = rtn[buffer_index + 1];
	let zr = fp64(zr_hi, zr_lo);
	let zi_hi = rtn[buffer_index + 2];
	let zi_lo = rtn[buffer_index + 3];
	let zi = fp64(zi_hi, zi_lo);
	let cr_hi = rtn[buffer_index + 4];
	let cr_lo = rtn[buffer_index + 5];
	let cr = fp64(cr_hi, cr_lo);
	let ci_hi = rtn[buffer_index + 6];
	let ci_lo = rtn[buffer_index + 7];
	let ci = fp64(ci_hi, ci_lo);
	let iteration = rtn[buffer_index + 8];
	let finished = rtn[buffer_index + 9];
	// x & y are also here, but are untouched

	if (finished == 0.0) {
		let ratio32 = config.width / config.height;
		let ratio = split64(ratio32);
		let scale = fp64(config.scale_hi, config.scale_lo);
		let cx = fp64(config.cx_hi, config.cx_lo);
		let cy = fp64(config.cy_hi, config.cy_lo);

		let cr_scaled = sum64(mul64(mul64(cr, ratio), scale), cx);
		let ci_scaled = sum64(mul64(ci, scale), cy);

		// let newRe = zr * zr - zi * zi + cr_scaled;
		let zr2 = mul64(zr, zr);           // zr * zr
		let zi2 = mul64(zi, zi);           // zi * zi
		let diff = sub64(zr2, zi2);        // zr² - zi²
		let newRe = sum64(diff, cr_scaled); // + cr_scaled

		// let newIm = two * zr * zi + ci_scaled;
		let two = split64(2.0);            // represent 2.0 in fp64
		let zrzi = mul64(zr, zi);          // zr * zi
		let twzrzi = mul64(two, zrzi);     // 2 * zr * zi
		let newIm = sum64(twzrzi, ci_scaled); // + ci_scaled

		// let magnitude = sqrt(newRe * newRe + newIm * newIm);
		let newRe2 = mul64(newRe, newRe);     // newRe * newRe
		let newIm2 = mul64(newIm, newIm);     // newIm * newIm
		let sum = sum64(newRe2, newIm2);      // newRe² + newIm²
		let four = fp64(4.0, 0.0);
		let sum_squared = sum64(newRe2, newIm2);  // newRe² + newIm²
		let is_greater = (sum_squared.high > four.high) || (sum_squared.high == four.high && sum_squared.low > four.low);
		// bit of a hack using f32 as a boolean representation
		if (is_greater) {
			rtn[buffer_index + 9] = 1.0;
		}

		rtn[buffer_index + 0] = newRe.high;
		rtn[buffer_index + 1] = newRe.low;
		rtn[buffer_index + 2] = newIm.high;
		rtn[buffer_index + 3] = newIm.low;
		rtn[buffer_index + 4] = cr_hi;
		rtn[buffer_index + 5] = cr_lo;
		rtn[buffer_index + 6] = ci_hi;
		rtn[buffer_index + 7] = ci_lo;
		rtn[buffer_index + 8] = iteration + 1;

		// if (magnitude > 2) {
		// 	rtn[buffer_index + 9] = 1.0;
		// } else {
		// 	rtn[buffer_index + 9] = 0.0;
		// }
	}
}