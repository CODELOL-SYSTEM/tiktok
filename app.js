import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/* ================= Utilitaires & réglages ================= */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
const DEF={vol:.8,sfx:.8,win:3,likes:2,q:'med',sens:1};
const S=(()=>{try{return {...DEF,...JSON.parse(localStorage.getItem('tl_set')||'{}')}}catch{return {...DEF}}})();
const save=()=>{try{localStorage.setItem('tl_set',JSON.stringify(S))}catch{}};
const QUAL={low:{pr:1,cap:3000,sh:false,pt:300},med:{pr:1.5,cap:8000,sh:false,pt:700},high:{pr:2,cap:16000,sh:true,pt:1400}};
const COLN=[0,0x2f7bff,0x2ed36a,0xff3040],COLH=['','#2f7bff','#2ed36a','#ff3040'];
const M={x:0,y:0,down:false},A={x:0,y:0},rc=new THREE.Raycaster();

/* m=billes par unité (jeu 1), k=bombes par unité (jeu 2), w=variation de WIN (les 2 jeux) */
const GIFTS=[
 {n:'Rose',re:/\brose\b/,m:50,k:2},{n:'GG',re:/\bgg\b/,m:-50,k:2},
 {n:'Capybara',re:/capybara/,m:-1500,k:60},{n:'Doughnut',re:/dou?ghnut|donut|beignet/,m:1500,k:60},
 {n:'Ourson',re:/ourson|teddy|bear/,m:-5000,k:200},{n:'Cœur dans les mains',re:/hand|mains/,m:5000,k:200},
 {n:'Cœur',re:/heart|coeur/,m:10000,k:400},{n:'Lunettes de soleil',re:/sunglass|lunette/,m:-10000,k:400},
 {n:'Money Gun',re:/money/,w:-1},{n:'Trophée',re:/troph/,w:1},{n:'Galaxy',re:/galax/,w:5},{n:'Girafe',re:/girafe|giraffe/,w:-5}];
const findGift=n=>{n=String(n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return GIFTS.find(g=>g.re.test(n))};

/* ================= Sons (WebAudio synthétisé) ================= */
const Snd={c:null,
 init(){if(this.c)return;try{const c=this.c=new(window.AudioContext||window.webkitAudioContext)();this.m=c.createGain();this.e=c.createGain();this.e.connect(this.m);this.m.connect(c.destination);
  const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=b;
  const s=c.createBufferSource();s.buffer=b;s.loop=true;this.f=c.createBiquadFilter();this.f.type='bandpass';this.f.frequency.value=300;this.vg=c.createGain();this.vg.gain.value=0;
  s.connect(this.f);this.f.connect(this.vg);this.vg.connect(this.e);s.start();this.vol()}catch(e){console.warn('Audio indisponible',e)}},
 vol(){if(!this.c)return;this.m.gain.value=S.vol;this.e.gain.value=S.sfx},
 vac(on){if(!this.c)return;const t=this.c.currentTime;this.vg.gain.setTargetAtTime(on?.9:0,t,.08);this.f.frequency.setTargetAtTime(on?750:300,t,.3)},
 tone(a,b,d,ty='sine',g=.4){if(!this.c)return;const c=this.c,o=c.createOscillator(),n=c.createGain(),t=c.currentTime;o.type=ty;o.frequency.setValueAtTime(a,t);o.frequency.exponentialRampToValueAtTime(b,t+d);n.gain.setValueAtTime(g,t);n.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(n);n.connect(this.e);o.start(t);o.stop(t+d)},
 noise(d,g,fc){if(!this.c)return;const c=this.c,s=c.createBufferSource(),f=c.createBiquadFilter(),n=c.createGain(),t=c.currentTime;s.buffer=this.nb;f.type='lowpass';f.frequency.value=fc;n.gain.setValueAtTime(g,t);n.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f);f.connect(n);n.connect(this.e);s.start(t);s.stop(t+d)},
 pop(){this.tone(520,170,.13,'sine',.6)},boom(){this.noise(.7,.9,350);this.tone(130,35,.5,'sine',.7)},
 chime(){this.tone(660,990,.25,'triangle',.35)},tick(){this.tone(880,880,.08,'square',.12)}};

/* ================= Particules (pool unique par jeu) ================= */
class Particles{
 constructor(scene,n){this.n=n;this.i=0;this.p=new Float32Array(n*3).fill(-999);this.v=new Float32Array(n*3);this.l=new Float32Array(n);this.col=new Float32Array(n*3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.p,3));g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
  this.o=new THREE.Points(g,new THREE.PointsMaterial({size:.28,vertexColors:true,transparent:true,depthWrite:false}));this.o.frustumCulled=false;scene.add(this.o)}
 emit(x,y,z,c,n,sp,up=0){const C=new THREE.Color(c);for(let k=0;k<n;k++){const i=this.i=(this.i+1)%this.n,j=i*3,a=rnd(0,6.283),e=rnd(-.2,1),s=rnd(.3,1)*sp;
  this.p[j]=x;this.p[j+1]=y;this.p[j+2]=z;this.v[j]=Math.cos(a)*s;this.v[j+1]=e*s+up;this.v[j+2]=Math.sin(a)*s;this.l[i]=rnd(.5,1.2);this.col[j]=C.r;this.col[j+1]=C.g;this.col[j+2]=C.b}}
 update(dt){for(let i=0;i<this.n;i++){if(this.l[i]<=0)continue;const j=i*3;this.l[i]-=dt;if(this.l[i]<=0){this.p[j+1]=-999;continue}
  this.v[j+1]-=9*dt;this.p[j]+=this.v[j]*dt;this.p[j+1]+=this.v[j+1]*dt;this.p[j+2]+=this.v[j+2]*dt}
  const a=this.o.geometry.attributes;a.position.needsUpdate=a.color.needsUpdate=true}}

