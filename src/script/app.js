import '../css/style.scss'
import vertexShader from '../shaders/vertexShader.glsl'
import fragmentShader from '../shaders/fragmentShader.glsl'
import Uniform from './Uniform'
import Rect from './Rect'
import GyroNorm from '../lib/gyronorm'

class App {
	constructor() {
		this.container = document.getElementById('gl')
		this.canvas = document.createElement('canvas')
		this.container.appendChild(this.canvas)
		this.gl = this.canvas.getContext('webgl')
		this.ratio = window.devicePixelRatio
		this.width = window.innerWidth
		this.height = window.innerHeight
		this.mouseX = 0
		this.mouseY = 0
		this.mouseTargetX = 0
		this.mouseTargetY = 0

		this.imageOriginal = this.container.getAttribute('data-imageOriginal')
		this.imageDepth = this.container.getAttribute('data-imageDepth')
		this.vth = this.container.getAttribute('data-verticalThreshold')
		this.hth = this.container.getAttribute('data-horizontalThreshold')

		this.imageURLs = [this.imageOriginal, this.imageDepth]
		this.textures = []

		this.startTime = new Date().getTime()

		this.createScene()
		this.mouseMove()
		this.loadImages()
		this.gyro()
	}

	createScene() {
		this.program = this.gl.createProgram()
		this.addShader(vertexShader, this.gl.VERTEX_SHADER)
		this.addShader(fragmentShader, this.gl.FRAGMENT_SHADER)
		this.gl.linkProgram(this.program)
		this.gl.useProgram(this.program)

		this.uResolution = new Uniform('resolution', '4f', this.program, this.gl)
		this.uMouse = new Uniform('mouse', '2f', this.program, this.gl)
		this.uTime = new Uniform('time', '1f', this.program, this.gl)
		this.uRatio = new Uniform('pixelRatio', '1f', this.program, this.gl)
		this.uThreshold = new Uniform('threshold', '2f', this.program, this.gl)

		this.billboard = new Rect(this.gl)
		this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position')
		this.gl.enableVertexAttribArray(this.positionLocation)
		this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0)
	}

	addShader(source, type) {
		const shader = this.gl.createShader(type)
		this.gl.shaderSource(shader, source)
		this.gl.compileShader(shader)
		const isCompiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)
		if (!isCompiled) {
			throw new Error(`Shader compile error: ${this.gl.getShaderInfoLog(shader)}`)
		}
		this.gl.attachShader(this.program, shader)
	}

	loadImages() {
		let imagesToLoad = this.imageURLs.length
		const images = []
		for (let i = 0; i < this.imageURLs.length; i++) {
			const img = new Image()
			img.id = i
			img.addEventListener(
				'load',
				() => {
					images.push(img)
					--imagesToLoad
					if (imagesToLoad === 0) {
						images.sort((a, b) => a.id - b.id)
						this.start(images)
					}
				},
				false
			)
			if (new URL(this.imageURLs[i]).origin !== window.location.origin) {
				img.crossOrigin = ''
			}
			img.src = this.imageURLs[i]
		}
	}

	start(images) {
		this.imageAspect = images[0].naturalHeight / images[0].naturalWidth
		for (let i = 0; i < images.length; i++) {
			const texture = this.gl.createTexture()
			this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
			this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, images[i])
			this.textures.push(texture)
		}

		const u_image0Location = this.gl.getUniformLocation(this.program, 'image0')
		const u_image1Location = this.gl.getUniformLocation(this.program, 'image1')

		this.gl.uniform1i(u_image0Location, 0)
		this.gl.uniform1i(u_image1Location, 1)

		this.gl.activeTexture(this.gl.TEXTURE0)
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[0])
		this.gl.activeTexture(this.gl.TEXTURE1)
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1])

		this.resize()
		this.render()
	}

	gyro() {
		if(!window.DeviceOrientationEvent) return
		const gn = new GyroNorm.GyroNorm()
		gn.init({ gravityNormalized: true })
			.then(() => {
				gn.start((data) => {					
					const maxTilt = 25
					let x = data.do.gamma
					let y = data.do.beta
					this.mouseTargetX = this.clamp(x, -maxTilt, maxTilt) / maxTilt
					this.mouseTargetY = this.clamp(y, -maxTilt, maxTilt) / maxTilt
				})
			})
			.catch(err => {
      console.log("App -> gyro -> err", err)
				console.log('gyro is not supported')
			})
	}

	render() {
		const now = new Date().getTime()
		const curentTime = (now - this.startTime) / 1000
		this.uTime.set(curentTime)
		this.mouseX += (this.mouseTargetX - this.mouseX) * 0.05
		this.mouseY += (this.mouseTargetY - this.mouseY) * 0.05
		this.uMouse.set(this.mouseX, this.mouseY)
		this.billboard.render(this.gl)
		requestAnimationFrame(this.render.bind(this))
	}

	resize() {
		this.resizeHandler()
		window.addEventListener('resize', this.resizeHandler.bind(this))
	}

	resizeHandler() {
		this.windowWidth = window.innerWidth
		this.windowHeight = window.innerHeight
		this.width = this.container.offsetWidth
		this.height = this.container.offsetHeight
		this.canvas.width = this.width * this.ratio
		this.canvas.height = this.height * this.ratio
		this.canvas.style.width = this.width + 'px'
		this.canvas.style.height = this.height + 'px'
		let a1, a2
		if (this.height / this.width < this.imageAspect) {
			a1 = 1
			a2 = this.height / this.width / this.imageAspect
		} else {
			a1 = (this.width / this.height) * this.imageAspect
			a2 = 1
		}
		this.uResolution.set(this.width, this.height, a1, a2)
		this.uRatio.set(1 / this.ratio)
		this.uThreshold.set(this.hth, this.vth)
		this.gl.viewport(0, 0, this.width * this.ratio, this.height * this.ratio)
	}

	mouseMove() {
		document.addEventListener('mousemove', e => {
			const halfX = this.windowWidth / 2
			const halfY = this.windowHeight / 2
			this.mouseTargetX = (halfX - e.clientX) / halfX
			this.mouseTargetY = (halfY - e.clientY) / halfY
		})
	}

	clamp(number, lower, upper) {
		if (number === number) {
			if (upper !== undefined) {
				number = number <= upper ? number : upper
			}
			if (lower !== undefined) {
				number = number >= lower ? number : lower
			}
		}
		return number
	}
}

new App()
