struct Vertex {
	@location(0) a: vec3f,
	@location(1) b: vec3f,
};

struct VertexOutput {
	@builtin(position) position: vec4f,
}

@vertex fn vs(vert: Vertex,) -> VertexOutput {
	var vsOut: VertexOutput;

	let zr = vert.a.x;
	let zi = vert.a.y;
	let cr = vert.a.z;
	let ci = vert.b.x;
	let iteration = vert.b.y;
	let done = vert.b.z;

	let x = cr;
	let y = ci;

	var z: f32;
	if (done == 1.0) {
		// we escaped, so color based on how many we took to escape
		// todo: why 50?
		z = iteration / 100;
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