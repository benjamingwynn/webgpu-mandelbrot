# webgpu-mandelbrot

rendering the mandelbrot set in webgpu

![](./screenshot.png)

### live demo

https://webgpu-mandelbrot.netlify.app

### limitations

as of writing only Chrome supports WebGPU, so that's the only browser where this'll work

because webgpu is limited to float32, after a certain scale zooming stops working.

to address this, i need to emulate float64 support using float32's, i just haven't gotten around to it yet.

### local development

clone the repo, with node.js/npm do `npm i`, then `npm start`
