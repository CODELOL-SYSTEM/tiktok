import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/* ================= Utilitaires & réglages ================= */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
const DEF={vol:.8,sfx:.8,win:3,likes:2,q:'med',sens:1,url:'ws://127.0.0.1:21213/',auto:0};
const S=(()=>{try{return {...DEF,...JSON.parse(localStorage.getItem('tl_set')||'{}')}}catch{return {...DEF}}})();
const save=()=>{try{localStorage.setItem('tl_set',JSON.stringify(S))}catch{}};
const QUAL={low:{pr:1,cap:4000,sh:false,pt:300},med:{pr:1.5,cap:10000,sh:false,pt:700},high:{pr:2,cap:20000,sh:true,pt:1400}};
const COLN=[0,0x2f7bff,0x2ed36a,0xff3040],COLH=['','#2f7bff','#2ed36a','#ff3040'];
const M={down:false},K={},rc=new THREE.Raycaster(),V3=(x,y,z)=>new THREE.Vector3(x,y,z);

/* m=billes/unité (jeu 1), k=bombes/unité (jeu 2, red=bombes rouges), w=WIN (les 2 jeux) */
const GIFTS=[
 {n:'Rose',re:/\brose\b/,m:50,k:2,red:1},{n:'GG',re:/\bgg\b/,m:-50,k:2},
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

/* ================= Particules ================= */
class Particles{
 constructor(scene,n){this.n=n;this.i=0;this.p=new Float32Array(n*3).fill(-999);this.v=new Float32Array(n*3);this.l=new Float32Array(n);this.col=new Float32Array(n*3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.p,3));g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
  this.o=new THREE.Points(g,new THREE.PointsMaterial({size:.22,vertexColors:true,transparent:true,depthWrite:false}));this.o.frustumCulled=false;scene.add(this.o)}
 put(x,y,z,vx,vy,vz,C,l){const i=this.i=(this.i+1)%this.n,j=i*3;this.p[j]=x;this.p[j+1]=y;this.p[j+2]=z;this.v[j]=vx;this.v[j+1]=vy;this.v[j+2]=vz;this.l[i]=l;this.col[j]=C.r;this.col[j+1]=C.g;this.col[j+2]=C.b}
 emit(x,y,z,c,n,sp,up=0){const C=new THREE.Color(c);for(let k=0;k<n;k++){const a=rnd(0,6.283),e=rnd(-.2,1),s=rnd(.3,1)*sp;this.put(x,y,z,Math.cos(a)*s,e*s+up,Math.sin(a)*s,C,rnd(.5,1.2))}}
 flow(a,b,c){this.put(a.x,a.y,a.z,(b.x-a.x)*4,(b.y-a.y)*4+2,(b.z-a.z)*4,new THREE.Color(c),.25)}
 update(dt){for(let i=0;i<this.n;i++){if(this.l[i]<=0)continue;const j=i*3;this.l[i]-=dt;if(this.l[i]<=0){this.p[j+1]=-999;continue}
  this.v[j+1]-=9*dt;this.p[j]+=this.v[j]*dt;this.p[j+1]+=this.v[j+1]*dt;this.p[j+2]+=this.v[j+2]*dt}
  const a=this.o.geometry.attributes;a.position.needsUpdate=a.color.needsUpdate=true}}

const mk=(geo,col,x,y,z,o={})=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:o.r??.9,metalness:o.m??0,emissive:o.e??0,side:o.side??THREE.FrontSide}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m};
const box=(w,h,d,x,y,z,c,ry=0)=>{const m=mk(new THREE.BoxGeometry(w,h,d),c,x,y,z);m.rotation.y=ry;return m};
function baseScene(q,sky,ext){const sc=new THREE.Scene();sc.background=new THREE.Color(sky);sc.fog=new THREE.Fog(sky,120,380);sc.environment=App.env;
 sc.add(new THREE.HemisphereLight(0xffffff,0x6a7a5a,.75));const sun=new THREE.DirectionalLight(0xfff1d6,2.4);sun.position.set(ext*.6,ext*1.1,ext*.4);
 if(q.sh){sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-ext,right:ext,top:ext,bottom:-ext,far:ext*4});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0006}sc.add(sun);return sc}
function disposeScene(sc){sc.traverse(o=>{o.geometry?.dispose();const m=o.material;(Array.isArray(m)?m:[m]).forEach(x=>{if(x){x.map?.dispose();x.dispose()}})})}
const rod=(a,b,r,mat)=>{const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),14),mat);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize());return m};

/* ================= Joueur en première personne ================= */
class FPS{
 constructor(cam,x,y,z,yaw,w){this.cam=cam;this.p=V3(x,y,z);this.yaw=yaw;this.pitch=0;this.vy=0;this.on=false;this.v=new THREE.Vector2();this.w=w;this.bob=0;this.spd=6.5;this.ac=14;this.gv=22;this.jp=8;this.co=0;cam.rotation.order='YXZ'}
 update(dt){const p=this.p,f=(K.KeyW?1:0)-(K.KeyS?1:0),s=(K.KeyD?1:0)-(K.KeyA?1:0),sy=Math.sin(this.yaw),cy=Math.cos(this.yaw);
  let wx=-sy*f+cy*s,wz=-cy*f-sy*s;const l=Math.hypot(wx,wz)||1;const mv=Math.min(1,Math.abs(f)+Math.abs(s))*this.spd;wx=wx/l*mv;wz=wz/l*mv;
  const a=Math.min(1,dt*(this.on?this.ac:this.ac*.45));this.v.x+=(wx-this.v.x)*a;this.v.y+=(wz-this.v.y)*a;
  let nx=p.x+this.v.x*dt,nz=p.z+this.v.y*dt;
  if(this.w.block(nx,p.z,p.y,p.x,p.z)){nx=p.x;this.v.x=0}if(this.w.block(nx,nz,p.y,nx,p.z)){nz=p.z;this.v.y=0}
  this.bob+=Math.hypot(this.v.x,this.v.y)*dt*1.7;p.x=nx;p.z=nz;
  this.co=this.on?.12:Math.max(0,this.co-dt);if(K.Space&&this.co>0){this.vy=this.jp;this.on=false;this.co=0}this.vy-=this.gv*dt;p.y+=this.vy*dt;const g=this.w.ground(p.x,p.z,p.y);if(p.y<=g){p.y=g;this.vy=0;this.on=true}else if(p.y>g+.05)this.on=false;
  this.w.clamp?.(this);this.cam.position.set(p.x,p.y+1.7+(this.on?Math.sin(this.bob)*.035:0),p.z);this.cam.rotation.set(this.pitch,this.yaw,0)}}