const mk=(geo,col,x,y,z,o={})=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:o.r??.9,metalness:o.m??0,emissive:o.e??0,side:o.side}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m};
const box=(w,h,d,x,y,z,c,ry=0)=>{const m=mk(new THREE.BoxGeometry(w,h,d),c,x,y,z);m.rotation.y=ry;return m};
function baseScene(q,sky){const sc=new THREE.Scene();sc.background=new THREE.Color(sky);sc.fog=new THREE.Fog(sky,70,190);sc.environment=App.env;
 sc.add(new THREE.HemisphereLight(0xffffff,0x6a7a5a,.7));const sun=new THREE.DirectionalLight(0xfff1d6,2.2);sun.position.set(30,50,20);
 if(q.sh){sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,far:150})}sc.add(sun);return sc}
function disposeScene(sc){sc.traverse(o=>{o.geometry?.dispose();const m=o.material;(Array.isArray(m)?m:[m]).forEach(x=>{if(x){x.map?.dispose();x.dispose()}})})}

/* ================= JEU 1 : la fosse aux billes ================= */
const H=(x,z)=>{const d=Math.hypot(x,z),t=clamp((d-7)/17,0,1)*4,f=Math.floor(t),u=ease((t-f-.55)/.45),s=(f+u)/4;
 return -11+11*s+(1-s)*.35*Math.sin(x*.9+z*.4)*Math.cos(z*.8)+clamp((d-24)/6,0,1)*(.9*Math.sin(x*.12)*Math.cos(z*.1)+.4*Math.sin(x*.31+z*.27))};

class Marbles{
 constructor(scene,cap){this.cap=cap;this.n=0;this.P=new Float32Array(cap*3);this.V=new Float32Array(cap*3);this.r=.16;
  const mat=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:.15,roughness:.05,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.6});
  this.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),mat,cap);this.mesh.frustumCulled=false;this.mesh.castShadow=false;
  const a=this.mesh.instanceMatrix.array,pal=[0xff4d6d,0x4dc9ff,0xffd93d,0x6bff8a,0xb36bff,0xff944d,0xffffff,0x2f5bff].map(c=>new THREE.Color(c)),ca=new Float32Array(cap*3);
  for(let i=0;i<cap;i++){a[i*16]=a[i*16+5]=a[i*16+10]=this.r;a[i*16+15]=1;const c=pal[i%8];ca.set([c.r,c.g,c.b],i*3)}
  this.mesh.instanceColor=new THREE.InstancedBufferAttribute(ca,3);scene.add(this.mesh);
  this.G=Math.ceil(52/.34);this.head=new Int32Array(this.G*this.G);this.next=new Int32Array(cap)}
 add(x,y,z){if(this.n>=this.cap)return false;const j=this.n*3;this.P[j]=x;this.P[j+1]=y;this.P[j+2]=z;this.V[j]=rnd(-.5,.5);this.V[j+1]=-2;this.V[j+2]=rnd(-.5,.5);this.n++;return true}
 remove(i){const n=--this.n,j=i*3,k=n*3;this.P[j]=this.P[k];this.P[j+1]=this.P[k+1];this.P[j+2]=this.P[k+2];this.V[j]=this.V[k];this.V[j+1]=this.V[k+1];this.V[j+2]=this.V[k+2]}
 suck(cx,cy,cz,R,dt){const{P,V}=this;let out=0;for(let i=this.n-1;i>=0;i--){const j=i*3,dx=cx-P[j],dy=cy-P[j+1],dz=cz-P[j+2],d2=dx*dx+dy*dy+dz*dz;
  if(d2<R*R){const d=Math.sqrt(d2)+1e-4,f=70*(1.15-d/R);V[j]=V[j]*.9+dx/d*f*dt;V[j+1]=V[j+1]*.9+dy/d*f*dt+9.8*dt;V[j+2]=V[j+2]*.9+dz/d*f*dt;if(d<.6){this.remove(i);out++}}}return out}
 step(dt){const{P,V,r,G,head,next}=this,n=this.n,cs=.34,off=26;head.fill(-1);
  for(let i=0;i<n;i++){const j=i*3;V[j+1]-=9.8*dt;P[j]+=V[j]*dt;P[j+1]+=V[j+1]*dt;P[j+2]+=V[j+2]*dt;
   const x=P[j],z=P[j+2],g=H(x,z)+r;if(P[j+1]<g){P[j+1]=g;const gx=(H(x+.1,z)-H(x-.1,z))*5,gz=(H(x,z+.1)-H(x,z-.1))*5,l=Math.hypot(gx,1,gz),nx=-gx/l,ny=1/l,nz=-gz/l,vn=V[j]*nx+V[j+1]*ny+V[j+2]*nz;
    if(vn<0){V[j]-=nx*vn*1.25;V[j+1]-=ny*vn*1.25;V[j+2]-=nz*vn*1.25}const fr=1-1.6*dt;V[j]*=fr;V[j+2]*=fr}
   const cx=Math.floor((P[j]+off)/cs),cz=Math.floor((P[j+2]+off)/cs);if(cx>=0&&cz>=0&&cx<G&&cz<G){const c=cz*G+cx;next[i]=head[c];head[c]=i}else next[i]=-1}
  const D=2*r;for(let i=0;i<n;i++){const j=i*3,cx=Math.floor((P[j]+off)/cs),cz=Math.floor((P[j+2]+off)/cs);if(cx<1||cz<1||cx>=G-1||cz>=G-1)continue;
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){for(let o=head[(cz+b)*G+cx+a];o>=0;o=next[o]){if(o<=i)continue;const k=o*3,dx=P[k]-P[j],dy=P[k+1]-P[j+1],dz=P[k+2]-P[j+2],d2=dx*dx+dy*dy+dz*dz;
    if(d2<D*D&&d2>1e-8){const d=Math.sqrt(d2),ov=(D-d)*.5,nx=dx/d,ny=dy/d,nz=dz/d;P[j]-=nx*ov;P[j+1]-=ny*ov;P[j+2]-=nz*ov;P[k]+=nx*ov;P[k+1]+=ny*ov;P[k+2]+=nz*ov;
     const vr=(V[j]-V[k])*nx+(V[j+1]-V[k+1])*ny+(V[j+2]-V[k+2])*nz;if(vr>0){const h=vr*.55;V[j]-=nx*h;V[j+1]-=ny*h;V[j+2]-=nz*h;V[k]+=nx*h;V[k+1]+=ny*h;V[k+2]+=nz*h}}}}}
  const a=this.mesh.instanceMatrix.array;for(let i=0;i<n;i++){a[i*16+12]=P[i*3];a[i*16+13]=P[i*3+1];a[i*16+14]=P[i*3+2]}
  this.mesh.count=n;this.mesh.visible=n>0;this.mesh.instanceMatrix.needsUpdate=true;this.mesh.instanceColor.needsUpdate=true}}

