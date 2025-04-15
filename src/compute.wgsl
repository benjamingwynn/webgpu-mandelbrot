// compute.wgsl
@group(0) @binding(0) var<storage, read_write> rtn: array<f32>;
@group(0) @binding(1) var<storage, read_write> config: Config;

struct Config {
	width: f32,
	height: f32,
	cx: f32,
	cy: f32,
	scale: f32,
}

@compute @workgroup_size(1, 1) fn main(
	@builtin(global_invocation_id) id: vec3u
) {
	let pixel_index = id.y * u32(config.width) + id.x;
	let buffer_index = pixel_index * 6;

	let zr = rtn[buffer_index + 0];
	let zi = rtn[buffer_index + 1];
	let cr = rtn[buffer_index + 2];
	let ci = rtn[buffer_index + 3];
	let iteration = rtn[buffer_index + 4];
	let alreadyDone = rtn[buffer_index + 5];

	if (alreadyDone == 0.0) {
		let ratio = config.width / config.height;

		let cr_scaled = (cr * ratio) * config.scale + config.cx;
		let ci_scaled = ci * config.scale + config.cy;

		let newRe = zr * zr - zi * zi + cr_scaled;
		let newIm = 2.0 * zr * zi + ci_scaled;

		let magnitude = sqrt(newRe * newRe + newIm * newIm);

		rtn[buffer_index + 0] = newRe;
		rtn[buffer_index + 1] = newIm;
		rtn[buffer_index + 2] = cr;
		rtn[buffer_index + 3] = ci;
		rtn[buffer_index + 4] = iteration + 1;
		// bit of a hack using f32 as a boolean representation
		if (magnitude > 2) {
			rtn[buffer_index + 5] = 1.0;
		} else {
			rtn[buffer_index + 5] = 0.0;
		}
	}
}