/* ================= Modèles 3D tenus en main ================= */
function vacModel(){const g=new THREE.Group(),
 red=new THREE.MeshPhysicalMaterial({color:0xd01f2b,metalness:.45,roughness:.25,clearcoat:1,clearcoatRoughness:.1}),
 steel=new THREE.MeshStandardMaterial({color:0xcfd5db,metalness:.95,roughness:.22}),
 dark=new THREE.MeshStandardMaterial({color:0x1a1d21,roughness:.55,metalness:.3}),
 yel=new THREE.MeshStandardMaterial({color:0xffc83d,roughness:.4,emissive:0x442b00}),
 glass=new THREE.MeshPhysicalMaterial({color:0x99ccee,transparent:true,opacity:.4,roughness:.05}),
 add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m},P=Math.PI/2;
 add(new THREE.CapsuleGeometry(.12,.34,6,18),red,.2,-.36,-.38,P);
 add(new THREE.CylinderGeometry(.1,.1,.05,20),dark,.2,-.245,-.36);add(new THREE.CylinderGeometry(.03,.03,.03,12),yel,.2,-.225,-.3);add(new THREE.BoxGeometry(.09,.015,.12),glass,.2,-.245,-.45);
 for(const[x,z]of[[.07,-.26],[.33,-.26],[.07,-.5],[.33,-.5]])add(new THREE.CylinderGeometry(.055,.055,.03,16),dark,x,-.44,z,0,0,P);
 add(new THREE.CylinderGeometry(.045,.05,.1,16),dark,.2,-.36,-.64,P);
 const hose=new THREE.CatmullRomCurve3([V3(.2,-.36,-.68),V3(.3,-.44,-.86),V3(.14,-.46,-.98),V3(.02,-.3,-.92),V3(.04,-.2,-.94)]);add(new THREE.TubeGeometry(hose,36,.022,8),dark,0,0,0);
 g.add(rod(V3(.04,-.2,-.9),V3(.05,-.23,-1.06),.028,yel));g.add(rod(V3(.05,-.22,-1.0),V3(.06,-.35,-1.52),.016,steel));
 const d=V3(0,-.3,-1).normalize(),nz=V3(.06,-.37,-1.56),nq=new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),d.clone().negate());
 const head=add(new THREE.CylinderGeometry(.05,.13,.1,22,1,true),red,nz.x,nz.y,nz.z);head.quaternion.copy(nq);head.material.side=THREE.DoubleSide;
 const rim=add(new THREE.TorusGeometry(.13,.012,8,24),yel,nz.x,nz.y,nz.z);rim.position.addScaledVector(d,.05);rim.quaternion.setFromUnitVectors(V3(0,0,1),d);
 const brush=add(new THREE.CylinderGeometry(.018,.018,.22,10),dark,nz.x,nz.y,nz.z);brush.position.addScaledVector(d,.03);brush.rotation.z=P;
 g.traverse(o=>{o.castShadow=false});return{g,tip:nz.clone().addScaledVector(d,.1),brush,base:V3(0,0,0)}}

function cannonModel(col){const g=new THREE.Group(),C=COLN[col],
 steel=new THREE.MeshStandardMaterial({color:0xcfd5db,metalness:.95,roughness:.22}),dark=new THREE.MeshStandardMaterial({color:0x22262b,roughness:.5,metalness:.4}),
 paint=new THREE.MeshStandardMaterial({color:C,emissive:C,emissiveIntensity:.55,roughness:.3}),
 glass=new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.28,roughness:.05}),
 add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m},P=Math.PI/2,X=.22;
 add(new THREE.BoxGeometry(.13,.16,.44),dark,X,-.2,-.5);
 g.add(rod(V3(X,-.18,-.66),V3(X,-.17,-1.05),.052,steel));g.add(rod(V3(X,-.17,-1.0),V3(X,-.17,-1.27),.032,steel));
 add(new THREE.TorusGeometry(.04,.012,8,16),paint,X,-.17,-1.27);add(new THREE.TorusGeometry(.056,.01,8,16),paint,X,-.18,-.9);
 add(new THREE.CylinderGeometry(.07,.07,.27,20),glass,X,-.03,-.46);add(new THREE.CylinderGeometry(.058,.058,.2,18),paint,X,-.05,-.46);add(new THREE.CylinderGeometry(.075,.075,.03,20),dark,X,.12,-.46);
 g.add(rod(V3(X,-.1,-.46),V3(X,-.19,-.55),.02,dark));
 add(new THREE.BoxGeometry(.05,.17,.06),dark,X,-.33,-.4,.35);add(new THREE.CylinderGeometry(.035,.035,.17,12),steel,X,-.27,-.82,P);add(new THREE.BoxGeometry(.03,.03,.1),dark,X,-.08,-.72);
 add(new THREE.SphereGeometry(.012,8,6),new THREE.MeshBasicMaterial({color:0xff3040}),X,-.06,-.76);
 g.traverse(o=>{o.castShadow=false});return{g,muzzle:V3(X,-.17,-1.32),paint}}

/* ================= JEU 1 : la fosse aux billes ================= */
const H=(x,z)=>{const d=Math.hypot(x,z),t=clamp((d-14)/28,0,1)*4,f=Math.floor(t),s=(f+ease((t-f-.35)/.65))/4;
 return -20+20*s+(1-s)*.5*Math.sin(x*.5+z*.3)*Math.cos(z*.45)+clamp((d-42)/10,0,1)*(2.5*Math.sin(x*.05)*Math.cos(z*.04)+1.2*Math.sin(x*.13+z*.11))};