function nameTex(name){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle='#f3e2c0';x.fillRect(0,0,512,256);x.strokeStyle='#b0793c';x.lineWidth=14;x.strokeRect(7,7,498,242);
 x.fillStyle='#6b4423';x.font='bold 34px Sora,Arial';x.textAlign='center';x.fillText('LIVRAISON POUR',256,62);let s=110;x.fillStyle='#1b1208';do{x.font=`bold ${s}px Sora,Arial`;s-=4}while(x.measureText(name).width>470&&s>20);x.fillText(name,256,175);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

class Quarry{
 constructor(){const q=this.q=QUAL[S.q];this.scene=baseScene(q,0xa9c7d8);this.cam=new THREE.PerspectiveCamera(50,1,.1,400);this.cam.position.set(0,17,20);this.cam.lookAt(0,-6,0);
  this.parts=new Particles(this.scene,q.pt);this.drones=[];this.nz=new THREE.Vector3(0,-11,0);this.peak=0;this.sucking=false;this.dum=new THREE.Object3D();
  const g=new THREE.PlaneGeometry(130,130,160,160);g.rotateX(-Math.PI/2);const p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=H(x,z);p.setY(i,h);const d=Math.hypot(x,z);
   if(d>25)c.setRGB(.28+rnd(0,.06),.4+rnd(0,.08),.2);else if(d<8)c.setRGB(.76+rnd(0,.04),.68,.5);else{const b=Math.floor((d-7)/4.25)%2;c.setRGB(b?.82:.66,b?.8:.64,b?.74:.58)}col.set([c.r,c.g,c.b],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();const t=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));t.receiveShadow=true;this.scene.add(t);
  for(let i=0;i<10;i++){const a=i/10*6.283+.3,r=33+rnd(0,7),x=Math.cos(a)*r,z=Math.sin(a)*r,y=H(x,z);
   if(i%3==0){this.scene.add(mk(new THREE.CylinderGeometry(2,2,9,16),0xd8d8d0,x,y+4.5,z),mk(new THREE.ConeGeometry(2.1,2,16),0x8a8f94,x,y+10,z))}
   else{this.scene.add(box(6,3.2,4.5,x,y+1.6,z,0xb9b2a0,-a),box(6.4,.35,4.9,x,y+3.4,z,0x4a4f55,-a))}}
  const cx=-30,cz=-8,cy=H(cx,cz);this.scene.add(box(1.6,18,1.6,cx,cy+9,cz,0xe0a526),box(14,1.2,1.2,cx+5,cy+17.5,cz,0xe0a526),box(2,2,2,cx,cy+1,cz,0x333a40));
  this.scene.add(box(5,1.6,2.4,26,H(26,-18)+1,-18,0xe0a526),box(2,2,2.4,28.8,H(26,-18)+1.4,-18,0x2c3a4a),box(4,2,2.4,23,H(23,-18)+1.4,-18,0x5a5a55));
  for(let i=0;i<45;i++){const a=rnd(0,6.283),r=rnd(30,62),x=Math.cos(a)*r,z=Math.sin(a)*r,y=H(x,z),s=rnd(.8,1.5);this.scene.add(mk(new THREE.CylinderGeometry(.2*s,.25*s,1.5*s,6),0x5a3d22,x,y+.7*s,z),mk(new THREE.ConeGeometry(1.4*s,4*s,7),0x2f5f2c,x,y+3*s,z))}
  this.m=new Marbles(this.scene,q.cap);
  const hm=new THREE.MeshStandardMaterial({color:0x2b3036,roughness:.5,metalness:.4});this.hose=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),hm,18);this.hose.frustumCulled=false;this.scene.add(this.hose);
  this.head=mk(new THREE.CylinderGeometry(.35,.9,1.1,20,1,true),0xff8a1f,0,0,0,{side:THREE.DoubleSide,m:.3});this.scene.add(this.head);
  this.ring=new THREE.Mesh(new THREE.TorusGeometry(2.6,.06,6,40),new THREE.MeshBasicMaterial({color:0x9be7ff,transparent:true,opacity:.7}));this.ring.rotation.x=Math.PI/2;this.scene.add(this.ring);this.reset()}
 total(){return this.m.n+this.drones.reduce((a,d)=>a+d.rem,0)}
 reset(){this.m.n=0;this.drones.forEach(d=>this.scene.remove(d.g));this.drones=[];for(let i=0;i<900;i++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*5.5,x=Math.cos(a)*r,z=Math.sin(a)*r;this.m.add(x,H(x,z)+rnd(.5,3),z)}this.peak=this.total()}
 complete(){return this.total()===0}
 progress(){return this.peak?1-this.total()/this.peak:0}
 label(){return `${this.total().toLocaleString('fr-FR')} billes restantes`}
 gift(g,qty,name){const d=g.m*qty;if(!d)return;
  if(d>0){this.makeDrone(name,d);this.peak=Math.max(this.peak,this.total())}
  else{let k=-d;const a=Math.min(k,this.m.n);this.m.n-=a;k-=a;for(const x of this.drones){const b=Math.min(k,x.rem);x.rem-=b;k-=b}}}
 like(){}
 makeDrone(name,n){const g=new THREE.Group(),dk=new THREE.MeshStandardMaterial({color:0x222831,metalness:.6,roughness:.4}),rot=[];
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4,.6,1.5),dk));
  for(const[x,z]of[[1.5,1],[-1.5,1],[1.5,-1],[-1.5,-1]]){const a=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x,z)*2,.12,.12),dk);a.position.set(x/2,0,z/2);a.rotation.y=-Math.atan2(z,x);g.add(a);
   const r=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.05,20),new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.45}));r.position.set(x,.25,z);g.add(r);rot.push(r)}
  const c=new THREE.Group();c.position.y=-1.4;g.add(c);c.add(box(3.2,2,2.2,0,0,0,0xc99a5b));c.add(box(.5,2.02,2.22,0,0,0,0xe7d3a8));
  const lt=nameTex(name),lm=new THREE.MeshBasicMaterial({map:lt}),f=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),lm),b=f.clone();f.position.set(0,0,1.12);b.position.set(0,0,-1.12);b.rotation.y=Math.PI;c.add(f,b);
  const fl=[1,-1].map(s=>{const p=new THREE.Group();p.position.set(0,1,s*1.1);p.add(box(3.2,.08,1.1,0,0,-s*.55,0xb98a4c));c.add(p);return p});
  const tx=clamp(this.nz.x,-9,9),tz=clamp(this.nz.z,-9,9);g.position.set(tx-45,24,tz-12);this.scene.add(g);this.drones.push({g,c,rot,fl,s:0,t:0,rem:n,n,tx,tz,sx:tx-45,sz:tz-12})}
 updDrone(d,dt){d.t+=dt;d.rot.forEach(r=>r.rotation.y+=dt*45);const g=d.g;
  if(d.s===0){const u=ease(d.t/2.4);g.position.set(d.sx+(d.tx-d.sx)*u,24-12*u,d.sz+(d.tz-d.sz)*u);if(d.t>2.4){d.s=1;d.t=0}}
  else if(d.s===1){d.c.position.y=-1.4-4.2*ease(d.t/1.1);if(d.t>1.1){d.s=2;d.t=0}}
  else if(d.s===2){const a=ease(d.t/.8)*2.1;d.fl[0].rotation.x=-a;d.fl[1].rotation.x=a;if(d.t>.8){d.s=3;d.t=0}}
  else if(d.s===3){const k=Math.min(d.rem,Math.ceil(dt*Math.max(90,d.n/3.5)));const w=new THREE.Vector3(0,0,0);d.c.getWorldPosition(w);
   for(let i=0;i<k;i++)if(this.m.add(w.x+rnd(-1,1),w.y+.8,w.z+rnd(-.7,.7)))d.rem--;else break;if(d.rem<=0){d.s=4;d.t=0}}
  else if(d.s===4){const u=ease(d.t/.7);d.c.scale.setScalar(1-u);d.fl.forEach((f,i)=>f.rotation.x=(i?1:-1)*2.1*(1-u));if(d.t>.7){d.s=5;d.t=0;d.c.visible=false}}
  else{g.position.x+=dt*14*d.t;g.position.y+=dt*6*d.t;if(d.t>2.2){this.scene.remove(g);d.dead=true}}}
 update(dt){rc.setFromCamera({x:A.x,y:A.y},this.cam);const o=rc.ray.origin,d=rc.ray.direction;
  for(let t=4;t<130;t+=.5){if(o.y+d.y*t<H(o.x+d.x*t,o.z+d.z*t)){let lo=t-.5,hi=t;for(let i=0;i<7;i++){const m=(lo+hi)/2;(o.y+d.y*m<H(o.x+d.x*m,o.z+d.z*m))?hi=m:lo=m}this.nz.copy(o).addScaledVector(d,hi);break}}
  const P=this.nz,y=P.y+.9;this.head.position.set(P.x,y,P.z);this.ring.position.set(P.x,P.y+.15,P.z);
  this.sucking=M.down&&!App.paused;Snd.vac(this.sucking);this.ring.scale.setScalar(this.sucking?1+.06*Math.sin(performance.now()/60):1);this.ring.material.opacity=this.sucking?.95:.35;
  if(this.sucking){const k=this.m.suck(P.x,y+.2,P.z,2.6,dt);if(k)this.parts.emit(P.x,y+.2,P.z,0xdff6ff,Math.min(k,6),3);this.parts.emit(P.x+rnd(-2,2),y+rnd(0,1.5),P.z+rnd(-2,2),0x9be7ff,1,1)}
  for(let i=0;i<18;i++){const u=i/17,a=1-u,x=a*a*0+2*a*u*P.x*.4+u*u*P.x,yy=a*a*15+2*a*u*(y+9)+u*u*(y+1.6),z=a*a*14+2*a*u*(P.z*.4+8)+u*u*P.z;this.dum.position.set(x,yy,z);this.dum.scale.setScalar(.22);this.dum.updateMatrix();this.hose.setMatrixAt(i,this.dum.matrix)}this.hose.instanceMatrix.needsUpdate=true;
  this.drones.forEach(x=>this.updDrone(x,dt));this.drones=this.drones.filter(x=>!x.dead);this.m.step(Math.min(dt,1/30));this.parts.update(dt)}
 dispose(){Snd.vac(false);disposeScene(this.scene)}}

