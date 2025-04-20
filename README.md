# webgpu-mandelbrot

rendering the mandelbrot set in webgpu

![](./screenshot.png)

### live demo

https://webgpu-mandelbrot.netlify.app

[![Netlify Status](https://api.netlify.com/api/v1/badges/7737f919-005f-4398-80cc-e2fb7c962272/deploy-status)](https://app.netlify.com/sites/webgpu-mandelbrot/deploys)

### limitations

as of writing only Chrome supports WebGPU, so that's the only browser where this'll work

interestingly, even after updating to use emulated f64, pixelation still occurs at the same place as before

### local development

clone the repo, with node.js/npm do `npm i`, then `npm start`