class Marbles{
 constructor(scene,cap){this.cap=cap;this.n=0;this.P=new Float32Array(cap*3);this.V=new Float32Array(cap*3);this.r=.08;
  const mat=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:.15,roughness:.05,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.8});
  this.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),mat,cap);this.mesh.frustumCulled=false;
  const a=this.mesh.instanceMatrix.array,pal=[0xff4d6d,0x4dc9ff,0xffd93d,0x6bff8a,0xb36bff,0xff944d,0xffffff,0x2f5bff].map(c=>new THREE.Color(c)),ca=new Float32Array(cap*3);
  for(let i=0;i<cap;i++){a[i*16]=a[i*16+5]=a[i*16+10]=this.r;a[i*16+15]=1;const c=pal[i%8];ca.set([c.r,c.g,c.b],i*3)}
  this.mesh.instanceColor=new THREE.InstancedBufferAttribute(ca,3);scene.add(this.mesh);
  this.G=500;this.head=new Int32Array(this.G*this.G);this.next=new Int32Array(cap)}
 add(x,y,z){if(this.n>=this.cap)return false;const j=this.n*3;this.P[j]=x;this.P[j+1]=y;this.P[j+2]=z;this.V[j]=rnd(-.5,.5);this.V[j+1]=-2;this.V[j+2]=rnd(-.5,.5);this.n++;return true}
 remove(i){const n=--this.n,j=i*3,k=n*3,{P,V}=this;P[j]=P[k];P[j+1]=P[k+1];P[j+2]=P[k+2];V[j]=V[k];V[j+1]=V[k+1];V[j+2]=V[k+2]}
 suck(c,R,dt){const{P,V}=this;let out=0;for(let i=this.n-1;i>=0;i--){const j=i*3,dx=c.x-P[j],dy=c.y-P[j+1],dz=c.z-P[j+2],d2=dx*dx+dy*dy+dz*dz;
  if(d2<R*R){const d=Math.sqrt(d2)+1e-4,f=90*(1.2-d/R);V[j]=V[j]*.88+dx/d*f*dt;V[j+1]=V[j+1]*.88+dy/d*f*dt+9.8*dt;V[j+2]=V[j+2]*.88+dz/d*f*dt;if(d<.45){this.remove(i);out++}}}return out}
 step(dt){const{P,V,r,G,head,next}=this,n=this.n,cs=.2,off=50;head.fill(-1);
  for(let i=0;i<n;i++){const j=i*3;V[j+1]-=9.8*dt;P[j]+=V[j]*dt;P[j+1]+=V[j+1]*dt;P[j+2]+=V[j+2]*dt;
   const x=P[j],z=P[j+2],g=H(x,z)+r;if(P[j+1]<g){P[j+1]=g;const gx=(H(x+.1,z)-H(x-.1,z))*5,gz=(H(x,z+.1)-H(x,z-.1))*5,l=Math.hypot(gx,1,gz),nx=-gx/l,ny=1/l,nz=-gz/l,vn=V[j]*nx+V[j+1]*ny+V[j+2]*nz;
    if(vn<0){V[j]-=nx*vn*1.25;V[j+1]-=ny*vn*1.25;V[j+2]-=nz*vn*1.25}const fr=1-1.2*dt;V[j]*=fr;V[j+2]*=fr}
   const cx=Math.floor((P[j]+off)/cs),cz=Math.floor((P[j+2]+off)/cs);if(cx>=0&&cz>=0&&cx<G&&cz<G){const c=cz*G+cx;next[i]=head[c];head[c]=i}else next[i]=-1}
  const D=2*r;for(let i=0;i<n;i++){const j=i*3,cx=Math.floor((P[j]+off)/cs),cz=Math.floor((P[j+2]+off)/cs);if(cx<1||cz<1||cx>=G-1||cz>=G-1)continue;
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){for(let o=head[(cz+b)*G+cx+a];o>=0;o=next[o]){if(o<=i)continue;const k=o*3,dx=P[k]-P[j],dy=P[k+1]-P[j+1],dz=P[k+2]-P[j+2],d2=dx*dx+dy*dy+dz*dz;
    if(d2<D*D&&d2>1e-8){const d=Math.sqrt(d2),ov=(D-d)*.5,nx=dx/d,ny=dy/d,nz=dz/d;P[j]-=nx*ov;P[j+1]-=ny*ov;P[j+2]-=nz*ov;P[k]+=nx*ov;P[k+1]+=ny*ov;P[k+2]+=nz*ov;
     const vr=(V[j]-V[k])*nx+(V[j+1]-V[k+1])*ny+(V[j+2]-V[k+2])*nz;if(vr>0){const h=vr*.55;V[j]-=nx*h;V[j+1]-=ny*h;V[j+2]-=nz*h;V[k]+=nx*h;V[k+1]+=ny*h;V[k+2]+=nz*h}}}}}
  const a=this.mesh.instanceMatrix.array;for(let i=0;i<n;i++){a[i*16+12]=P[i*3];a[i*16+13]=P[i*3+1];a[i*16+14]=P[i*3+2]}
  this.mesh.count=n;this.mesh.visible=n>0;this.mesh.instanceMatrix.needsUpdate=true}}