/* ================= JEU 2 : la bataille de peinture ================= */
const PX=10;
function drawBase(c,W,Hh,k){c.fillStyle={g:'#7d8a78',w:'#c9b79a',h:'#c76f52',r:'#5c3a33',c:'#a47c4b'}[k];c.fillRect(0,0,W,Hh);c.strokeStyle='rgba(0,0,0,.2)';c.lineWidth=2;
 if(k==='h'||k==='w'){for(let y=0;y<Hh;y+=14){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();for(let x=(y/14%2)*10;x<W;x+=20){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+14);c.stroke()}}}
 if(k==='h'){c.fillStyle='#bfe3ff';c.fillRect(W*.15,Hh*.3,W*.22,Hh*.35);c.fillRect(W*.62,Hh*.3,W*.22,Hh*.35);c.fillStyle='#5b3a22';c.fillRect(W*.42,Hh*.55,W*.14,Hh*.45)}
 if(k==='g'){for(let i=0;i<W*Hh/30;i++){c.fillStyle=`rgba(${Math.random()<.5?'0,0,0':'255,255,255'},.07)`;c.fillRect(Math.random()*W,Math.random()*Hh,3,3)}c.strokeStyle='#e8e8e0';c.strokeRect(10,10,W-20,Hh-20);c.beginPath();c.moveTo(W/2,10);c.lineTo(W/2,Hh-10);c.stroke()}
 if(k==='c'||k==='r'){for(let y=0;y<Hh;y+=PX*1.5){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke()}}}

