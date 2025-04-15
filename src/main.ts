new EventSource("/esbuild").addEventListener("change", () => location.reload())

import moduleWGSL from "./module.wgsl"
import computeWGSL from "./compute.wgsl"
// import vertWGSL from "./vert.wgsl"
// import fragWGSL from "./frag.wgsl"

const canvas = document.createElement("canvas")
document.body.appendChild(canvas)
canvas.setAttribute("style", `border: blue solid 1px`)
const ctx = canvas.getContext("webgpu")
if (!ctx) {
	throw new Error("browser does not support WebGPU")
}

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice({requiredLimits: {maxBufferSize: 1024 * 1024}})
if (!device) {
	throw new Error("need a browser that supports WebGPU")
}

const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
ctx.configure({
	device,
	format: presentationFormat,
	alphaMode: "premultiplied",
})

const width = canvas.width
const height = canvas.height

// todo: need to probably * by float 32 size
const computeBufferSize = width * height
const renderBufferSize = width * height
const renderDrawPassCount = width * 1
const computeConfig = new Float32Array([width, height])
const computeConfigBufferSize = computeConfig.byteLength

// buffer to go from compute pass to render pass
const computeWorkingBuffer = device.createBuffer({
	label: "computeWorkingBuffer",
	size: computeBufferSize,
	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
})

const computeConfigBuffer = device.createBuffer({
	label: "computeConfigBuffer",
	size: computeConfigBufferSize,
	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
})
device.queue.writeBuffer(computeConfigBuffer, 0, computeConfig)

const computeResultBuffer = device.createBuffer({
	label: "computeResultBuffer",
	size: computeBufferSize,
	usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
})

const computeBindGroupLayout = device.createBindGroupLayout({
	label: "computeBindGroupLayout",
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {type: "storage"},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {type: "storage"},
		},
	],
})

const computeBindGroupPipelineLayout = device.createPipelineLayout({
	label: "computeBindGroupPipelineLayout",
	bindGroupLayouts: [computeBindGroupLayout],
})

const computePipeline = device.createComputePipeline({
	label: "computePipeline",
	layout: computeBindGroupPipelineLayout,
	compute: {
		module: device.createShaderModule({
			label: "computePipeline.module",
			code: computeWGSL,
		}),
	},
})

const renderDrawBuffer = device.createBuffer({
	label: "renderDrawBuffer",
	size: renderBufferSize,
	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
})

const renderBindGroupLayout = device.createBindGroupLayout({
	label: "renderBindGroupLayout",
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.VERTEX,
			buffer: {type: "read-only-storage"},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.VERTEX,
			buffer: {type: "read-only-storage"},
		},
	],
})

const renderBindGroupPipelineLayout = device.createPipelineLayout({
	label: "renderBindGroupPipelineLayout",
	bindGroupLayouts: [renderBindGroupLayout],
})

const module = device.createShaderModule({
	label: "render module",
	code: moduleWGSL,
})

const renderPipeline = device.createRenderPipeline({
	label: "renderPipeline",
	// layout: unifiedBindGroupPipelineLayout,
	layout: renderBindGroupPipelineLayout,

	vertex: {
		module,
		entryPoint: "vs",
		buffers: [
			{
				arrayStride: 2 * 4, // 2 floats of 4 bytes
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: "float32x2",
					},
				],
			},
		],
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
						dstFactor: "one-minus-src-alpha",
					},
					alpha: {
						// source: https://webgpufundamentals.org/webgpu/lessons/webgpu-transparency.html
						operation: "add",
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha",
					},
				},
			},
		],
	},
	primitive: {
		topology: "point-list",
	},
})

const onFrame = () => {
	console.log("draw frame!")

	const computeBindGroup = device.createBindGroup({
		label: "computeBindGroup",
		layout: computeBindGroupLayout,
		entries: [
			//
			{binding: 0, resource: {buffer: computeWorkingBuffer}},
			{binding: 1, resource: {buffer: computeConfigBuffer}},
		],
	})
	const encoder = device.createCommandEncoder({
		label: "encoder",
	})

	const computePass = encoder.beginComputePass({
		label: "computePass",
	})
	computePass.setPipeline(computePipeline)
	computePass.setBindGroup(0, computeBindGroup)
	// ...
	computePass.dispatchWorkgroups(width, height)
	// ...
	computePass.end()

	// copy working buffer to result buffer
	encoder.copyBufferToBuffer(computeWorkingBuffer, 0, computeResultBuffer, 0, computeResultBuffer.size)

	// ..

	// draw the result:
	const renderBindGroup = device.createBindGroup({
		label: "renderBindGroup",
		layout: renderBindGroupLayout,
		entries: [
			{binding: 0, resource: {buffer: computeResultBuffer}},
			{binding: 1, resource: {buffer: renderDrawBuffer}},
		],
	})

	const textureView = ctx.getCurrentTexture().createView()

	const renderPassDescriptor: GPURenderPassDescriptor = {
		colorAttachments: [
			{
				view: textureView,
				clearValue: [0, 0, 0, 0], // Clear to transparent
				loadOp: "clear",
				storeOp: "store",
			},
		],
	}

	const passEncoderRender = encoder.beginRenderPass(renderPassDescriptor)
	passEncoderRender.setPipeline(renderPipeline)
	passEncoderRender.setBindGroup(0, renderBindGroup)
	passEncoderRender.setVertexBuffer(0, computeResultBuffer)
	passEncoderRender.draw(renderDrawPassCount) // draw all the vertices

	passEncoderRender.end()

	device.queue.submit([encoder.finish()])
}

// draw a single frame
onFrame()