function nameTex(name){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle='#f3e2c0';x.fillRect(0,0,512,256);x.strokeStyle='#b0793c';x.lineWidth=14;x.strokeRect(7,7,498,242);
 x.fillStyle='#6b4423';x.font='bold 34px Sora,Arial';x.textAlign='center';x.fillText('LIVRAISON POUR',256,62);let s=110;x.fillStyle='#1b1208';do{x.font=`bold ${s}px Sora,Arial`;s-=4}while(x.measureText(name).width>470&&s>20);x.fillText(name,256,175);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

class Quarry{
 constructor(){const q=this.q=QUAL[S.q];this.scene=baseScene(q,0xa9c7d8,110);this.cam=new THREE.PerspectiveCamera(75,1,.05,600);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt);this.drones=[];this.peak=0;this.tip=new THREE.Vector3();
  const g=new THREE.PlaneGeometry(260,260,260,260);g.rotateX(-Math.PI/2);const p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,H(x,z));const d=Math.hypot(x,z);
   if(d>43)c.setRGB(.28+rnd(0,.06),.4+rnd(0,.08),.2);else if(d<15)c.setRGB(.76+rnd(0,.04),.68,.5);else{const b=Math.floor((d-14)/7)%2;c.setRGB(b?.82:.66,b?.8:.64,b?.74:.58)}col.set([c.r,c.g,c.b],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();const t=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));t.receiveShadow=true;this.scene.add(t);
  for(let i=0;i<14;i++){const a=i/14*6.283+.3,r=55+rnd(0,25),x=Math.cos(a)*r,z=Math.sin(a)*r,y=H(x,z);
   if(i%3==0)this.scene.add(mk(new THREE.CylinderGeometry(3,3,14,18),0xd8d8d0,x,y+7,z),mk(new THREE.ConeGeometry(3.2,3,18),0x8a8f94,x,y+15.5,z));
   else this.scene.add(box(10,5,7,x,y+2.5,z,0xb9b2a0,-a),box(10.6,.5,7.6,x,y+5.2,z,0x4a4f55,-a),box(2.5,3,.2,x+Math.cos(a)*0,y+1.5,z,0x7a6a55,-a))}
  const cx=-46,cz=-30,cy=H(cx,cz);this.scene.add(box(2,28,2,cx,cy+14,cz,0xe0a526),box(22,1.8,1.8,cx+8,cy+27,cz,0xe0a526),box(3,3,3,cx,cy+1.5,cz,0x333a40));
  for(let i=0;i<3;i++){const x=40+i*7,z=-48,y=H(x,z);this.scene.add(box(8,2.4,3.4,x,y+1.3,z,0xe0a526),box(3,3,3.4,x+4.6,y+1.8,z,0x2c3a4a),box(6,.2,3.5,x,y+2.6,z,0x5a5a55))}
  for(let i=0;i<90;i++){const a=rnd(0,6.283),r=rnd(48,110),x=Math.cos(a)*r,z=Math.sin(a)*r,y=H(x,z),s=rnd(.9,1.8);this.scene.add(mk(new THREE.CylinderGeometry(.25*s,.3*s,2*s,6),0x5a3d22,x,y+s,z),mk(new THREE.ConeGeometry(1.8*s,5.5*s,7),0x2f5f2c,x,y+4*s,z))}
  this.m=new Marbles(this.scene,q.cap);this.vm=vacModel();this.vm.g.position.copy(this.vm.base);this.cam.add(this.vm.g);
  this.fps=new FPS(this.cam,0,H(0,10),10,0,{block:(nx,nz,y,ox,oz)=>Math.hypot(nx,nz)>115||(y<=H(ox,oz)+.1&&H(nx,nz)-y>Math.hypot(nx-ox,nz-oz)*1.9+.03),ground:(x,z)=>H(x,z)});this.reset()}
 total(){return this.m.n+this.drones.reduce((a,d)=>a+d.rem,0)}
 reset(){this.m.n=0;this.drones.forEach(d=>this.scene.remove(d.g));this.drones=[];for(let i=0;i<1500;i++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*12,x=Math.cos(a)*r,z=Math.sin(a)*r;this.m.add(x,H(x,z)+rnd(.3,2.5),z)}this.peak=this.total()}
 complete(){return this.total()===0}
 progress(){return this.peak?1-this.total()/this.peak:0}
 label(){return `${this.total().toLocaleString('fr-FR')} billes restantes`}
 gift(g,qty,name){const d=(g.m||0)*qty;if(!d)return;
  if(d>0){this.makeDrone(name,d);this.peak=Math.max(this.peak,this.total())}
  else{let k=-d;const a=Math.min(k,this.m.n);this.m.n-=a;k-=a;for(const x of this.drones){const b=Math.min(k,x.rem);x.rem-=b;k-=b}}}
 like(){}
 target(){const p=this.fps.p,y=this.fps.yaw;return V3(p.x-Math.sin(y)*5,p.y+13,p.z-Math.cos(y)*5)}
 makeDrone(name,n){const g=new THREE.Group(),dk=new THREE.MeshStandardMaterial({color:0x222831,metalness:.6,roughness:.4}),rot=[];
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4,.6,1.5),dk));
  for(const[x,z]of[[1.5,1],[-1.5,1],[1.5,-1],[-1.5,-1]]){const a=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x,z)*2,.12,.12),dk);a.position.set(x/2,0,z/2);a.rotation.y=-Math.atan2(z,x);g.add(a);
   const r=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.05,20),new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.45}));r.position.set(x,.25,z);g.add(r);rot.push(r)}
  const c=new THREE.Group();c.position.y=-1.4;g.add(c);c.add(box(3.2,2,2.2,0,0,0,0xc99a5b));c.add(box(.5,2.02,2.22,0,0,0,0xe7d3a8));
  const lm=new THREE.MeshBasicMaterial({map:nameTex(name)}),f=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),lm),b=f.clone();f.position.set(0,0,1.12);b.position.set(0,0,-1.12);b.rotation.y=Math.PI;c.add(f,b);
  const fl=[1,-1].map(s=>{const p=new THREE.Group();p.position.set(0,1,s*1.1);p.add(box(3.2,.08,1.1,0,0,-s*.55,0xb98a4c));c.add(p);return p});
  const T=this.target();g.scale.setScalar(1.8);g.position.set(T.x-70,T.y+14,T.z-50);this.scene.add(g);this.drones.push({g,c,rot,fl,s:0,t:0,rem:n,n,s0:g.position.clone()})}
 updDrone(d,dt){d.t+=dt;d.rot.forEach(r=>r.rotation.y+=dt*45);const g=d.g,T=this.target(),cp=this.cam.position;
  if(d.s===0){const u=ease(d.t/3);g.position.lerpVectors(d.s0,T,u);if(d.t>3){d.s=1;d.t=0}}else if(d.s<5)g.position.lerp(T,Math.min(1,dt*3));
  if(d.s<5)g.rotation.y=Math.atan2(cp.x-g.position.x,cp.z-g.position.z);
  if(d.s===1){d.c.position.y=-1.4-3*ease(d.t/1.1);if(d.t>1.1){d.s=2;d.t=0}}
  else if(d.s===2){const a=ease(d.t/.8)*2.1;d.fl[0].rotation.x=-a;d.fl[1].rotation.x=a;if(d.t>.8){d.s=3;d.t=0}}
  else if(d.s===3){const k=Math.min(d.rem,Math.ceil(dt*Math.max(120,d.n/3.5))),w=V3(0,0,0);d.c.getWorldPosition(w);
   for(let i=0;i<k;i++)if(this.m.add(w.x+rnd(-1.4,1.4),w.y+.8,w.z+rnd(-1,1)))d.rem--;else break;if(d.rem<=0){d.s=4;d.t=0}}
  else if(d.s===4){const u=ease(d.t/.7);d.c.scale.setScalar(Math.max(.001,1-u));d.fl.forEach((f,i)=>f.rotation.x=(i?1:-1)*2.1*(1-u));if(d.t>.7){d.s=5;d.t=0;d.c.visible=false}}
  else if(d.s===5){g.position.x+=dt*16*d.t;g.position.y+=dt*8*d.t;if(d.t>2.4){this.scene.remove(g);d.dead=true}}}
 update(dt){const cam=this.cam;this.fps.update(dt);cam.updateMatrixWorld(true);const on=M.down&&App.locked&&!App.paused;this.sucking=on;Snd.vac(on);
  this.tip.copy(this.vm.tip);cam.localToWorld(this.tip);const tp=this.tip;
  if(on){const k=this.m.suck(tp,3.4,dt);if(k)this.parts.emit(tp.x,tp.y,tp.z,0xdff6ff,Math.min(k,5),2);
   for(let i=0;i<5;i++)this.parts.flow(V3(tp.x+rnd(-2.6,2.6),tp.y+rnd(-1.6,1),tp.z+rnd(-2.6,2.6)),tp,0x9be7ff);
   this.vm.g.position.set(rnd(-.004,.004),rnd(-.004,.004),rnd(-.004,.004));this.vm.brush.rotation.y+=dt*40}else this.vm.g.position.set(0,0,0);
  this.drones.forEach(x=>this.updDrone(x,dt));this.drones=this.drones.filter(x=>!x.dead);this.m.step(Math.min(dt,1/30));this.parts.update(dt)}
 dispose(){Snd.vac(false);disposeScene(this.scene)}}

