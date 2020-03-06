export default class Rect{
  constructor(gl){
    this.gl = gl
    this.createPlane()    
  }
  createPlane(){
    const buffer = this.gl.createBuffer()
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, verts, this.gl.STATIC_DRAW)
  }
  render(){
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }
}