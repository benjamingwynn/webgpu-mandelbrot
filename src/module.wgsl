struct Vertex {
  @location(0) position: vec2f,
};

struct VertexOutput {
	@builtin(position) position: vec4f,
}

// @group(0) @binding(1) var<storage, read> data: array<vec2<f32>>;

@vertex fn vs(vert: Vertex,) -> VertexOutput {
	var vsOut: VertexOutput;
  	// vsOut.position = vert.position;
	let x = vert.position.x;
	let y = vert.position.y;
	vsOut.position = vec4f(x, y, 0.0, 1.0); // x,y,z,homogeneous
	return vsOut;
  	// return vsOut;
}

@fragment fn fs(vsOut: VertexOutput) -> @location(0) vec4f {
  return vec4f(0, 1, 0, 1);
}