/* ================= JEU 2 : la bataille de peinture ================= */
const PX=8,AX=45,AZ=35;
class Panel{
 constructor(w,h,pos,ry,rx,color,owner){this.owner=owner;this.color=color;this.nx=Math.max(2,Math.round(w/.6));this.ny=Math.max(2,Math.round(h/.6));this.cv=document.createElement('canvas');this.cv.width=this.nx*PX;this.cv.height=this.ny*PX;this.cx=this.cv.getContext('2d');
  this.tex=new THREE.CanvasTexture(this.cv);this.tex.colorSpace=THREE.SRGBColorSpace;this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:this.tex,roughness:.7,side:THREE.DoubleSide}));
  this.mesh.position.copy(pos);this.mesh.rotation.set(rx,ry,0);this.mesh.receiveShadow=this.mesh.castShadow=true;this.mesh.updateMatrixWorld(true);this.rad=Math.hypot(w,h)/2+.1;this.c=V3(0,0,0);this.mesh.getWorldPosition(this.c);
  const N=this.nx*this.ny;this.st=new Uint8Array(N);this.act=new Uint8Array(N).fill(1);this.ct=new Float32Array(N*3);const v=V3(0,0,0);
  for(let y=0;y<this.ny;y++)for(let x=0;x<this.nx;x++){v.set(((x+.5)/this.nx-.5)*w,((y+.5)/this.ny-.5)*h,0);this.mesh.localToWorld(v);this.ct.set([v.x,v.y,v.z],(y*this.nx+x)*3)}this.clear()}
 clear(){this.st.fill(0);this.cx.fillStyle=this.color;this.cx.fillRect(0,0,this.cv.width,this.cv.height);this.tex.needsUpdate=true}
 cell(i,col){this.st[i]=col;const x=i%this.nx,y=(i/this.nx)|0,c=this.cx;c.fillStyle=COLH[col];c.beginPath();c.arc((x+.5)*PX+rnd(-1.2,1.2),(this.ny-1-y+.5)*PX+rnd(-1.2,1.2),PX*.72,0,6.3);c.fill();this.dirty=true}}

