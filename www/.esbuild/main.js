// src/render.wgsl
var render_default = "struct Vertex {\n	@location(0) a: vec3f,\n	@location(1) b: vec3f,\n};\n\nstruct VertexOutput {\n	@builtin(position) position: vec4f,\n}\n\n@vertex fn vs(vert: Vertex,) -> VertexOutput {\n	var vsOut: VertexOutput;\n\n	let zr = vert.a.x;\n	let zi = vert.a.y;\n	let cr = vert.a.z;\n	let ci = vert.b.x;\n	let iteration = vert.b.y;\n	let done = vert.b.z;\n\n	let x = cr;\n	let y = ci;\n\n	var z: f32;\n	if (done == 1.0) {\n		// we escaped, so color based on how many we took to escape\n		// todo: this hard coded number should be the max number of iterations\n		z = iteration / 500;\n	} else {\n		// we never escaped, so color black\n		z = 0.0;\n	}\n\n	vsOut.position = vec4f(x, y, z, 1.0);\n	return vsOut;\n}\n\n@fragment fn fs(vsOut: VertexOutput) -> @location(0) vec4f {\n	// hook intensity to green channel for now\n	return vec4f(0, vsOut.position.z, 0, 1);\n}";

// src/compute.wgsl
var compute_default = "// compute.wgsl\n@group(0) @binding(0) var<storage, read_write> rtn: array<f32>;\n@group(0) @binding(1) var<storage, read_write> config: Config;\n\nstruct Config {\n	width: f32,\n	height: f32,\n	cx: f32,\n	cy: f32,\n	scale: f32,\n}\n\n@compute @workgroup_size(1, 1) fn main(\n	@builtin(global_invocation_id) id: vec3u\n) {\n	let pixel_index = id.y * u32(config.width) + id.x;\n	let buffer_index = pixel_index * 6;\n\n	let zr = rtn[buffer_index + 0];\n	let zi = rtn[buffer_index + 1];\n	let cr = rtn[buffer_index + 2];\n	let ci = rtn[buffer_index + 3];\n	let iteration = rtn[buffer_index + 4];\n	let alreadyDone = rtn[buffer_index + 5];\n\n	if (alreadyDone == 0.0) {\n		let ratio = config.width / config.height;\n\n		let cr_scaled = (cr * ratio) * config.scale + config.cx;\n		let ci_scaled = ci * config.scale + config.cy;\n\n		let newRe = zr * zr - zi * zi + cr_scaled;\n		let newIm = 2.0 * zr * zi + ci_scaled;\n\n		let magnitude = sqrt(newRe * newRe + newIm * newIm);\n\n		rtn[buffer_index + 0] = newRe;\n		rtn[buffer_index + 1] = newIm;\n		rtn[buffer_index + 2] = cr;\n		rtn[buffer_index + 3] = ci;\n		rtn[buffer_index + 4] = iteration + 1;\n		// bit of a hack using f32 as a boolean representation\n		if (magnitude > 2) {\n			rtn[buffer_index + 5] = 1.0;\n		} else {\n			rtn[buffer_index + 5] = 0.0;\n		}\n	}\n}";