class Panel{
 constructor(w,h,pos,ry,rx,k){this.k=k;this.nx=Math.max(2,Math.round(w/.6));this.ny=Math.max(2,Math.round(h/.6));this.cv=document.createElement('canvas');this.cv.width=this.nx*PX;this.cv.height=this.ny*PX;this.cx=this.cv.getContext('2d');
  this.tex=new THREE.CanvasTexture(this.cv);this.tex.colorSpace=THREE.SRGBColorSpace;this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:this.tex,roughness:.8,side:THREE.DoubleSide}));
  this.mesh.position.copy(pos);this.mesh.rotation.set(rx,ry,0);this.mesh.receiveShadow=true;this.mesh.castShadow=true;this.mesh.updateMatrixWorld(true);this.rad=Math.hypot(w,h)/2+.1;this.c=new THREE.Vector3();this.mesh.getWorldPosition(this.c);
  const N=this.nx*this.ny;this.st=new Uint8Array(N);this.act=new Uint8Array(N).fill(1);this.ct=new Float32Array(N*3);const v=new THREE.Vector3();
  for(let y=0;y<this.ny;y++)for(let x=0;x<this.nx;x++){v.set(((x+.5)/this.nx-.5)*w,((y+.5)/this.ny-.5)*h,0);this.mesh.localToWorld(v);this.ct.set([v.x,v.y,v.z],(y*this.nx+x)*3)}this.clear()}
 clear(){this.st.fill(0);drawBase(this.cx,this.cv.width,this.cv.height,this.k);this.tex.needsUpdate=true}
 cell(i,col){this.st[i]=col;const x=i%this.nx,y=(i/this.nx)|0,c=this.cx;c.fillStyle=COLH[col];c.beginPath();c.arc((x+.5)*PX+rnd(-1.5,1.5),(this.ny-1-y+.5)*PX+rnd(-1.5,1.5),PX*.72,0,6.3);c.fill();this.dirty=true}}