class Paint{
 constructor(col){const q=this.q=QUAL[S.q];this.col=col;this.scene=baseScene(q,0xb8d4e8,60);this.cam=new THREE.PerspectiveCamera(75,1,.05,500);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt);this.panels=[];this.blocks=[];this.bombs=[];this.shots=[];this.fx=[];this.qa=0;this.qr=0;this.acc=0;this.last=0;this.rec=0;this.sc=0;
  const out=mk(new THREE.PlaneGeometry(500,500),0x6f8f5a,0,-.06,0);out.rotation.x=-Math.PI/2;this.scene.add(out);
  for(let x=-40;x<=40;x+=10)for(let z=-30;z<=30;z+=10)this.pan(10,10,[x,0,z],0,-Math.PI/2,'#d4dade');
  for(let z=-30;z<=30;z+=10){this.pan(10,4,[-AX,2,z],Math.PI/2,0,'#b7c0c7');this.pan(10,4,[AX,2,z],-Math.PI/2,0,'#b7c0c7')}
  for(let x=-40;x<=40;x+=10){this.pan(10,4,[x,2,-AZ],0,0,'#b7c0c7');this.pan(10,4,[x,2,AZ],Math.PI,0,'#b7c0c7')}
  const pal=['#e8e6df','#9fb1c1','#c9b79c','#8aa08f','#d8c3c3','#6f7c8a','#e3c88a'];let sd=11;const R=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const T=[[4,2.2,4],[3,1.6,5],[1.6,3.2,1.6],[.9,2.8,.9],[7,1.8,.8],[.8,1.8,7],[1.5,.8,1.5],[2,.7,2],[2.5,1.2,2.5],[3,.6,3],[5,1,2]];
  for(let i=0,k=0;i<1500&&k<62;i++){const t=T[k%T.length],w=t[0]*(.8+R()*.5),h=t[1]*(.8+R()*.4),d=t[2]*(.8+R()*.5),x=(R()-.5)*82,z=(R()-.5)*62;
   if(x<-30&&Math.abs(z)<8)continue;if(this.blocks.some(b=>x+w/2+2.5>b.x0&&x-w/2-2.5<b.x1&&z+d/2+2.5>b.z0&&z-d/2-2.5<b.z1))continue;
   this.addBlock(w,h,d,x,z,0,pal[k%pal.length]);k++;if(k%9==0){const b=this.blocks[this.blocks.length-1];this.addBlock(w*.55,h*.8,d*.55,x,z,b.y1,pal[(k+3)%pal.length])}}
  for(const p of this.panels)for(let i=0;i<p.st.length;i++){const x=p.ct[i*3],y=p.ct[i*3+1],z=p.ct[i*3+2];
   if(this.blocks.some(b=>b!==p.owner&&x>b.x0-.05&&x<b.x1+.05&&y>b.y0-.05&&y<b.y1+.05&&z>b.z0-.05&&z<b.z1+.05))p.act[i]=0}
  this.meshes=this.panels.map(p=>p.mesh);
  this.vm=cannonModel(col);this.cam.add(this.vm.g);
  this.bg=new THREE.SphereGeometry(.38,14,10);this.shotG=new THREE.SphereGeometry(.1,8,6);this.sg=new THREE.SphereGeometry(1,16,12);
  this.fps=new FPS(this.cam,-40,0,0,-Math.PI/2,{
   block:(nx,nz,y)=>Math.abs(nx)>AX-.4||Math.abs(nz)>AZ-.4||this.blocks.some(b=>nx>b.x0-.35&&nx<b.x1+.35&&nz>b.z0-.35&&nz<b.z1+.35&&y<b.y1-.25&&y+1.8>b.y0),
   ground:(x,z,y)=>{let g=0;for(const b of this.blocks)if(x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2&&b.y1<=y+.4&&b.y1>g)g=b.y1;return g},
   clamp:f=>{const p=f.p;p.x=clamp(p.x,-AX+.5,AX-.5);p.z=clamp(p.z,-AZ+.5,AZ-.5);if(p.y<0){p.y=0;f.vy=0}if(p.y>40){p.y=40;f.vy=Math.min(0,f.vy)}
    for(const b of this.blocks)if(p.x>b.x0-.3&&p.x<b.x1+.3&&p.z>b.z0-.3&&p.z<b.z1+.3&&p.y<b.y1-.3&&p.y+1.8>b.y0){p.y=b.y1;f.vy=0}}});Object.assign(this.fps,{spd:15,ac:30,gv:30,jp:11});this.reset()}
 pan(w,h,p,ry,rx,color,o=null){const a=new Panel(w,h,V3(...p),ry,rx,color,o);this.panels.push(a);this.scene.add(a.mesh)}
 addBlock(w,h,d,x,z,y0,c){const b={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0,y1:y0+h},yc=y0+h/2,P=Math.PI;this.blocks.push(b);
  this.pan(w,h,[x,yc,z+d/2],0,0,c,b);this.pan(w,h,[x,yc,z-d/2],P,0,c,b);this.pan(d,h,[x+w/2,yc,z],P/2,0,c,b);this.pan(d,h,[x-w/2,yc,z],-P/2,0,c,b);this.pan(w,d,[x,y0+h+.005,z],0,-P/2,c,b)}
 reset(){this.panels.forEach(p=>p.clear());[...this.bombs,...this.shots,...this.fx].forEach(o=>this.scene.remove(o.m));this.bombs=[];this.shots=[];this.fx=[];this.qa=this.qr=0;this.st0=this.stats()}
 stats(){let t=0,p=0;for(const a of this.panels)for(let i=0;i<a.st.length;i++)if(a.act[i]){t++;if(a.st[i]===this.col)p++}return{t,p}}
 progress(){return this.st0.t?this.st0.p/this.st0.t:0}
 complete(){return this.st0.t>0&&this.st0.p===this.st0.t}
 label(){return `${(this.progress()*100).toFixed(1)} % peint`}
 gift(g,qty){const n=(g.k||0)*qty;if(g.red)this.qr+=n;else this.qa+=n}
 like(n){this.qr+=n}
 splat(pt,R,col,jit){for(const a of this.panels){if(a.c.distanceTo(pt)>R+a.rad)continue;for(let i=0;i<a.st.length;i++){if(!a.act[i]||a.st[i]===col)continue;const dx=a.ct[i*3]-pt.x,dy=a.ct[i*3+1]-pt.y,dz=a.ct[i*3+2]-pt.z,r=R*(1-jit*Math.random());if(dx*dx+dy*dy+dz*dz<r*r)a.cell(i,col)}}}
 spawnBomb(col){let x,z,y=0,t=0;if(Math.random()<.4){const b=this.blocks[(Math.random()*this.blocks.length)|0];x=rnd(b.x0,b.x1);z=rnd(b.z0,b.z1);y=b.y1;for(const o of this.blocks)if(x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&o.y1>y)y=o.y1}
  else do{x=rnd(-AX+2,AX-2);z=rnd(-AZ+2,AZ-2)}while(this.blocks.some(b=>x>b.x0-1&&x<b.x1+1&&z>b.z0-1&&z<b.z1+1)&&++t<20);
  const m=mk(this.bg,COLN[col],x,y+25,z,{e:COLN[col],r:.3});m.add(mk(new THREE.CylinderGeometry(.06,.06,.4,6),0xffffff,0,.5,0));this.scene.add(m);this.bombs.push({m,col,y:y+25,gy:y+.4,vy:0,s:0,t:0,f:rnd(.7,1.5)})}
 explode(b){const p=b.m.position;this.splat(p,4.5,b.col,.35);this.parts.emit(p.x,p.y+.5,p.z,COLN[b.col],70,8,3);Snd.boom();
  const m=new THREE.Mesh(this.sg,new THREE.MeshBasicMaterial({color:COLN[b.col],transparent:true,opacity:.5}));m.position.copy(p);this.scene.add(m);this.fx.push({m,t:0});this.scene.remove(b.m);b.dead=true}
 fire(){const mz=this.vm.muzzle.clone();this.cam.localToWorld(mz);const fw=this.cam.getWorldDirection(V3(0,0,0)),tg=this.cam.position.clone().addScaledVector(fw,40),v=tg.sub(mz).normalize().multiplyScalar(32);
  const m=mk(this.shotG,COLN[this.col],mz.x,mz.y,mz.z,{e:COLN[this.col]});this.scene.add(m);this.shots.push({m,v,t:0});Snd.pop();this.parts.emit(mz.x,mz.y,mz.z,COLN[this.col],8,2);this.rec=1}
 update(dt){this.fps.update(dt);this.cam.updateMatrixWorld(true);this.vm.g.position.z=this.rec*.07;this.rec=Math.max(0,this.rec-dt*9);
  const now=performance.now();if(M.down&&App.locked&&!App.paused&&now-this.last>170){this.last=now;this.fire()}
  const pend=this.qa+this.qr;if(pend>0&&this.bombs.length<90){this.acc+=dt*Math.max(5,pend/6);while(this.acc>=1&&this.qa+this.qr>0&&this.bombs.length<90){this.acc--;const red=Math.random()*(this.qa+this.qr)<this.qr;if(red)this.qr--;else this.qa--;this.spawnBomb(red?3:this.col)}}
  for(const b of this.bombs){if(b.s===0){b.vy-=16*dt;b.y+=b.vy*dt;if(b.y<=b.gy){b.y=b.gy;b.s=1}b.m.position.y=b.y}else{b.t+=dt;b.m.scale.setScalar(1+.15*Math.sin(b.t*28));if(b.t>b.f)this.explode(b)}}this.bombs=this.bombs.filter(b=>!b.dead);
  for(const s of this.shots){const pv=s.m.position.clone();s.v.y-=5*dt;s.m.position.addScaledVector(s.v,dt);s.t+=dt;const d=s.m.position.clone().sub(pv),L=d.length();rc.set(pv,d.normalize());rc.far=L;const r=rc.intersectObjects(this.meshes,false);rc.far=Infinity;
   this.parts.emit(pv.x,pv.y,pv.z,COLN[this.col],1,.3);if(r.length){this.splat(r[0].point,.95,this.col,.4);this.parts.emit(r[0].point.x,r[0].point.y,r[0].point.z,COLN[this.col],22,3.5,1);s.dead=true}else if(s.t>5)s.dead=true;if(s.dead)this.scene.remove(s.m)}this.shots=this.shots.filter(s=>!s.dead);
  for(const f of this.fx){f.t+=dt;f.m.scale.setScalar(.3+f.t*13);f.m.material.opacity=Math.max(0,.5-f.t*1.6);if(f.t>.35){f.dead=true;this.scene.remove(f.m)}}this.fx=this.fx.filter(f=>!f.dead);
  this.panels.forEach(p=>{if(p.dirty){p.tex.needsUpdate=true;p.dirty=false}});if(++this.sc%6===0)this.st0=this.stats();this.parts.update(dt)}
 dispose(){this.panels.forEach(p=>p.tex.dispose());disposeScene(this.scene)}}