// src/main.ts
new EventSource("/esbuild").addEventListener("change", () => location.reload());
var computePasses = 500;
var cx = -0.746;
var cy = -0.11;
var scale = 2;
var nogpu = document.createElement("h1");
nogpu.textContent = "your browser doesn't have WebGPU enabled, or it couldn't get a GPU";
var canvas = document.createElement("canvas");
canvas.width = 1200;
canvas.height = 800;
document.body.appendChild(canvas);
canvas.setAttribute("style", `border: blue solid 1px`);
var ctx = canvas.getContext("webgpu");
if (!ctx) {
  document.body.append(nogpu);
  throw new Error("browser does not support WebGPU");
}
var adapter = await navigator.gpu?.requestAdapter();
var device = await adapter?.requestDevice({ requiredLimits: { maxBufferSize: 1024 * 1024 } });
if (!device) {
  document.body.append(nogpu);
  throw new Error("need a browser that supports WebGPU");
}
var presentationFormat = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({
  device,
  format: presentationFormat,
  alphaMode: "premultiplied"
});
var width = canvas.width;
var height = canvas.height;
var points = [];
for (let yIndex = 0; yIndex < height; yIndex++) {
  for (let xIndex = 0; xIndex < width; xIndex++) {
    const x = -1 + xIndex / (width / 2);
    const y = 1 - yIndex / (height / 2);
    const zr = 0;
    const zi = 0;
    const cr = x;
    const ci = y;
    const iteration = 0;
    const done = 0;
    points.push(zr, zi, cr, ci, iteration, done);
  }
}
var initialPoints = new Float32Array(points);
var initialPointsSize = initialPoints.byteLength;
var computeBufferSize = initialPoints.byteLength;
var renderBufferSize = initialPoints.byteLength;
var renderDrawPassCount = width * height;
var setConfig = (width2, height2, cx2, cy2, scale2) => {
  computeConfig.set([width2, height2, cx2, cy2, scale2]);
  device.queue.writeBuffer(computeConfigBuffer, 0, computeConfig);
};
var computeConfig = new Float32Array([width, height, cx, cy, scale]);
var computeConfigBufferSize = computeConfig.byteLength;
var initialBuffer = device.createBuffer({
  label: "initialBuffer",
  size: initialPointsSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
});
var computeWorkingBuffer = device.createBuffer({
  label: "computeWorkingBuffer",
  size: computeBufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
});
var computeConfigBuffer = device.createBuffer({
  label: "computeConfigBuffer",
  size: computeConfigBufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
});
device.queue.writeBuffer(computeConfigBuffer, 0, computeConfig);
var computeResultBuffer = device.createBuffer({
  label: "computeResultBuffer",
  size: computeBufferSize,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
});
var computeBindGroupLayout = device.createBindGroupLayout({
  label: "computeBindGroupLayout",
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" }
    },
    {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" }
    }
  ]
});
var computeBindGroupPipelineLayout = device.createPipelineLayout({
  label: "computeBindGroupPipelineLayout",
  bindGroupLayouts: [computeBindGroupLayout]
});
var computePipeline = device.createComputePipeline({
  label: "computePipeline",
  layout: computeBindGroupPipelineLayout,
  compute: {
    module: device.createShaderModule({
      label: "computePipeline.module",
      code: compute_default
    })
  }
});
var renderDrawBuffer = device.createBuffer({
  label: "renderDrawBuffer",
  size: renderBufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
});
var renderBindGroupLayout = device.createBindGroupLayout({
  label: "renderBindGroupLayout",
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "read-only-storage" }
    },
    {
      binding: 1,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "read-only-storage" }
    }
  ]
});
var renderBindGroupPipelineLayout = device.createPipelineLayout({
  label: "renderBindGroupPipelineLayout",
  bindGroupLayouts: [renderBindGroupLayout]
});
var module = device.createShaderModule({
  label: "render module",
  code: render_default
});
var renderPipeline = device.createRenderPipeline({
  label: "renderPipeline",
  // layout: unifiedBindGroupPipelineLayout,
  layout: renderBindGroupPipelineLayout,
  vertex: {
    module,
    entryPoint: "vs",
    buffers: [
      {
        arrayStride: 6 * 4,
        // 6 floats of 4 bytes
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x3"
          },
          {
            shaderLocation: 1,
            offset: 3 * 4,
            format: "float32x3"
          }
        ]
      }
    ]
  },
  fragment: {
    module,
    targets: [
      {
        format: presentationFormat,
        blend: {
          color: {
            // source: https://stackoverflow.com/a/72682494
            operation: "add",
            srcFactor: "src-alpha",
            dstFactor: "one-minus-src-alpha"
          },
          alpha: {
            // source: https://webgpufundamentals.org/webgpu/lessons/webgpu-transparency.html
            operation: "add",
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha"
          }
        }
      }
    ]
  },
  primitive: {
    topology: "point-list"
  }
});
var computeBindGroup = device.createBindGroup({
  label: "computeBindGroup",
  layout: computeBindGroupLayout,
  entries: [
    { binding: 0, resource: { buffer: computeWorkingBuffer } },
    { binding: 1, resource: { buffer: computeConfigBuffer } }
  ]
});
var renderBindGroup = device.createBindGroup({
  label: "renderBindGroup",
  layout: renderBindGroupLayout,
  entries: [
    { binding: 0, resource: { buffer: computeResultBuffer } },
    { binding: 1, resource: { buffer: renderDrawBuffer } }
  ]
});
var renderTime;
var onFrame = () => {
  const tStart = performance.now();
  device.queue.writeBuffer(initialBuffer, 0, initialPoints);
  const encoder = device.createCommandEncoder({
    label: "encoder"
  });
  encoder.copyBufferToBuffer(initialBuffer, 0, computeWorkingBuffer, 0, computeWorkingBuffer.size);
  const computePass = encoder.beginComputePass({
    label: "computePass"
  });
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  for (let i = 0; i < computePasses; i++) {
    computePass.dispatchWorkgroups(width, height);
  }
  computePass.end();
  encoder.copyBufferToBuffer(computeWorkingBuffer, 0, computeResultBuffer, 0, computeResultBuffer.size);
  const textureView = ctx.getCurrentTexture().createView();
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: [0, 0, 0, 0],
        // Clear to transparent
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  };
  const passEncoderRender = encoder.beginRenderPass(renderPassDescriptor);
  passEncoderRender.setPipeline(renderPipeline);
  passEncoderRender.setBindGroup(0, renderBindGroup);
  passEncoderRender.setVertexBuffer(0, computeResultBuffer);
  passEncoderRender.draw(renderDrawPassCount);
  passEncoderRender.end();
  device.queue.submit([encoder.finish()]);
  const tEnd = performance.now();
  renderTime = tEnd - tStart;
  return renderTime;
};
onFrame();
var debug = document.createElement("code");
var nFrame = 0;
var pause = true;
var doFrame = () => {
  if (!pause) {
    const t0 = performance.now();
    setConfig(width, height, cx, cy, scale *= 0.99);
    const msForCopy = performance.now() - t0;
    const msForFrame = onFrame();
    if (nFrame % 60 === 0) {
      const tMs = msForCopy + msForFrame;
      const fps = (1e3 / tMs).toFixed(1);
      debug.innerText = "scale=" + scale + ". " + tMs + "ms. copy=" + msForCopy + " compute+render=" + msForFrame + ". " + fps + " fps. passes=" + computePasses;
      if (scale < 1e-7) {
        scale = 2;
      }
    }
    nFrame++;
  }
  requestAnimationFrame(doFrame);
};
var reset = document.createElement("button");
reset.type = "button";
reset.innerText = "reset scale";
reset.onclick = () => {
  scale = 2;
};
document.body.append(reset);
var playPause = document.createElement("button");
playPause.type = "button";
playPause.innerText = "play/pause";
playPause.onclick = () => {
  pause = !pause;
};
document.body.append(playPause);
document.body.append(debug);
requestAnimationFrame(doFrame);
