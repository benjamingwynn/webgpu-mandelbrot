new EventSource("/esbuild").addEventListener("change", () => location.reload())

import moduleWGSL from "./module.wgsl"
import computeWGSL from "./compute.wgsl"

const canvas = document.createElement("canvas")
canvas.width = 1200
canvas.height = 800
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
const points = []
for (let yIndex = 0; yIndex < height; yIndex++) {
	for (let xIndex = 0; xIndex < width; xIndex++) {
		const x = -1 + xIndex / (width / 2)
		const y = 1 - yIndex / (height / 2)

		const zr = 0
		const zi = 0
		const cr = x
		const ci = y
		const iteration = 0
		const done = 0

		points.push(zr, zi, cr, ci, iteration, done)
	}
}

const computePasses = 500

// we need to create a point for each pixel on the screen
const initialPoints = new Float32Array(points)
const initialPointsSize = initialPoints.byteLength
const computeBufferSize = initialPoints.byteLength
const renderBufferSize = initialPoints.byteLength
const renderDrawPassCount = width * height
let cx = -0.746
let cy = -0.11
let scale = 2
const setConfig = (width: number, height: number, cx: number, cy: number, scale: number) => {
	computeConfig.set([width, height, cx, cy, scale])
	device.queue.writeBuffer(computeConfigBuffer, 0, computeConfig)
}
const computeConfig = new Float32Array([width, height, cx, cy, scale])
const computeConfigBufferSize = computeConfig.byteLength
const initialBuffer = device.createBuffer({
	label: "initialBuffer",
	size: initialPointsSize,
	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
})

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
				arrayStride: 6 * 4, // 6 floats of 4 bytes
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: "float32x3",
					},
					{
						shaderLocation: 1,
						offset: 3 * 4,
						format: "float32x3",
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

const computeBindGroup = device.createBindGroup({
	label: "computeBindGroup",
	layout: computeBindGroupLayout,
	entries: [
		{binding: 0, resource: {buffer: computeWorkingBuffer}},
		{binding: 1, resource: {buffer: computeConfigBuffer}},
	],
})

const renderBindGroup = device.createBindGroup({
	label: "renderBindGroup",
	layout: renderBindGroupLayout,
	entries: [
		{binding: 0, resource: {buffer: computeResultBuffer}},
		{binding: 1, resource: {buffer: renderDrawBuffer}},
	],
})

let renderTime: number
const onFrame = () => {
	const tStart = performance.now()
	device.queue.writeBuffer(initialBuffer, 0, initialPoints)

	const encoder = device.createCommandEncoder({
		label: "encoder",
	})

	// console.log("draw frame!", [...initialPoints.subarray(0, 10)])
	encoder.copyBufferToBuffer(initialBuffer, 0, computeWorkingBuffer, 0, computeWorkingBuffer.size)

	const computePass = encoder.beginComputePass({
		label: "computePass",
	})
	computePass.setPipeline(computePipeline)
	computePass.setBindGroup(0, computeBindGroup)
	// make sure we dispatch correct number of work groups!
	for (let i = 0; i < computePasses; i++) {
		computePass.dispatchWorkgroups(width, height)
	}
	computePass.end()

	// copy working buffer to result buffer
	encoder.copyBufferToBuffer(computeWorkingBuffer, 0, computeResultBuffer, 0, computeResultBuffer.size)

	// draw the result:
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

	// // <DEBUG>
	// const copyToDebugBuffer = computeWorkingBuffer
	// const debugBuffer = device.createBuffer({
	// 	label: "debugBuffer",
	// 	size: copyToDebugBuffer.size,
	// 	usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
	// })
	// encoder.copyBufferToBuffer(copyToDebugBuffer, 0, debugBuffer, 0, debugBuffer.size)
	// // </DEBUG>

	device.queue.submit([encoder.finish()])

	const tEnd = performance.now()
	renderTime = tEnd - tStart
	return renderTime

	// // <DEBUG>
	// await debugBuffer.mapAsync(GPUMapMode.READ)
	// const mapped = debugBuffer.getMappedRange()
	// const debug = new Float32Array(mapped)
	// // console.log("{DEBUG}", debug.subarray(0, 16))
	// const N_TO_PRINT = 10
	// const FIELDS_PER_PIXEL = 6
	// for (let i = 0; i < N_TO_PRINT; i++) {
	// 	const start = i * FIELDS_PER_PIXEL
	// 	const here = debug.slice(start, start + FIELDS_PER_PIXEL)
	// 	const [zr, zi, cr, ci, iteration, done] = here
	// 	console.log(i, "-", {zr, zi}, cr, ci, {iteration, done})
	// }

	// window.__debug = debug
	// // </DEBUG>
}

// draw a single frame
onFrame()
const debug = document.createElement("code")
let nFrame = 0
let pause = true
const doFrame = () => {
	if (!pause) {
		const t0 = performance.now()
		setConfig(width, height, cx, cy, (scale *= 0.99))
		const msForCopy = performance.now() - t0
		const msForFrame = onFrame()
		if (nFrame % 60 === 0) {
			const tMs = msForCopy + msForFrame
			const fps = (1000 / tMs).toFixed(1)
			debug.innerText =
				"scale=" + scale + ". " + tMs + "ms. copy=" + msForCopy + " compute+render=" + msForFrame + ". " + fps + " fps. passes=" + computePasses

			if (scale < 1e-7) {
				scale = 2
			}
		}
		nFrame++
	}
	requestAnimationFrame(doFrame)
}
const reset = document.createElement("button")
reset.type = "button"
reset.innerText = "reset scale"
reset.onclick = () => {
	scale = 2
}
document.body.append(reset)
const playPause = document.createElement("button")
playPause.type = "button"
playPause.innerText = "play/pause"
playPause.onclick = () => {
	pause = !pause
}
document.body.append(playPause)
document.body.append(debug)
requestAnimationFrame(doFrame)