/* ================= Application : manager, WIN, HUD, test, TikFinity ================= */
const renderer=new THREE.WebGLRenderer({canvas:$('#c'),antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const cv=$('#c');
const App={g:null,wins:0,cd:null,paused:false,test:false,likeAcc:0,env:null,lastN:0,locked:false,
 start(kind,col){this.stop(true);this.wins=0;this.cd=null;this.paused=false;this.g=kind==='g1'?new Quarry():new Paint(col);this.resize();
  $('#menu').classList.remove('on');$('#hud').style.display='block';$('#test').classList.add('on');$('#cross').style.display='block';this.hud();this.lockUI();ev(kind==='g1'?'Fosse aux billes lancée':'Bataille de peinture lancée')},
 stop(keep){if(this.g){this.g.dispose();this.g=null}Snd.vac(false);document.exitPointerLock?.();$('#hud').style.display='none';$('#cross').style.display='none';$('#lock').style.display='none';$('#cd').style.display=$('#banner').style.display='none';if(!keep)$('#menu').classList.add('on')},
 lockUI(){$('#lock').style.display=this.g&&!this.locked&&!this.paused?'block':'none'},
 resize(){renderer.setSize(innerWidth,innerHeight,false);if(this.g){this.g.cam.aspect=innerWidth/innerHeight;this.g.cam.updateProjectionMatrix()}},
 hud(){$('#wins').textContent=this.wins;$('#tgt').textContent=S.win;$$('[data-k=win]').forEach(e=>e.value=S.win)},
 changeWins(d,why){const o=this.wins;this.wins=Math.max(0,this.wins+d);this.hud();if(this.wins!==o)ev(`${this.wins-o>0?'+':''}${this.wins-o} WIN ${why||''}`);
  if(this.wins>=S.win&&this.g){this.paused=true;M.down=false;Snd.vac(false);document.exitPointerLock?.();$('#goal').classList.add('on')}},
 gift(name,qty,who){const g=findGift(name);qty=Math.max(1,+qty||1);if(!g){ev(`Cadeau ignoré : ${name}`);return}
  ev(`🎁 ${who} · ${qty}× ${g.n}`);Snd.chime();if(!this.g)return;
  if(g.w){this.changeWins(g.w*qty,`(${g.n})`);banner(`${g.w*qty>0?'+':''}${g.w*qty} WIN`)}else this.g.gift(g,qty,who)},
 likes(n,who){if(!(this.g instanceof Paint))return;this.likeAcc+=n;const b=Math.floor(this.likeAcc/S.likes);if(b>0){this.likeAcc-=b*S.likes;this.g.like(b);ev(`❤ ${who} · ${n} likes → ${b} bombe(s) rouge(s)`)}},
 win(dt){const g=this.g;if(g.complete()){if(this.cd==null)this.cd=10;this.cd-=dt;const n=Math.max(1,Math.ceil(this.cd)),c=$('#cd');c.style.display='block';c.textContent=n;if(n!==this.lastN){this.lastN=n;Snd.tick()}
   if(this.cd<=0){this.cd=null;c.style.display='none';this.changeWins(1,'(victoire)');banner('+1 WIN !');g.reset()}}
  else if(this.cd!=null){this.cd=null;$('#cd').style.display='none'}},
 loop(t){requestAnimationFrame(tt=>App.loop(tt));const dt=Math.min(.05,(t-(App.t||t))/1e3);App.t=t;const g=App.g;if(!g)return;
  if(!App.paused){try{g.update(dt);App.win(dt)}catch(e){console.error(e)}}
  renderer.render(g.scene,g.cam);$('#fill').style.width=(g.progress()*100)+'%';$('#lbl').textContent=g.label()}};

const apply=()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,QUAL[S.q].pr));renderer.shadowMap.enabled=QUAL[S.q].sh;Snd.vol();App.hud();App.resize()};
App.env=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;