class Paint{
 constructor(col){const q=this.q=QUAL[S.q];this.col=col;this.scene=baseScene(q,0x9fd0ff);this.cam=new THREE.PerspectiveCamera(58,1,.1,300);this.cam.position.set(-14,6.5,0);this.cam.lookAt(2,0,0);
  this.parts=new Particles(this.scene,q.pt);this.panels=[];this.bombs=[];this.shots=[];this.fx=[];this.boxes=[];this.qa=0;this.qr=0;this.acc=0;this.last=0;this.tgt=new THREE.Vector3(8,0,0);
  const out=mk(new THREE.PlaneGeometry(200,200),0x5d8a45,0,-.05,0);out.rotation.x=-Math.PI/2;this.scene.add(out);
  this.pan(24,11,[0,0,0],0,-Math.PI/2,'g');
  this.pan(24,2.5,[0,1.25,-5.5],0,0,'w');this.pan(24,2.5,[0,1.25,5.5],Math.PI,0,'w');this.pan(11,2.5,[12,1.25,0],-Math.PI/2,0,'w');
  this.scene.add(box(24.6,2.6,.4,0,1.3,-5.75,0x8a8f90),box(24.6,2.6,.4,0,1.3,5.75,0x8a8f90),box(.4,2.6,11.6,12.25,1.3,0,0x8a8f90));
  this.addBox(4,3,3,1,-3.7,'h');this.addBox(3.4,2.6,3,6.5,3.7,'h');this.addBox(3,2.2,2.6,-4,3.8,'h');this.addBox(.4,1.4,3.6,-1.2,.2,'w');
  [[-7,-3],[-6.2,-2.9],[3.8,.8],[9,-.5],[-8.5,1.5]].forEach(([x,z],i)=>this.addBox(1.1,1.1,1.1,x,z,'c'));
  [[-9.5,-4.6],[9.5,-4.6],[-10,4.6],[10.5,4.6]].forEach(([x,z])=>this.scene.add(mk(new THREE.CylinderGeometry(.2,.25,1.8,6),0x5a3d22,x,.9,z),mk(new THREE.IcosahedronGeometry(1.3,1),0x2f7a35,x,2.6,z)));
  for(let i=0;i<26;i++){const x=rnd(-30,30),z=(Math.random()<.5?-1:1)*rnd(10,26);this.scene.add(mk(new THREE.CylinderGeometry(.3,.35,2.5,6),0x5a3d22,x,1.2,z),mk(new THREE.IcosahedronGeometry(2,1),0x2f6f33,x,3.8,z))}
  this.panels.forEach(p=>{if(p.k!=='g')return;for(let i=0;i<p.st.length;i++){const x=p.ct[i*3],z=p.ct[i*3+2];if(this.boxes.some(b=>x>b[0]-.1&&x<b[1]+.1&&z>b[2]-.1&&z<b[3]+.1))p.act[i]=0}});
  this.meshes=this.panels.map(p=>p.mesh);
  this.cannon=new THREE.Group();this.cannon.position.set(-11,.8,0);this.cannon.add(box(1.5,.9,1.5,0,-.2,0,0x3a4048));this.barrel=new THREE.Group();this.cannon.add(this.barrel);
  const bm=mk(new THREE.CylinderGeometry(.24,.3,1.8,16),0x9aa3ad,0,0,.9,{m:.7,r:.3});bm.rotation.x=Math.PI/2;this.barrel.add(bm);this.ringM=mk(new THREE.TorusGeometry(.3,.07,8,16),COLN[col],0,0,1.7,{e:COLN[col]});this.barrel.add(this.ringM);this.scene.add(this.cannon);
  this.bg=new THREE.SphereGeometry(.38,14,10);this.shotG=new THREE.SphereGeometry(.14,8,6);this.sg=new THREE.SphereGeometry(1,16,12);this.reset()}
 pan(w,h,p,ry,rx,k){const o=new Panel(w,h,new THREE.Vector3(...p),ry,rx,k);this.panels.push(o);this.scene.add(o.mesh)}
 addBox(w,h,d,x,z,k){const P=Math.PI;this.scene.add(box(w-.04,h-.04,d-.04,x,h/2,z,0x5a5550));
  this.pan(w,h,[x,h/2,z+d/2],0,0,k);this.pan(w,h,[x,h/2,z-d/2],P,0,k);this.pan(d,h,[x-w/2,h/2,z],-P/2,0,k);this.pan(w,d,[x,h+.01,z],0,-P/2,k==='h'?'r':k);this.boxes.push([x-w/2,x+w/2,z-d/2,z+d/2])}
 reset(){this.panels.forEach(p=>p.clear());[...this.bombs,...this.shots,...this.fx].forEach(o=>this.scene.remove(o.m));this.bombs=[];this.shots=[];this.fx=[];this.qa=this.qr=0}
 stats(){let t=0,p=0;for(const a of this.panels)for(let i=0;i<a.st.length;i++)if(a.act[i]){t++;if(a.st[i]===this.col)p++}return{t,p}}
 progress(){const s=this.stats();return s.t?s.p/s.t:0}
 complete(){const s=this.stats();return s.t>0&&s.p===s.t}
 label(){return `${(this.progress()*100).toFixed(1)} % peint`}
 splat(pt,R,col,jit){for(const a of this.panels){if(a.c.distanceTo(pt)>R+a.rad)continue;for(let i=0;i<a.st.length;i++){if(!a.act[i]||a.st[i]===col)continue;const dx=a.ct[i*3]-pt.x,dy=a.ct[i*3+1]-pt.y,dz=a.ct[i*3+2]-pt.z,r=R*(1-jit*Math.random());if(dx*dx+dy*dy+dz*dz<r*r)a.cell(i,col)}}}
 gift(g,qty){this.qa+=g.k*qty||0}
 like(n){this.qr+=n}
 spawnBomb(col){let x,z,t=0;do{x=rnd(-10,11);z=rnd(-4.8,4.8)}while(this.boxes.some(b=>x>b[0]-1&&x<b[1]+1&&z>b[2]-1&&z<b[3]+1)&&++t<12);
  const m=mk(this.bg,COLN[col],x,15,z,{e:COLN[col],r:.3});m.add(mk(new THREE.CylinderGeometry(.06,.06,.4,6),0xffffff,0,.5,0));this.scene.add(m);this.bombs.push({m,col,y:15,vy:0,s:0,t:0,f:rnd(.7,1.5)})}
 explode(b){const p=b.m.position;this.splat(p,3.4,b.col,.35);this.parts.emit(p.x,p.y+.5,p.z,COLN[b.col],70,7,3);Snd.boom();
  const m=new THREE.Mesh(this.sg,new THREE.MeshBasicMaterial({color:COLN[b.col],transparent:true,opacity:.5}));m.position.copy(p);this.scene.add(m);this.fx.push({m,t:0});this.scene.remove(b.m);b.dead=true}
 fire(){const o=this.barrel,tg=this.tgt,p0=new THREE.Vector3(0,0,1.8);o.localToWorld(p0);const T=clamp(p0.distanceTo(tg)/22,.35,1.2),v=tg.clone().sub(p0);v.y+=4.9*T*T;v.divideScalar(T);
  const m=mk(this.shotG,COLN[this.col],p0.x,p0.y,p0.z,{e:COLN[this.col]});this.scene.add(m);this.shots.push({m,v,t:0});Snd.pop();this.parts.emit(p0.x,p0.y,p0.z,COLN[this.col],8,2)}
 update(dt){rc.setFromCamera({x:A.x,y:A.y},this.cam);const h=rc.intersectObjects(this.meshes,false);this.tgt.copy(h.length?h[0].point:rc.ray.at(30,new THREE.Vector3()));this.barrel.lookAt(this.tgt);
  const cr=$('#cross');cr.style.left=(A.x*.5+.5)*innerWidth+'px';cr.style.top=(.5-A.y*.5)*innerHeight+'px';
  const now=performance.now();if(M.down&&!App.paused&&now-this.last>170){this.last=now;this.fire()}
  const pend=this.qa+this.qr;if(pend>0&&this.bombs.length<90){this.acc+=dt*Math.max(5,pend/6);while(this.acc>=1&&this.qa+this.qr>0&&this.bombs.length<90){this.acc--;const red=Math.random()*pend<this.qr;if(red){this.qr--}else this.qa--;this.spawnBomb(red?3:this.col)}}
  for(const b of this.bombs){if(b.s===0){b.vy-=14*dt;b.y+=b.vy*dt;if(b.y<=.4){b.y=.4;b.s=1}b.m.position.y=b.y}else{b.t+=dt;b.m.scale.setScalar(1+.15*Math.sin(b.t*28));if(b.t>b.f)this.explode(b)}}this.bombs=this.bombs.filter(b=>!b.dead);
  for(const s of this.shots){const pv=s.m.position.clone();s.v.y-=9.8*dt;s.m.position.addScaledVector(s.v,dt);s.t+=dt;const d=s.m.position.clone().sub(pv),L=d.length();rc.set(pv,d.normalize());rc.far=L;const r=rc.intersectObjects(this.meshes,false);rc.far=Infinity;
   this.parts.emit(pv.x,pv.y,pv.z,COLN[this.col],1,.3);if(r.length){this.splat(r[0].point,.95,this.col,.4);this.parts.emit(r[0].point.x,r[0].point.y,r[0].point.z,COLN[this.col],22,3.5,1);s.dead=true}else if(s.t>4)s.dead=true;if(s.dead)this.scene.remove(s.m)}this.shots=this.shots.filter(s=>!s.dead);
  for(const f of this.fx){f.t+=dt;f.m.scale.setScalar(.3+f.t*10);f.m.material.opacity=Math.max(0,.5-f.t*1.6);if(f.t>.35){f.dead=true;this.scene.remove(f.m)}}this.fx=this.fx.filter(f=>!f.dead);
  this.panels.forEach(p=>{if(p.dirty){p.tex.needsUpdate=true;p.dirty=false}});this.parts.update(dt)}
 dispose(){this.panels.forEach(p=>p.tex.dispose());disposeScene(this.scene)}}

