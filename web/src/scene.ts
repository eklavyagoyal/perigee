import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function random(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function panelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#536272'; c.fillRect(0, 0, 1024, 512);
  for (let x = 0; x < 16; x++) for (let y = 0; y < 8; y++) {
    const shade = 18 + Math.floor(random(x * 81 + y) * 20);
    c.fillStyle = `rgb(${shade * .6},${shade + 15},${shade + 34})`;
    c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    c.strokeStyle = 'rgba(134,177,206,.2)'; c.lineWidth = .8;
    for (let k = 0; k < 8; k++) {
      c.beginPath(); c.moveTo(x * 64 + 4, y * 64 + 5 + k * 7);
      c.lineTo(x * 64 + 60, y * 64 + 5 + k * 7); c.stroke();
    }
    c.fillStyle = '#a49572'; c.fillRect(x * 64 + 30, y * 64 + 2, 1.5, 60);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function foilTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#bda16a'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const g = Math.floor(90 + random(i) * 140);
    c.strokeStyle = `rgba(${g + 20},${g},${g * .65},.38)`;
    c.beginPath(); c.moveTo(random(i + 44) * 256, random(i + 87) * 256);
    c.lineTo(random(i + 31) * 256, random(i + 12) * 256); c.stroke();
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class OrbitalScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  satellite = new THREE.Group();
  wings: THREE.Group[] = [];
  debris: THREE.Mesh[] = [];
  background: THREE.Mesh;
  plasma: THREE.Points;
  heatLight = new THREE.PointLight('#ff792f', 0, 12);
  gold: THREE.MeshStandardMaterial;
  private width = 1;
  private height = 1;
  private disposed = false;
  ready: Promise<void>;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.camera.position.set(0, 0, 12);

    const backgroundMaterial = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uImage: { value: new THREE.Texture() }, uLoaded: { value: 0 }, uAspect: { value: 1.78 }, uImageAspect: { value: 1.78 }, uProgress: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,1.,1.); }`,
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D uImage; uniform float uLoaded,uAspect,uImageAspect,uProgress,uTime;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float s=0.,a=.5; for(int i=0;i<5;i++){s+=noise(p)*a;p=p*2.03+7.31;a*=.5;} return s;}
        void main(){
          vec2 uv=vUv; float p=uProgress;
          if(uAspect>uImageAspect) uv.y=(uv.y-.5)*(uImageAspect/uAspect)+.5; else uv.x=(uv.x-.5)*(uAspect/uImageAspect)+.5;
          float zoom=1.+smoothstep(.1,.78,p)*1.7;
          uv=(uv-.5)/zoom+.5; uv.y-=smoothstep(.1,.8,p)*.23; uv.x+=sin(p*2.)*.035;
          vec3 col=texture2D(uImage,uv).rgb;
          float horizon=.43+vUv.x*.12;
          vec3 fallback=mix(vec3(.015,.02,.03),vec3(.035,.11,.19),1.-smoothstep(horizon-.15,horizon,vUv.y));
          fallback+=vec3(.2,.45,.7)*exp(-abs(vUv.y-horizon)*180.)*.35;
          col=mix(fallback,col,uLoaded);
          float leftShade=mix(.57,1.,smoothstep(0.,.7,vUv.x)); col*=leftShade;
          float atmo=smoothstep(.48,.85,p);
          float clouds=fbm(vUv*vec2(4.,2.)+vec2(uTime*.012,-p*4.));
          vec3 cloudCol=mix(vec3(.08,.12,.16),vec3(.46,.51,.53),clouds);
          cloudCol+=vec3(.37,.11,.025)*smoothstep(.35,.8,clouds)*smoothstep(.4,.64,p);
          col=mix(col,cloudCol,atmo*.92);
          float burn=smoothstep(.41,.62,p)*(1.-smoothstep(.68,.87,p));
          col+=vec3(.28,.065,.009)*burn*pow(max(0.,1.-length((vUv-vec2(.58,.48))*vec2(1.,1.3))),3.);
          col*=1.-smoothstep(.77,.96,p)*.93;
          float vignette=1.-smoothstep(.35,.85,length(vUv-.5))*.55; col*=vignette;
          gl_FragColor=vec4(col,1.);
        }`,
    });
    this.background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
    this.background.frustumCulled = false; this.background.renderOrder = -1000; this.scene.add(this.background);
    this.ready = new Promise(resolve => {
      new THREE.TextureLoader().load('/images/orbital-earth.png', texture => {
        if (this.disposed) { texture.dispose(); resolve(); return; }
        // The photographic plate is intentionally sampled without a second tone-map pass.
        backgroundMaterial.uniforms.uImage.value.dispose();
        backgroundMaterial.uniforms.uImage.value = texture;
        backgroundMaterial.uniforms.uImageAspect.value = texture.image.width / texture.image.height;
        backgroundMaterial.uniforms.uLoaded.value = 1;
        resolve();
      }, undefined, () => resolve());
    });

    this.scene.add(new THREE.AmbientLight('#a3bbd1', 1.6));
    const sun = new THREE.DirectionalLight('#fff1d7', 5.2); sun.position.set(5, 5, 4); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#669bd3', 3.5); rim.position.set(-4, -1, 2); this.scene.add(rim);
    const fill = new THREE.DirectionalLight('#ffffff', .6); fill.position.set(0, 0, 5); this.scene.add(fill);
    const foil = foilTexture();
    this.gold = new THREE.MeshStandardMaterial({ map: foil, bumpMap: foil, bumpScale: .028, metalness: .65, roughness: .48, emissive: '#b63308', emissiveIntensity: 0 });
    this.buildSatellite();
    this.scene.add(this.satellite, this.heatLight);

    const particleCount = 2800;
    const seeds = new Float32Array(particleCount * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = random(i + 222);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute vec3 aSeed; uniform float uTime,uHeat,uPixelRatio; varying float vLife,vRand;
        void main(){ float life=fract(aSeed.x+uTime*(.2+aSeed.z*.35)); vLife=life; vRand=aSeed.z;
        float angle=aSeed.y*6.283; float radius=(.25+life*.8)*sqrt(aSeed.z);
        vec3 p=vec3(-life*6.5, life*1.7+cos(angle)*radius,sin(angle)*radius);
        p.y+=sin(life*17.+uTime*5.+aSeed.z*8.)*.13*life;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=uHeat*(7.+aSeed.z*25.)*(1.-life*.85)*uPixelRatio*(8./-mv.z);
        }`,
      fragmentShader: `varying float vLife,vRand; uniform float uHeat;
        void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard;
        vec3 color=mix(vec3(1.,.65,.23),vec3(.9,.12,.008),smoothstep(.1,.75,vLife));
        color=mix(color,vec3(1.,.95,.75),pow(1.-vLife,12.));
        float alpha=pow(1.-d,1.6)*(1.-vLife)*.65*uHeat; gl_FragColor=vec4(color,alpha);
        }`,
    });
    this.plasma = new THREE.Points(geometry, mat); this.plasma.frustumCulled = false; this.scene.add(this.plasma);
  }

  private buildSatellite() {
    const metal = new THREE.MeshStandardMaterial({ color: '#c8cbd0', metalness: .75, roughness: .27 });
    const graphite = new THREE.MeshStandardMaterial({ color: '#25313c', metalness: .7, roughness: .4 });
    const solar = new THREE.MeshStandardMaterial({ map: panelTexture(), metalness: .4, roughness: .3, side: THREE.DoubleSide });
    const box = (w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); parent.add(m); return m;
    };
    box(.95, 1.13, .92, this.gold, this.satellite);
    box(1.02, .065, .99, metal, this.satellite, 0, .57);
    box(1.02, .065, .99, metal, this.satellite, 0, -.57);
    for (const x of [-.49, .49]) for (const z of [-.46, .46]) box(.045, 1.15, .045, metal, this.satellite, x, 0, z);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.x = side * .62; this.satellite.add(wing); this.wings.push(wing);
      box(.68, .055, .06, metal, wing, side * .24);
      box(2.18, 1.39, .04, metal, wing, side * 1.5);
      box(2.12, 1.33, .055, solar, wing, side * 1.5, 0, .005);
      box(.025, 1.4, .08, metal, wing, side * 1.5, 0, .04);
      box(2.18, .02, .08, metal, wing, side * 1.5, 0, .04);
      for (const y of [-.71, .71]) box(2.22, .025, .07, graphite, wing, side * 1.5, y);
    }
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) { const r = i / 24 * .43; points.push(new THREE.Vector2(r, r * r * 1.15)); }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(points, 48), new THREE.MeshStandardMaterial({ color: '#dbdce0', metalness: .65, roughness: .3, side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI / 2; dish.position.set(.04, .1, .57); this.satellite.add(dish);
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(.024, .024, .43, 8), metal); feed.rotation.x = Math.PI / 2; feed.position.set(.04, .1, .8); this.satellite.add(feed);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .26, 24), graphite); lens.rotation.x = Math.PI / 2; lens.position.set(.2, -.31, .55); this.satellite.add(lens);
    const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(.13, 24), new THREE.MeshStandardMaterial({ color: '#15394d', metalness: .85, roughness: .12 })); lensGlass.position.set(.2, -.31, .69); this.satellite.add(lensGlass);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.01, .012, 1.1, 6), metal); antenna.position.set(-.25, 1.05, 0); antenna.rotation.z = -.2; this.satellite.add(antenna);
    for (let i = 0; i < 42; i++) {
      const frag = new THREE.Mesh(new THREE.BoxGeometry(.06 + random(i) * .17, .035, .04 + random(i + 9) * .15), i % 3 ? solar.clone() : this.gold.clone());
      this.debris.push(frag); this.scene.add(frag); frag.visible = false;
    }
  }

  resize(width: number, height: number, pixelRatio?: number) {
    if (pixelRatio) this.renderer.setPixelRatio(pixelRatio);
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    (this.background.material as THREE.ShaderMaterial).uniforms.uAspect.value = width / height;
  }

  render(progress: number, time: number, reduced = false) {
    if (this.disposed) return;
    const p = clamp(progress, 0, 1);
    const mobile = this.width / this.height < .9;
    const motionTime = reduced ? 0 : time;
    const fall = smooth(.14, .76, p);
    const end = smooth(.65, .85, p);
    const heat = smooth(.29, .6, p) * (1 - smooth(.71, .84, p));
    const x = (mobile ? .03 : 2.3) + fall * (mobile ? 0 : .2);
    const y = (mobile ? -.35 : .1) + Math.sin(motionTime * .28) * .045 - fall * .9;
    this.satellite.position.set(x, y, fall * 1.2);
    this.satellite.rotation.set(-.36 + fall * .7, -.4 + Math.sin(motionTime * .15) * .06 + fall * .8, .3 - fall * 1.1 + smooth(.52, .78, p) * 2.3);
    const size = (mobile ? .48 : .82) * (1 + fall * .06) * (1 - end);
    this.satellite.scale.setScalar(Math.max(.001, size));
    this.satellite.visible = p < .87;
    this.wings.forEach((wing, i) => {
      wing.rotation.x = Math.sin(motionTime * .2 + i) * .035 + smooth(.53, .76, p) * (i ? 1.3 : -1.8);
      wing.position.y = smooth(.63, .78, p) * (i ? .8 : -.8);
    });
    this.gold.emissiveIntensity = heat * 1.6;
    this.plasma.position.copy(this.satellite.position); this.plasma.position.z -= .3;
    this.plasma.scale.setScalar(mobile ? .66 : 1);
    const plasmaMaterial = this.plasma.material as THREE.ShaderMaterial;
    plasmaMaterial.uniforms.uHeat.value = heat;
    plasmaMaterial.uniforms.uTime.value = motionTime;
    this.plasma.visible = heat > .005;
    this.heatLight.position.copy(this.satellite.position).add(new THREE.Vector3(0, 0, 2)); this.heatLight.intensity = heat * 17;
    const breakage = smooth(.55, .81, p);
    this.debris.forEach((fragment, i) => {
      fragment.visible = breakage > .01 && p < .89;
      fragment.position.set(x - breakage * (1 + random(i + 21) * 7), y + (random(i + 98) - .5) * breakage * 4, random(i + 76) * .7);
      fragment.rotation.set(motionTime * (i % 4 + 1) * .3, i + motionTime * .3, i * 2);
      fragment.scale.setScalar((mobile ? .7 : 1) * (1 - smooth(.75, .89, p)));
      const material = fragment.material as THREE.MeshStandardMaterial;
      material.emissive.set('#ff6012'); material.emissiveIntensity = heat * (1 + random(i) * 2);
    });
    const uniforms = (this.background.material as THREE.ShaderMaterial).uniforms;
    uniforms.uProgress.value = p; uniforms.uTime.value = motionTime;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of [mesh.material].flat()) materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      if (material instanceof THREE.ShaderMaterial) for (const uniform of Object.values(material.uniforms)) if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
      material.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    this.renderer.dispose();
  }
}
