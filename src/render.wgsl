// render.wgsl

// fn decode_fp64(v: vec2f) -> f32 {
// 	return v.x + v.y;
// }

struct Vertex {
	// @location(0) cr_enc: vec2f,
	// @location(1) ci_enc: vec2f,
	@location(2) z: vec2f,
	// screen space position in 32 bit, never changes
	@location(3) pos: vec2f,
};

struct VertexOutput {
	@builtin(position) position: vec4f,
}

@vertex fn vs(vert: Vertex,) -> VertexOutput {
	var vsOut: VertexOutput;

	let iteration = vert.z.x;
	let done = vert.z.y;

	let x = vert.pos.x;
	let y = vert.pos.y;

	var z: f32;
	if (done == 1.0) {
		// we escaped, so color based on how many we took to escape
		// todo: this hard coded number should be the max number of iterations
		z = iteration / 500;
	} else {
		// we never escaped, so color black
		z = 0.0;
	}

	vsOut.position = vec4f(x, y, z, 1.0);
	return vsOut;
}

@fragment fn fs(vsOut: VertexOutput) -> @location(0) vec4f {
	// hook intensity to green channel for now
	return vec4f(0, vsOut.position.z, 0, 1);
}