/* ================= Application : manager, WIN, HUD, test, TikFinity ================= */
const App={g:null,wins:0,cd:null,paused:false,test:false,likeAcc:0,env:null,lastN:0,
 start(kind,col){this.stop(true);this.wins=0;this.cd=null;this.paused=false;this.g=kind==='g1'?new Quarry():new Paint(col);this.resize();
  $('#menu').classList.remove('on');$('#hud').style.display='block';$('#test').classList.add('on');$('#cross').style.display=kind==='g2'?'block':'none';this.hud();ev(kind==='g1'?'Fosse aux billes lancée':'Bataille de peinture lancée')},
 stop(keep){if(this.g){this.g.dispose();this.g=null}Snd.vac(false);$('#hud').style.display='none';$('#cross').style.display='none';$('#cd').style.display=$('#banner').style.display='none';if(!keep)$('#menu').classList.add('on')},
 resize(){renderer.setSize(innerWidth,innerHeight,false);if(this.g){this.g.cam.aspect=innerWidth/innerHeight;this.g.cam.updateProjectionMatrix()}},
 hud(){$('#wins').textContent=this.wins;$('#tgt').textContent=S.win;$$('[data-k=win]').forEach(e=>e.value=S.win)},
 changeWins(d,why){const o=this.wins;this.wins=Math.max(0,this.wins+d);this.hud();if(this.wins!==o)ev(`${d>0?'+':''}${this.wins-o} WIN ${why||''}`);
  if(this.wins>=S.win&&this.g){this.paused=true;Snd.vac(false);$('#goal').classList.add('on')}},
 gift(name,qty,who){const g=findGift(name);qty=Math.max(1,+qty||1);if(!g){ev(`Cadeau ignoré : ${name}`);return}
  ev(`🎁 ${who} · ${qty}× ${g.n}`);Snd.chime();if(!this.g)return;
  if(g.w){this.changeWins(g.w*qty,`(${g.n})`);banner(`${g.w*qty>0?'+':''}${g.w*qty} WIN`)}else this.g.gift(g,qty,who)},
 likes(n,who){if(!this.g||!(this.g instanceof Paint))return;this.likeAcc+=n;const b=Math.floor(this.likeAcc/S.likes);if(b>0){this.likeAcc-=b*S.likes;this.g.like(b);ev(`❤ ${who} · ${n} likes → ${b} bombe(s) rouge(s)`)}},
 win(dt){const g=this.g;if(g.complete()){if(this.cd==null)this.cd=10;this.cd-=dt;const n=Math.max(1,Math.ceil(this.cd));const c=$('#cd');c.style.display='block';c.textContent=n;if(n!==this.lastN){this.lastN=n;Snd.tick()}
   if(this.cd<=0){this.cd=null;c.style.display='none';this.changeWins(1,'(victoire)');banner('+1 WIN !');g.reset()}}
  else if(this.cd!=null){this.cd=null;$('#cd').style.display='none'}},
 loop(t){requestAnimationFrame(tt=>App.loop(tt));const dt=Math.min(.05,(t-(App.t||t))/1e3);App.t=t;const g=App.g;if(!g)return;
  if(!App.paused){const k=Math.min(1,dt*S.sens*12);A.x+=(M.x-A.x)*k;A.y+=(M.y-A.y)*k;try{g.update(dt);App.win(dt)}catch(e){console.error(e)}}
  renderer.render(g.scene,g.cam);$('#fill').style.width=(g.progress()*100)+'%';$('#lbl').textContent=g.label()}};