function ev(t){const d=document.createElement('div');d.textContent=t;const e=$('#events');e.prepend(d);while(e.children.length>6)e.lastChild.remove();setTimeout(()=>d.remove(),9000)}
function banner(t){const b=$('#banner');b.textContent=t;b.style.display='block';clearTimeout(banner.h);banner.h=setTimeout(()=>b.style.display='none',2200)}

/* TikFinity : API d'événements locale ws://127.0.0.1:21213/ (TikFinity doit tourner sur le même PC).
   Les cadeaux sont reconnus automatiquement par leur nom (GIFTS) : aucune action à créer dans TikFinity. */
const HELP="échec de connexion. TikFinity tourne-t-il sur ce PC ? Une page HTTPS (GitHub Pages) peut être bloquée par le navigateur : acceptez l'autorisation « réseau local » si elle s'affiche, ou ouvrez index.html en local.";
const Conn={ws:null,want:false,n:0,gifts:0,likes:0,timer:null,
 set(c,t){$('#tk').className=c;$('#tk span').textContent='TikFinity : '+t.split('.')[0].slice(0,60);$('#cStatus').textContent=t},
 stats(){$('#cStats').textContent=`Événements reçus : ${this.n} · cadeaux : ${this.gifts} · likes : ${this.likes}`},
 go(){this.stop(true);const url=$('#cUrl').value.trim();S.url=url;S.auto=1;save();this.want=true;this.open(url)},
 open(url){clearTimeout(this.timer);this.set('wait','connexion…');let w;try{w=this.ws=new WebSocket(url)}catch(e){this.set('err','adresse invalide ('+e.message+')');return}
  const to=setTimeout(()=>{if(w.readyState!==1){this.set('err','délai dépassé : '+HELP);try{w.close()}catch{}}},6000);
  w.onopen=()=>{clearTimeout(to);this.set('ok','connecté');ev('TikFinity connecté')};
  w.onmessage=e=>this.msg(e.data);
  w.onerror=()=>{if(w.readyState!==1)this.set('err',HELP)};
  w.onclose=()=>{clearTimeout(to);if(this.ws!==w)return;if(this.want){if($('#tk').className!=='err')this.set('wait','connexion perdue, nouvelle tentative…');this.timer=setTimeout(()=>this.open(url),3000)}else this.set('','déconnecté')}},
 stop(silent){this.want=false;clearTimeout(this.timer);const w=this.ws;this.ws=null;try{w?.close()}catch{}if(!silent){S.auto=0;save()}this.set('','déconnecté')},
 msg(raw){let m;try{m=JSON.parse(raw)}catch{return}(Array.isArray(m)?m:[m]).forEach(x=>this.ev(x));this.stats()},
 ev(m){if(!m||!m.event)return;this.n++;const d=m.data||{},who=d.nickname||d.user?.nickname||d.uniqueId||d.user?.uniqueId||'Spectateur';
  if(m.event==='gift'){if(d.giftType===1&&d.repeatEnd===false)return;this.gifts++;App.gift(d.giftName||d.gift?.name,d.repeatCount||d.amount||1,who)}
  else if(m.event==='like'){const n=+d.likeCount||+d.count||1;this.likes+=n;App.likes(n,who)}}};

/* ================= Événements d'interface ================= */
$$('[data-k]').forEach(e=>{e.value=S[e.dataset.k];e.oninput=()=>{const k=e.dataset.k;S[k]=e.tagName==='SELECT'?e.value:(e.value===''||isNaN(+e.value)?DEF[k]:+e.value);save();apply()}});
GIFTS.forEach(g=>{const b=document.createElement('button');b.className='b';b.textContent=g.n;b.onclick=()=>App.gift(g.n,$('#tQty').value,$('#tName').value||'Testeur');$('#tGifts').append(b)});
$('#tLike').onclick=()=>App.likes(+$('#tLikeN').value||1,$('#tName').value||'Testeur');
const show=id=>$('#'+id).classList.add('on'),lock=()=>{try{const r=cv.requestPointerLock();r?.catch?.(()=>{})}catch{}};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;Snd.init();const a=b.dataset.a,col=b.dataset.col;
 if(col){$('#pick').classList.remove('on');App.start('g2',+col);lock()}
 else if(a==='g1'){App.start('g1');lock()}else if(a==='g2')show('pick');else if(a==='set')show('set');else if(a==='conn')show('conn');
 else if(a==='test'){App.test=!App.test;document.body.classList.toggle('test',App.test);b.textContent='Mode test : '+(App.test?'activé':'désactivé')}
 else if(a==='close')b.closest('.pane').classList.remove('on');
 else if(a==='fs')document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
 else if(a==='again'){$('#goal').classList.remove('on');const g=App.g;App.wins=0;App.paused=false;App.cd=null;g.reset();App.hud();lock()}
 else if(a==='menu'){$('#goal').classList.remove('on');App.stop()}
 else if(b.id==='back')App.stop();else if(b.id==='cGo')Conn.go();else if(b.id==='cStop')Conn.stop()});
document.addEventListener('pointerlockchange',()=>{App.locked=document.pointerLockElement===cv;if(!App.locked)M.down=false;App.lockUI()});
document.addEventListener('mousemove',e=>{const g=App.g;if(!App.locked||!g||App.paused)return;const k=.0022*S.sens;g.fps.yaw-=e.movementX*k;g.fps.pitch=clamp(g.fps.pitch-e.movementY*k,-1.5,1.5)});
cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;Snd.init();if(App.locked)M.down=true;else if(App.g&&!App.paused)lock()});
addEventListener('pointerup',()=>M.down=false);addEventListener('blur',()=>{M.down=false;for(const k in K)K[k]=false});cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(App.locked&&e.code==='Space')e.preventDefault();K[e.code]=true});addEventListener('keyup',e=>K[e.code]=false);
addEventListener('resize',()=>App.resize());
addEventListener('error',e=>ev('Erreur : '+e.message));
$('#cUrl').value=S.url||DEF.url;Conn.stats();Conn.set('','déconnecté');if(S.auto)Conn.go();
apply();requestAnimationFrame(t=>App.loop(t));
