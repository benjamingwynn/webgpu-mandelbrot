@group(0) @binding(0) var<storage, read_write> rtn: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> config: Config;

struct Config {
	height: f32,
	width: f32,
}

struct Vertex {
  @location(0) position: vec2f,
};

@compute @workgroup_size(128) fn computeSomething(
@builtin(global_invocation_id) id: vec3u
) {
	var here:Vertex;

	let x = -1 + (f32(id.x) / config.width);
	let y = 1 - (f32(id.y) / config.width);
	// let z = id.z;

	// rtn = vec2f(x,y);
	rtn[id.x] = vec2f(x, y);
	// let index = id.x;

	// rtn = vec2f(0.232, 0.745);

	// return rtn;

	// rtn[rtnIndex] = [1, 1];
}