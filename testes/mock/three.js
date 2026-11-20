class S { constructor() { this.position = { set() {}, y: 0 }; this.scale = {}; this.userData = {}; this.target = { set() {} }; this.domElement = document.createElement('canvas'); this.material = {}; }
  add() {} set() { return this; } setHSL() { return this; } setSize() {} render() {} dispose() {} update() {} setFromCamera() {} intersectObjects() { return []; } updateProjectionMatrix() {} prepend() {} }
export { S as Scene, S as Color, S as PerspectiveCamera, S as WebGLRenderer, S as AmbientLight, S as DirectionalLight, S as BoxGeometry, S as MeshLambertMaterial,
  S as Mesh, S as LineSegments, S as EdgesGeometry, S as LineBasicMaterial, S as Raycaster, S as Vector2, S as OrbitControls };