const renderer=new THREE.WebGLRenderer({canvas:$('#c'),antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const apply=()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,QUAL[S.q].pr));renderer.shadowMap.enabled=QUAL[S.q].sh;Snd.vol();App.hud();App.resize()};
App.env=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;

function ev(t){const d=document.createElement('div');d.textContent=t;const e=$('#events');e.prepend(d);while(e.children.length>6)e.lastChild.remove();setTimeout(()=>d.remove(),9000)}
function banner(t){const b=$('#banner');b.textContent=t;b.style.display='block';clearTimeout(banner.h);banner.h=setTimeout(()=>b.style.display='none',2200)}

/* TikFinity : API d'événements locale ws://127.0.0.1:21213/ (l'appli TikFinity doit tourner sur le même PC) */
const Conn={ws:null,st(t){$('#cStatus').textContent=t},
 go(){try{this.ws?.close()}catch{}const url=$('#cUrl').value.trim();this.st('Connexion…');
  try{const w=this.ws=new WebSocket(url);w.onopen=()=>{this.st('Connecté à TikFinity. Les cadeaux et likes agissent dans le jeu.');ev('TikFinity connecté')};
   w.onmessage=e=>this.msg(e.data);w.onclose=()=>this.st('Déconnecté.');
   w.onerror=()=>this.st("Échec. Vérifiez que TikFinity tourne sur ce PC. Une page HTTPS (GitHub Pages) peut être bloquée par le navigateur (contenu mixte / accès réseau local) : acceptez la demande d'autorisation si elle apparaît, ou ouvrez index.html en local / depuis une source navigateur OBS locale.")}
  catch(e){this.st('Erreur : '+e.message)}},
 msg(raw){let m;try{m=JSON.parse(raw)}catch{return}const d=m.data||{},who=d.nickname||d.user?.nickname||d.uniqueId||d.user?.uniqueId||'Spectateur';
  if(m.event==='gift'){if(d.giftType===1&&d.repeatEnd===false)return;App.gift(d.giftName||d.gift?.name,d.repeatCount||1,who)}
  else if(m.event==='like')App.likes(+d.likeCount||+d.count||1,who)}};

/* ================= Événements d'interface ================= */
$$('[data-k]').forEach(e=>{e.value=S[e.dataset.k];e.oninput=()=>{const k=e.dataset.k;S[k]=e.tagName==='SELECT'?e.value:(e.value===''||isNaN(+e.value)?DEF[k]:+e.value);save();apply()}});
GIFTS.forEach(g=>{const b=document.createElement('button');b.className='b';b.textContent=g.n;b.onclick=()=>App.gift(g.n,$('#tQty').value,$('#tName').value||'Testeur');$('#tGifts').append(b)});
$('#tLike').onclick=()=>App.likes(+$('#tLikeN').value||1,$('#tName').value||'Testeur');
const show=id=>$('#'+id).classList.add('on');
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;Snd.init();const a=b.dataset.a,col=b.dataset.col;
 if(col){$('#pick').classList.remove('on');App.start('g2',+col)}
 else if(a==='g1')App.start('g1');else if(a==='g2')show('pick');else if(a==='set')show('set');else if(a==='conn')show('conn');
 else if(a==='test'){App.test=!App.test;document.body.classList.toggle('test',App.test);b.textContent='Mode test : '+(App.test?'activé':'désactivé')}
 else if(a==='close')b.closest('.pane').classList.remove('on');
 else if(a==='fs')document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
 else if(a==='again'){$('#goal').classList.remove('on');const g=App.g;App.wins=0;App.paused=false;App.cd=null;g.reset();App.hud()}
 else if(a==='menu'){$('#goal').classList.remove('on');App.stop()}
 else if(b.id==='back')App.stop();else if(b.id==='cGo')Conn.go()});
const cv=$('#c');cv.addEventListener('pointermove',e=>{M.x=e.clientX/innerWidth*2-1;M.y=-(e.clientY/innerHeight*2-1)});
cv.addEventListener('pointerdown',e=>{if(e.button===0){M.down=true;Snd.init();M.x=e.clientX/innerWidth*2-1;M.y=-(e.clientY/innerHeight*2-1)}});
addEventListener('pointerup',()=>M.down=false);addEventListener('blur',()=>M.down=false);cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('resize',()=>App.resize());
addEventListener('error',e=>ev('Erreur : '+e.message));
apply();requestAnimationFrame(t=>App.loop(t));
