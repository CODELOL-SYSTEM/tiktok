import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/* ================= Utilitaires & réglages ================= */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
const DEF={vol:.8,sfx:.8,win:3,likes:2,lkB:2,lkBn:1,lkM:2,lkMn:50,lkF:2,lkFn:10,lkR:30,lkRp:10,voice:.8,outfit:'v',q:'med',sens:1,url:'ws://127.0.0.1:21213/',auto:0};
const S=(()=>{try{return {...DEF,...JSON.parse(localStorage.getItem('tl_set')||'{}')}}catch{return {...DEF}}})();
const save=()=>{try{localStorage.setItem('tl_set',JSON.stringify(S))}catch{}};
const QUAL={low:{pr:1,cap:4000,sh:false,pt:300},med:{pr:1.5,cap:10000,sh:false,pt:700},high:{pr:2,cap:20000,sh:true,pt:1400}};
const COLN=[0,0x2f7bff,0x2ed36a,0xff3040],COLH=['','#2f7bff','#2ed36a','#ff3040'];
const M={down:false},K={},rc=new THREE.Raycaster(),V3=(x,y,z)=>new THREE.Vector3(x,y,z);

/* m=billes/unité (jeu 1), k=bombes/unité (jeu 2, red=bombes rouges) ; jeu 3 : k×5 fruits ; w=WIN (les 3 jeux) */
const GIFTS=[
 {n:'Rose',re:/\brose\b/,m:50,k:2,red:1},{n:'GG',re:/\bgg\b/,m:-50,k:2},
 {n:'Capybara',re:/capybara/,m:-1500,k:60},{n:'Doughnut',re:/dou?ghnut|donut|beignet/,m:1500,k:60},
 {n:'Ourson',re:/ourson|teddy|bear/,m:-5000,k:200},{n:'Cœur dans les mains',re:/hand|mains/,m:5000,k:200},
 {n:'Cœur',re:/heart|coeur/,m:10000,k:400},{n:'Lunettes de soleil',re:/sunglass|lunette/,m:-10000,k:400},
 {n:'Parfum',re:/parfum|perfume/,k:0},
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

/* ================= Particules (disques ronds) ================= */
const DOT=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.8,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
class Particles{
 constructor(scene,n){this.n=n;this.i=0;this.p=new Float32Array(n*3).fill(-999);this.v=new Float32Array(n*3);this.l=new Float32Array(n);this.col=new Float32Array(n*3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.p,3));g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
  this.o=new THREE.Points(g,new THREE.PointsMaterial({size:.22,map:DOT,alphaTest:.25,vertexColors:true,transparent:true,depthWrite:false}));this.o.frustumCulled=false;scene.add(this.o)}
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

/* ================= Joueur en première personne (avec ragdoll + poussée) ================= */
class FPS{
 constructor(cam,x,y,z,yaw,w){this.cam=cam;this.p=V3(x,y,z);this.yaw=yaw;this.pitch=0;this.vy=0;this.on=false;this.v=new THREE.Vector2();this.w=w;this.bob=0;this.spd=6.5;this.ac=14;this.gv=22;this.jp=8;this.co=0;
  this.rag=this.rt=this.kx=this.kz=this.inv=0;cam.rotation.order='YXZ'}
 /* ragdoll(durée) : ignoré si déjà en ragdoll (pas de prolongation) ; force=true ignore l'immunité post-ragdoll */
 ragdoll(sec,force){if(this.rag>0)return false;if(!force&&this.inv>0)return false;this.rag=this.rt=sec;this.vy=Math.max(this.vy,3);return true}
 update(dt){const p=this.p;if(this.rag>0){this.rag-=dt;if(this.rag<=0){this.rag=0;this.inv=1.5;this.pitch=0}}this.inv=Math.max(0,this.inv-dt);
  const KK=this.rag>0?{}:K,f=(KK.KeyW?1:0)-(KK.KeyS?1:0),s=(KK.KeyD?1:0)-(KK.KeyA?1:0),sy=Math.sin(this.yaw),cy=Math.cos(this.yaw);
  let wx=-sy*f+cy*s,wz=-cy*f-sy*s;const l=Math.hypot(wx,wz)||1;const mv=Math.min(1,Math.abs(f)+Math.abs(s))*this.spd;wx=wx/l*mv;wz=wz/l*mv;
  const a=Math.min(1,dt*(this.on?this.ac:this.ac*.45));this.v.x+=(wx-this.v.x)*a;this.v.y+=(wz-this.v.y)*a;
  let nx=p.x+(this.v.x+this.kx)*dt,nz=p.z+(this.v.y+this.kz)*dt;
  if(this.w.block(nx,p.z,p.y,p.x,p.z)){nx=p.x;this.v.x=0}if(this.w.block(nx,nz,p.y,nx,p.z)){nz=p.z;this.v.y=0}
  this.bob+=Math.hypot(this.v.x,this.v.y)*dt*1.7;p.x=nx;p.z=nz;this.kx*=Math.max(0,1-3*dt);this.kz*=Math.max(0,1-3*dt);
  this.co=this.on?.12:Math.max(0,this.co-dt);if(KK.Space&&this.co>0){this.vy=this.jp;this.on=false;this.co=0}this.vy-=this.gv*dt;p.y+=this.vy*dt;const g=this.w.ground(p.x,p.z,p.y);if(p.y<=g){p.y=g;this.vy=0;this.on=true}else if(p.y>g+.05)this.on=false;
  this.w.clamp?.(this);
  {const u=this.rag>0?ease(Math.min((this.rt-this.rag)/.3,this.rag/.4,1)):0,tt=this.rt-this.rag;
   this.cam.position.set(p.x,p.y+1.7-1.2*u+(this.on&&!u?Math.sin(this.bob)*.035:0),p.z);
   this.cam.rotation.set(this.pitch*(1-u)+u*.6,this.yaw,u*(1.2+.4*Math.sin(tt*6)))}}}

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

/* Pistolet à peinture (jeu 2) : silhouette extrudée, réservoir transparent, canon à manchon, viseur point rouge, gant + manche.
   Interface : {g, muzzle, anim(recul, flash, temps, fps, gâchette)} */
function paintGun(col){
 const g=new THREE.Group(),root=new THREE.Group(),C=COLN[col],P=Math.PI/2;g.add(root);
 const PM=o=>new THREE.MeshPhysicalMaterial(o),SM=o=>new THREE.MeshStandardMaterial(o),
 body=PM({color:0x20252b,metalness:.75,roughness:.3,clearcoat:.8,clearcoatRoughness:.18}),
 steel=SM({color:0xd3d9de,metalness:.95,roughness:.2}),
 rubber=SM({color:0x101215,roughness:.95}),
 paint=SM({color:C,emissive:C,emissiveIntensity:.35,roughness:.3,metalness:.2}),
 ledM=SM({color:C,emissive:C,emissiveIntensity:.6,roughness:.3}),
 glass=PM({color:0xffffff,transparent:true,opacity:.22,roughness:.03,clearcoat:1,depthWrite:false}),
 liq=PM({color:C,emissive:C,emissiveIntensity:.35,roughness:.18,clearcoat:1}),
 glove=SM({color:0x15181c,roughness:.85}),sleeve=SM({color:0x2c3644,roughness:.9}),
 sightGlass=new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}),
 add=(geo,mat,x,y,z,rx=0,ry=0,rz=0,p=root)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);p.add(m);return m},
 /* extrusion d'un profil latéral (x du profil = avant du pistolet, y = haut) */
 ext=(sh,d,b,mat,x=0,y=0,z=0,p=root)=>{const geo=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:3,curveSegments:12});geo.translate(0,0,-d/2);return add(geo,mat,x,y,z,0,P,0,p)};

 /* carcasse */
 const rs=new THREE.Shape();rs.moveTo(0,-.04);rs.quadraticCurveTo(-.02,.05,.08,.085);rs.lineTo(.36,.09);rs.quadraticCurveTo(.5,.095,.58,.06);rs.lineTo(.62,0);rs.quadraticCurveTo(.63,-.06,.56,-.075);rs.lineTo(.2,-.08);rs.quadraticCurveTo(.05,-.085,0,-.04);
 ext(rs,.07,.014,body);
 const ps=new THREE.Shape();ps.moveTo(.1,.045);ps.lineTo(.4,.06);ps.lineTo(.5,.025);ps.lineTo(.47,-.035);ps.lineTo(.14,-.045);ps.closePath();
 for(const s of[-1,1])ext(ps,.004,.005,paint,s*.0475);
 /* bandes lumineuses (pulsent au tir) */
 for(const s of[-1,1])add(new THREE.BoxGeometry(.004,.01,.22),ledM,s*.0555,-.02,-.29);

 /* poignée + sabots antidérapants */
 const gs=new THREE.Shape();gs.moveTo(.09,-.05);gs.lineTo(.29,-.05);gs.quadraticCurveTo(.26,-.17,.21,-.28);gs.quadraticCurveTo(.2,-.31,.17,-.31);gs.lineTo(.07,-.31);gs.quadraticCurveTo(.03,-.31,.04,-.27);gs.quadraticCurveTo(.07,-.15,.09,-.05);
 ext(gs,.05,.012,rubber);
 for(let k=0;k<5;k++){const t=.12+k*.17,xs=.29-.08*t*1.0-.005,y=-.05-.23*t;add(new THREE.BoxGeometry(.082,.006,.022),steel,0,y,-xs,.3,0,0)}
 add(new THREE.CylinderGeometry(.045,.04,.02,20),paint,0,-.315,-.12,0,0,0);

 /* pontet + détente */
 add(new THREE.TorusGeometry(.07,.008,8,24,Math.PI),steel,0,-.07,-.36,0,P,Math.PI);
 const trig=new THREE.Group();trig.position.set(0,-.07,-.34);root.add(trig);
 const ts=new THREE.Shape();ts.moveTo(.012,0);ts.lineTo(-.012,0);ts.quadraticCurveTo(-.012,-.04,-.03,-.065);ts.lineTo(-.012,-.075);ts.quadraticCurveTo(.012,-.04,.012,0);
 ext(ts,.014,.003,paint,0,0,0,trig);

 /* canon : tube, manchon nervuré, évents, bouche */
 const bar=new THREE.Group();bar.position.set(0,.03,0);root.add(bar);
 add(new THREE.CylinderGeometry(.016,.016,.8,16),steel,0,0,-.95,P,0,0,bar);
 add(new THREE.CylinderGeometry(.03,.034,.4,24),body,0,0,-.78,P,0,0,bar);
 for(let k=0;k<7;k++)add(new THREE.TorusGeometry(.0335,.0045,8,24),steel,0,0,-(.6+k*.055),0,0,0,bar);
 for(let k=0;k<5;k++)for(const a of[-1,1,3.14])add(new THREE.CapsuleGeometry(.006,.035,4,8),rubber,Math.sin(a)*.0315,Math.cos(a)*.0315,-(.65+k*.065),P,0,0,bar);
 add(new THREE.CylinderGeometry(.03,.027,.13,22),body,0,0,-1.26,P,0,0,bar);
 add(new THREE.TorusGeometry(.03,.007,8,22),paint,0,0,-1.31,0,0,0,bar);
 const bore=add(new THREE.CircleGeometry(.014,16),rubber,0,0,-1.328,0,Math.PI,0,bar);
 add(new THREE.CylinderGeometry(.004,.006,.035,8),steel,0,.047,-1.24,0,0,0,bar);

 /* pompe coulissante (recule au tir) */
 const slide=new THREE.Group();slide.position.set(0,.03,0);root.add(slide);
 add(new THREE.CylinderGeometry(.042,.042,.16,26),body,0,0,-.8,P,0,0,slide);
 for(let k=0;k<5;k++)add(new THREE.TorusGeometry(.0435,.006,8,26),rubber,0,0,-(.74+k*.03),0,0,0,slide);
 add(new THREE.TorusGeometry(.043,.005,8,26),paint,0,0,-.715,0,0,0,slide);add(new THREE.TorusGeometry(.043,.005,8,26),paint,0,0,-.885,0,0,0,slide);

 /* bouteille d'air sous le canon */
 add(new THREE.CapsuleGeometry(.032,.34,6,16),body,0,-.118,-.66,P,0,0);
 add(new THREE.TorusGeometry(.0335,.0065,8,22),paint,0,-.118,-.53,0,0,0);add(new THREE.TorusGeometry(.0335,.0065,8,22),paint,0,-.118,-.8,0,0,0);
 add(new THREE.CylinderGeometry(.012,.012,.04,10),steel,0,-.118,-.9,P,0,0);

 /* réservoir de peinture transparent */
 const tk=new THREE.Group();tk.position.set(0,0,-.2);root.add(tk);
 add(new THREE.CylinderGeometry(.03,.04,.05,20),body,0,.11,0,0,0,0,tk);
 add(new THREE.TorusGeometry(.043,.007,8,22),steel,0,.135,0,P,0,0,tk);
 add(new THREE.CapsuleGeometry(.07,.11,8,22),glass,0,.25,0,0,0,0,tk);
 const lq=add(new THREE.CapsuleGeometry(.058,.06,8,20),liq,0,.22,0,0,0,0,tk);
 add(new THREE.CylinderGeometry(.034,.034,.025,20),steel,0,.385,0,0,0,0,tk);
 add(new THREE.TorusGeometry(.035,.006,8,20),paint,0,.372,0,P,0,0,tk);

 /* rail + viseur point rouge */
 add(new THREE.BoxGeometry(.03,.012,.2),body,0,.094,-.52);
 add(new THREE.BoxGeometry(.034,.012,.07),body,0,.104,-.5);
 for(const s of[-1,1])add(new THREE.BoxGeometry(.008,.04,.01),body,s*.028,.125,-.5);
 add(new THREE.TorusGeometry(.032,.005,8,24),body,0,.15,-.5);
 add(new THREE.CircleGeometry(.029,22),sightGlass,0,.15,-.5);
 add(new THREE.SphereGeometry(.004,8,6),new THREE.MeshBasicMaterial({color:0xff2030}),0,.15,-.497);

 /* main gantée + avant-bras */
 const palm=add(new THREE.SphereGeometry(1,16,12),glove,.068,-.15,-.1);palm.scale.set(.032,.07,.045);
 for(let k=0;k<4;k++){const y=-.11-k*.04;add(new THREE.CapsuleGeometry(.014,.08,4,8),glove,.012,y,-(.281-k*.014),0,0,P)}
 add(new THREE.CapsuleGeometry(.014,.1,4,8),glove,.068,-.045,-.12,P,0,0);
 const a0=V3(.07,-.17,-.07),a1=V3(.2,-.5,.6);
 root.add(rod(a0,a1,.042,sleeve));root.add(rod(a0.clone().lerp(a1,.1),a0.clone().lerp(a1,.2),.048,paint));

 /* bouche de tir + éclair */
 const flash=new THREE.Group();flash.position.set(0,.03,-1.36);root.add(flash);flash.visible=false;
 add(new THREE.SphereGeometry(.07,12,10),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.85}),0,0,-.03,0,0,0,flash);
 add(new THREE.ConeGeometry(.06,.3,14,1,true),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}),0,0,-.2,P,0,0,flash);

 root.position.set(.24,-.2,-.62);root.rotation.set(.03,.04,0);
 const mzO=new THREE.Object3D();mzO.position.set(0,.03,-1.36);root.add(mzO);g.updateMatrixWorld(true);const muzzle=g.worldToLocal(mzO.getWorldPosition(V3(0,0,0)));
 g.traverse(o=>{o.castShadow=false});

 /* animation : recul + remontée, pompe, détente, clapotis du réservoir, balancement de marche */
 const anim=(r,fl,t,fps,held)=>{
  const mv=Math.min(1,Math.hypot(fps.v.x,fps.v.y)/fps.spd),ph=fps.bob*.5,pull=Math.min(1,Math.max(r*2.4,held?.85:0));
  root.position.set(.24+Math.sin(ph)*.009*mv,-.2-Math.abs(Math.sin(ph))*.01*mv+Math.sin(t*1.7)*.0025,-.62+r*.13);
  root.rotation.set(.03+r*.13,.04+Math.sin(ph)*.01*mv,r*.015);
  slide.position.z=Math.min(1,r*1.6)*.1;bar.position.z=r*.025;trig.rotation.x=-pull*.45;
  lq.scale.set(1+r*.1,1-r*.06,1+r*.1);lq.rotation.z=Math.sin(t*10)*r*.15;
  ledM.emissiveIntensity=.5+fl*2.2;flash.visible=fl>0;flash.scale.setScalar(.7+fl*.9)};
 return{g,muzzle,anim}}

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
 total(){return this.m.n+this.lq+this.drones.reduce((a,d)=>a+d.rem,0)}
 reset(){this.lq=0;this.m.n=0;this.drones.forEach(d=>this.scene.remove(d.g));this.drones=[];for(let i=0;i<1500;i++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*12,x=Math.cos(a)*r,z=Math.sin(a)*r;this.m.add(x,H(x,z)+rnd(.3,2.5),z)}this.peak=this.total()}
 complete(){return this.total()===0}
 progress(){return this.peak?1-this.total()/this.peak:0}
 label(){return `${this.total().toLocaleString('fr-FR')} billes restantes`}
 gift(g,qty,name){const d=(g.m||0)*qty;if(!d)return;
  if(d>0){this.makeDrone(name,d);this.peak=Math.max(this.peak,this.total())}
  else{let k=-d;const a=Math.min(k,this.m.n);this.m.n-=a;k-=a;for(const x of this.drones){const b=Math.min(k,x.rem);x.rem-=b;k-=b}}}
 like(n){this.lq+=n;this.peak=Math.max(this.peak,this.total())}
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
  if(this.lq>0){const k=Math.min(this.lq,Math.max(200,Math.ceil(this.lq*dt*2)));for(let i=0;i<k;i++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*12,x=Math.cos(a)*r,z=Math.sin(a)*r;if(!this.m.add(x,H(x,z)+rnd(8,14),z))break;this.lq--}this.peak=Math.max(this.peak,this.total())}
 this.drones.forEach(x=>this.updDrone(x,dt));this.drones=this.drones.filter(x=>!x.dead);this.m.step(Math.min(dt,1/30));this.parts.update(dt)}
 dispose(){Snd.vac(false);disposeScene(this.scene)}}

/* ================= JEU 2 : la bataille de peinture ================= */
const PX=8,AX=45,AZ=35;
/* Réglages du pistolet à peinture : pellets=billes de peinture par tir, spread=dispersion, rate=ms entre deux tirs,
   speed=vitesse des projectiles, grav=chute, R=rayon de la flaque principale (en mètres) */
const PAINT={pellets:8,spread:3,rate:110,speed:42,grav:3.5,R:4.4};
class Panel{
 constructor(w,h,pos,ry,rx,color,owner){this.owner=owner;this.color=color;this.nx=Math.max(2,Math.round(w/.6));this.ny=Math.max(2,Math.round(h/.6));this.cv=document.createElement('canvas');this.cv.width=this.nx*PX;this.cv.height=this.ny*PX;this.cx=this.cv.getContext('2d');
  this.tex=new THREE.CanvasTexture(this.cv);this.tex.colorSpace=THREE.SRGBColorSpace;this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:this.tex,roughness:.7,side:THREE.DoubleSide}));
  this.mesh.position.copy(pos);this.mesh.rotation.set(rx,ry,0);this.mesh.receiveShadow=this.mesh.castShadow=true;this.mesh.updateMatrixWorld(true);this.rad=Math.hypot(w,h)/2+.1;this.c=V3(0,0,0);this.mesh.getWorldPosition(this.c);
  this.n=V3(0,0,1).transformDirection(this.mesh.matrixWorld);this.ca=(w/this.nx)*(h/this.ny);
  const N=this.nx*this.ny;this.st=new Uint8Array(N);this.act=new Uint8Array(N).fill(1);this.ct=new Float32Array(N*3);const v=V3(0,0,0);
  for(let y=0;y<this.ny;y++)for(let x=0;x<this.nx;x++){v.set(((x+.5)/this.nx-.5)*w,((y+.5)/this.ny-.5)*h,0);this.mesh.localToWorld(v);this.ct.set([v.x,v.y,v.z],(y*this.nx+x)*3)}this.clear()}
 clear(){this.st.fill(0);this.cx.fillStyle=this.color;this.cx.fillRect(0,0,this.cv.width,this.cv.height);this.tex.needsUpdate=true}
 cell(i,col){this.st[i]=col;const x=i%this.nx,y=(i/this.nx)|0,c=this.cx,px=(x+.5)*PX,py=(this.ny-1-y+.5)*PX;c.fillStyle=COLH[col];
  c.beginPath();c.arc(px+rnd(-1.5,1.5),py+rnd(-1.5,1.5),PX*rnd(.85,1.2),0,6.3);c.fill();
  if(Math.random()<.3){c.beginPath();c.arc(px+rnd(-PX*1.4,PX*1.4),py+rnd(-PX*1.4,PX*1.4),PX*rnd(.2,.4),0,6.3);c.fill()}this.dirty=true}}

class Paint{
 constructor(col){const q=this.q=QUAL[S.q];this.col=col;this.scene=baseScene(q,0xb8d4e8,60);this.cam=new THREE.PerspectiveCamera(75,1,.05,500);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt*4);this.panels=[];this.blocks=[];this.bombs=[];this.shots=[];this.fx=[];this.qa=0;this.qr=0;this.acc=0;this.last=0;this.rec=0;this.sc=0;this.ls=0;
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
  this.vm=paintGun(col);this.cam.add(this.vm.g);this.parts.o.material.size=.5;this.fl=0;
  this.bg=new THREE.SphereGeometry(.38,14,10);this.shotG=new THREE.SphereGeometry(.2,10,8);this.shotM=new THREE.MeshStandardMaterial({color:COLN[col],emissive:COLN[col],emissiveIntensity:.8,roughness:.3});this.sg=new THREE.SphereGeometry(1,16,12);
  this.fps=new FPS(this.cam,-40,0,0,-Math.PI/2,{
   block:(nx,nz,y)=>Math.abs(nx)>AX-.4||Math.abs(nz)>AZ-.4||this.blocks.some(b=>nx>b.x0-.35&&nx<b.x1+.35&&nz>b.z0-.35&&nz<b.z1+.35&&y<b.y1-.25&&y+1.8>b.y0),
   ground:(x,z,y)=>{let g=0;for(const b of this.blocks)if(x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2&&b.y1<=y+.4&&b.y1>g)g=b.y1;return g},
   clamp:f=>{const p=f.p;p.x=clamp(p.x,-AX+.5,AX-.5);p.z=clamp(p.z,-AZ+.5,AZ-.5);if(p.y<0){p.y=0;f.vy=0}if(p.y>40){p.y=40;f.vy=Math.min(0,f.vy)}
    for(const b of this.blocks)if(p.x>b.x0-.3&&p.x<b.x1+.3&&p.z>b.z0-.3&&p.z<b.z1+.3&&p.y<b.y1-.3&&p.y+1.8>b.y0){p.y=b.y1;f.vy=0}}});Object.assign(this.fps,{spd:15,ac:30,gv:30,jp:11});this.reset()}
 pan(w,h,p,ry,rx,color,o=null){const a=new Panel(w,h,V3(...p),ry,rx,color,o);this.panels.push(a);this.scene.add(a.mesh)}
 addBlock(w,h,d,x,z,y0,c){const b={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0,y1:y0+h},yc=y0+h/2,P=Math.PI;this.blocks.push(b);
  this.pan(w,h,[x,yc,z+d/2],0,0,c,b);this.pan(w,h,[x,yc,z-d/2],P,0,c,b);this.pan(d,h,[x+w/2,yc,z],P/2,0,c,b);this.pan(d,h,[x-w/2,yc,z],-P/2,0,c,b);this.pan(w,d,[x,y0+h+.005,z],0,-P/2,c,b)}
 reset(){this.panels.forEach(p=>p.clear());[...this.bombs,...this.shots,...this.fx].forEach(o=>this.scene.remove(o.m));this.bombs=[];this.shots=[];this.fx=[];this.qa=this.qr=0;this.st0=this.stats()}
 /* surfaces pondérées par l'aire réelle de chaque case (t/p = aire totale/peinte, tc/pc = nombre de cases) */
 stats(){let t=0,p=0,tc=0,pc=0;for(const a of this.panels){let n=0,m=0;for(let i=0;i<a.st.length;i++)if(a.act[i]){n++;if(a.st[i]===this.col)m++}t+=n*a.ca;p+=m*a.ca;tc+=n;pc+=m}return{t,p,tc,pc}}
 progress(){return this.st0.t?this.st0.p/this.st0.t:0}
 /* victoire atteignable : à 99,6 % des cases, les dernières cases oubliées sont complétées (progression = 100 %) */
 complete(){const s=this.st0;if(s.tc>0&&s.pc>=s.tc*.996){if(s.pc<s.tc){this.fillAll();this.st0=this.stats()}return true}return false}
 fillAll(){for(const a of this.panels)for(let i=0;i<a.st.length;i++)if(a.act[i]&&a.st[i]!==this.col)a.cell(i,this.col)}
 label(){return `${(this.progress()*100).toFixed(1)} % peint`}
 gift(g,qty){const n=(g.k||0)*qty;if(g.red)this.qr+=n;else this.qa+=n}
 like(n){this.qr+=n}
 splat(pt,R,col,jit){for(const a of this.panels){if(a.c.distanceTo(pt)>R+a.rad)continue;for(let i=0;i<a.st.length;i++){if(!a.act[i]||a.st[i]===col)continue;const dx=a.ct[i*3]-pt.x,dy=a.ct[i*3+1]-pt.y,dz=a.ct[i*3+2]-pt.z,r=R*(1-jit*Math.random());if(dx*dx+dy*dy+dz*dz<r*r)a.cell(i,col)}}}
 /* peint une liste de flaques {p:centre,r:rayon} ; une flaque ne couvre que les faces tournées vers elle (pas de peinture derrière un mur fin) */
 paintBlobs(bl,col,jit){for(const a of this.panels){const ok=[];for(const b of bl){const R=b.r+a.rad;if(a.c.distanceToSquared(b.p)>R*R)continue;
   if(a.n.x*(b.p.x-a.c.x)+a.n.y*(b.p.y-a.c.y)+a.n.z*(b.p.z-a.c.z)>-.25)ok.push(b)}
  if(!ok.length)continue;
  for(let i=0;i<a.st.length;i++){if(!a.act[i]||a.st[i]===col)continue;const x=a.ct[i*3],y=a.ct[i*3+1],z=a.ct[i*3+2];
   for(const b of ok){const dx=x-b.p.x,dy=y-b.p.y,dz=z-b.p.z,r=b.r*(1-jit*Math.random());if(dx*dx+dy*dy+dz*dz<r*r){a.cell(i,col);break}}}}}
 /* impact d'un tir : grosse flaque + éclaboussures satellites + gouttelettes + traînée dans le sens du tir + coulures sur les murs */
 impact(h,dir){const q=h.point,n=h.face.normal.clone().transformDirection(h.object.matrixWorld);if(n.dot(dir)>0)n.negate();
  const ref=Math.abs(n.y)>.95?V3(1,0,0):V3(0,1,0),t1=ref.cross(n).normalize(),t2=n.clone().cross(t1).normalize(),bl=[{p:q.clone(),r:PAINT.R}];
  const on=(a,d,r)=>bl.push({p:q.clone().addScaledVector(t1,Math.cos(a)*d).addScaledVector(t2,Math.sin(a)*d),r});
  for(let k=0;k<12;k++)on(rnd(0,6.283),rnd(2,6.5),rnd(1,2.3));
  for(let k=0;k<12;k++)on(rnd(0,6.283),rnd(3,8),rnd(.35,.8));
  const sl=dir.clone().addScaledVector(n,-dir.dot(n));if(sl.lengthSq()>1e-4){sl.normalize();for(const[d,r]of[[1.6,1.8],[3.2,1.2],[4.6,.7]])bl.push({p:q.clone().addScaledVector(sl,d),r})}
  if(Math.abs(n.y)<.5)for(let k=0;k<4;k++)bl.push({p:q.clone().addScaledVector(t1,rnd(-.4,.4)).add(V3(0,-(2.6+k*1.3),0)),r:rnd(.4,.6)});
  this.paintBlobs(bl,this.col,.4);
  this.parts.emit(q.x+n.x*.2,q.y+n.y*.2,q.z+n.z*.2,COLN[this.col],50,6.5,2.2);
  const now=performance.now();if(now-this.ls>80){this.ls=now;Snd.noise(.14,.25,1400)}}
 spawnBomb(col){let x,z,y=0,t=0;if(Math.random()<.4){const b=this.blocks[(Math.random()*this.blocks.length)|0];x=rnd(b.x0,b.x1);z=rnd(b.z0,b.z1);y=b.y1;for(const o of this.blocks)if(x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&o.y1>y)y=o.y1}
  else do{x=rnd(-AX+2,AX-2);z=rnd(-AZ+2,AZ-2)}while(this.blocks.some(b=>x>b.x0-1&&x<b.x1+1&&z>b.z0-1&&z<b.z1+1)&&++t<20);
  const m=mk(this.bg,COLN[col],x,y+25,z,{e:COLN[col],r:.3});m.add(mk(new THREE.CylinderGeometry(.06,.06,.4,6),0xffffff,0,.5,0));this.scene.add(m);this.bombs.push({m,col,y:y+25,gy:y+.4,vy:0,s:0,t:0,f:rnd(.7,1.5)})}
 explode(b){const p=b.m.position;this.splat(p,4.5,b.col,.35);this.parts.emit(p.x,p.y+.5,p.z,COLN[b.col],70,8,3);Snd.boom();
  const m=new THREE.Mesh(this.sg,new THREE.MeshBasicMaterial({color:COLN[b.col],transparent:true,opacity:.5}));m.position.copy(p);this.scene.add(m);this.fx.push({m,t:0});this.scene.remove(b.m);b.dead=true}
 fire(){const mz=this.vm.muzzle.clone();this.cam.localToWorld(mz);const fw=this.cam.getWorldDirection(V3(0,0,0)),rt=V3(0,0,0).setFromMatrixColumn(this.cam.matrixWorld,0),up=V3(0,0,0).setFromMatrixColumn(this.cam.matrixWorld,1);
  for(let i=0;i<PAINT.pellets;i++){const sp=i?PAINT.spread:0,tg=this.cam.position.clone().addScaledVector(fw,40).addScaledVector(rt,rnd(-sp,sp)).addScaledVector(up,rnd(-sp,sp)),v=tg.sub(mz).normalize().multiplyScalar(PAINT.speed*rnd(.92,1.05));
   const m=new THREE.Mesh(this.shotG,this.shotM);m.position.copy(mz);m.scale.setScalar(rnd(.8,1.5));this.scene.add(m);this.shots.push({m,v,t:0})}
  Snd.pop();Snd.noise(.09,.35,2600);this.parts.emit(mz.x,mz.y,mz.z,COLN[this.col],40,5,1);this.rec=1;this.fl=1}
 update(dt){this.fps.update(dt);this.cam.updateMatrixWorld(true);const now=performance.now(),held=M.down&&App.locked&&!App.paused;
  this.vm.anim(this.rec,this.fl,now/1e3,this.fps,held);this.rec=Math.max(0,this.rec-dt*8);this.fl=Math.max(0,this.fl-dt*14);
  if(held&&now-this.last>PAINT.rate){this.last=now;this.fire()}
  const pend=this.qa+this.qr;if(pend>0&&this.bombs.length<90){this.acc+=dt*Math.max(5,pend/6);while(this.acc>=1&&this.qa+this.qr>0&&this.bombs.length<90){this.acc--;const red=Math.random()*(this.qa+this.qr)<this.qr;if(red)this.qr--;else this.qa--;this.spawnBomb(red?3:this.col)}}
  for(const b of this.bombs){if(b.s===0){b.vy-=16*dt;b.y+=b.vy*dt;if(b.y<=b.gy){b.y=b.gy;b.s=1}b.m.position.y=b.y}else{b.t+=dt;b.m.scale.setScalar(1+.15*Math.sin(b.t*28));if(b.t>b.f)this.explode(b)}}this.bombs=this.bombs.filter(b=>!b.dead);
  for(const s of this.shots){const pv=s.m.position.clone();s.v.y-=PAINT.grav*dt;s.m.position.addScaledVector(s.v,dt);s.t+=dt;
   const d=s.m.position.clone().sub(pv),L=d.length();if(L>0)d.divideScalar(L);
   /* on ne teste que les panneaux proches du segment parcouru (beaucoup plus léger avec de nombreux projectiles) */
   const mid=pv.clone().addScaledVector(d,L/2),cand=[];for(const p of this.panels){const R=L/2+p.rad;if(p.c.distanceToSquared(mid)<R*R)cand.push(p.mesh)}
   rc.set(pv,d);rc.far=L;const r=cand.length?rc.intersectObjects(cand,false):[];rc.far=Infinity;
   this.parts.emit(pv.x,pv.y,pv.z,COLN[this.col],3,.6);
   if(r.length){this.impact(r[0],d);s.dead=true}else if(s.t>5)s.dead=true;if(s.dead)this.scene.remove(s.m)}this.shots=this.shots.filter(s=>!s.dead);
  for(const f of this.fx){f.t+=dt;f.m.scale.setScalar(.3+f.t*13);f.m.material.opacity=Math.max(0,.5-f.t*1.6);if(f.t>.35){f.dead=true;this.scene.remove(f.m)}}this.fx=this.fx.filter(f=>!f.dead);
  this.panels.forEach(p=>{if(p.dirty){p.tex.needsUpdate=true;p.dirty=false}});if(++this.sc%6===0)this.st0=this.stats();this.parts.update(dt)}
 dispose(){this.panels.forEach(p=>p.tex.dispose());disposeScene(this.scene)}}

/* ================= JEU 3 : la rampe aux fruits ================= */
const RW=13.6,RL=330,RZ0=12,RFIN=300;
const RP=[[0,0],[30,0],[60,12],[85,12],[125,34],[150,34],[200,62],[225,62],[270,86],[RL,86]];
const rh=z=>{const s=clamp(RZ0-z,0,RL);for(let i=1;i<RP.length;i++)if(s<=RP[i][0]){const a=RP[i-1],b=RP[i];return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0])}return 86};
const FRUITS=[
 {n:'Pomme',c:0xe02020,s:[.42,.4,.42],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Orange',c:0xff8a00,s:[.45,.45,.45],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Citron',c:0xffe135,s:[.5,.34,.34],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Pastèque',c:0x2e9e3a,s:[.8,.6,.6],g:()=>new THREE.SphereGeometry(1,14,10)},
 {n:'Banane',c:0xffd83a,s:[.45,.45,.45],g:()=>new THREE.TorusGeometry(1,.22,8,16,2.3)},
 {n:'Fraise',c:0xd8152f,s:[.28,.3,.28],g:()=>new THREE.ConeGeometry(1,2,12)}];
const finTex=()=>{const c=document.createElement('canvas');c.width=256;c.height=32;const x=c.getContext('2d');for(let i=0;i<32;i++)for(let j=0;j<4;j++){x.fillStyle=(i+j)%2?'#fff':'#111';x.fillRect(i*8,j*8,8,8)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};
const bannerTex=()=>{const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='#ffc83d';x.fillRect(0,0,512,96);x.fillStyle='#111';x.font='bold 72px Sora,Arial';x.textAlign='center';x.fillText('ARRIVÉE',256,72);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};

/* Personnage 3e personne : 15 points (squelette), os = cylindres, contraintes de distance (ragdoll Verlet) */
const CB=[[0,1.68,0],[0,1.48,0],[0,.98,0],[-.27,1.42,0],[.27,1.42,0],[-.33,1.12,0],[.33,1.12,0],[-.35,.85,0],[.35,.85,0],[-.13,.92,0],[.13,.92,0],[-.13,.5,0],[.13,.5,0],[-.13,.05,0],[.13,.05,0]];
const CN=[[0,1,.09,0xe0a97c],[1,2,.14,0x2f7bff],[3,4,.06,0x2f7bff],[1,3,.07,0x2f7bff],[1,4,.07,0x2f7bff],[3,5,.06,0x2f7bff],[5,7,.055,0xe0a97c],[4,6,.06,0x2f7bff],[6,8,.055,0xe0a97c],[2,9,.08,0x23304a],[2,10,.08,0x23304a],[9,10,.07,0x23304a],[9,11,.08,0x23304a],[11,13,.07,0x23304a],[10,12,.08,0x23304a],[12,14,.07,0x23304a]];
const CX=[[3,10],[4,9],[1,9],[1,10],[0,2],[3,2],[4,2]];
class Ramp{
 constructor(){const q=this.q=QUAL[S.q];this.scene=baseScene(q,0x9fd4f0,170);this.cam=new THREE.PerspectiveCamera(75,1,.05,700);this.scene.add(this.cam);
  this.parts=new Particles(this.scene,q.pt*2);this.parts.o.material.size=.45;this.f=[];this.qn=0;this.acc=0;this.pq=0;this.pu=null;this.boxes=[];
  const gp=new THREE.PlaneGeometry(2*RW+2,RL+20,14,(RL+20)/2);gp.rotateX(-Math.PI/2);const p=gp.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const z=p.getZ(i)-153;p.setZ(i,z);p.setY(i,rh(z));const b=Math.floor((RZ0-z)/10)%2;c.setRGB(b?.78:.68,b?.74:.64,b?.62:.55);col.set([c.r,c.g,c.b],i*3)}
  gp.setAttribute('color',new THREE.BufferAttribute(col,3));gp.computeVertexNormals();const t=new THREE.Mesh(gp,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));t.receiveShadow=true;this.scene.add(t);
  const far=mk(new THREE.PlaneGeometry(1200,1200),0x6f9a58,0,-3,-150);far.rotation.x=-Math.PI/2;this.scene.add(far);
  for(let s=20;s<=RL;s+=45){const h=rh(RZ0-s);for(const sx of[-1,1])this.scene.add(box(3,h+3,3,sx*(RW+.5),(h-3)/2,RZ0-s,0x8a8f94))}
  for(let s=0;s<RL;s+=10){const h0=rh(RZ0-s),h1=rh(RZ0-s-10);for(const sx of[-1,1]){const m=box(.6,1.6,10.2,sx*(RW+.3),(h0+h1)/2+.8,RZ0-s-5,0xd04a3a);m.rotation.x=Math.atan2(h1-h0,10);this.scene.add(m)}}
  let sd=7;const R=()=>(sd=(sd*16807)%2147483647)/2147483647,pal=[0x8aa08f,0xc9b79c,0x9fb1c1,0xd8c3c3,0xe3c88a];
  const addB=(x,s,w,d,hg,cl)=>{const zc=RZ0-s,z0=zc-d/2,z1=zc+d/2,yt=rh(z0)+hg,yb=rh(z1)-.3;this.scene.add(box(w,yt-yb,d,x,(yt+yb)/2,zc,cl));this.boxes.push({x0:x-w/2,x1:x+w/2,z0,z1,y1:yt})};
  for(let s=24;s<RFIN-10;s+=9){const wx=(R()-.5)*2*(RW-6);if(R()<.6)addB(wx,s,6+R()*4,.8,1.8,pal[(s/9|0)%5]);if(R()<.45){let x=(R()-.5)*2*(RW-3);if(Math.abs(x-wx)<6)x=-Math.sign(wx||1)*(RW-3);addB(x,s+3,3,3,2.2,0x6f7c8a)}}
  const fz=RZ0-RFIN;for(const sx of[-1,1])this.scene.add(box(1,9,1,sx*(RW-.5),90.5,fz,0xffffff));
  const bn=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,2.6),new THREE.MeshBasicMaterial({map:bannerTex(),side:THREE.DoubleSide}));bn.position.set(0,95.2,fz);this.scene.add(bn);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,2),new THREE.MeshBasicMaterial({map:finTex()}));fl.rotation.x=-Math.PI/2;fl.position.set(0,86.05,fz);this.scene.add(fl);
  const zn=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,RL-RFIN),new THREE.MeshBasicMaterial({color:0x2ed36a,transparent:true,opacity:.35}));zn.rotation.x=-Math.PI/2;zn.position.set(0,86.04,fz-(RL-RFIN)/2);this.scene.add(zn);
  this.im=FRUITS.map(d=>{const m=new THREE.InstancedMesh(d.g(),new THREE.MeshStandardMaterial({color:d.c,roughness:.45}),600);m.frustumCulled=false;m.count=0;this.scene.add(m);return m});this.dm=new THREE.Object3D();
  const gl=this.gl=new THREE.Group(),rm=new THREE.MeshStandardMaterial({color:0xd01f2b,roughness:.4}),wm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6}),sk=new THREE.MeshStandardMaterial({color:0xe0a97c,roughness:.7}),P2=Math.PI/2;
  const fist=new THREE.Mesh(new THREE.SphereGeometry(.6,18,14),rm);fist.scale.set(1,.9,1.1);gl.add(fist);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.6,16),wm);cuff.rotation.x=P2;cuff.position.z=-.8;gl.add(cuff);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,4,12),sk);arm.rotation.x=P2;arm.position.z=-3.1;gl.add(arm);gl.visible=false;this.scene.add(gl);
  const bx=this.boxes;
  this.fps=new FPS(this.cam,0,0,RZ0-3,0,{bx,
   block:(nx,nz,y)=>Math.abs(nx)>RW-.2||nz>RZ0-.5||nz<RZ0-RL+1||bx.some(b=>nx>b.x0-.35&&nx<b.x1+.35&&nz>b.z0-.35&&nz<b.z1+.35&&y<b.y1-.3),
   ground:(x,z,y)=>{let g=rh(z);for(const b of bx)if(x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2&&b.y1<=y+.45&&b.y1>g)g=b.y1;return g}});
  this.buildChar();this.reset()}
 reset(){const f=this.fps;this.rag=this.inv=0;this.face=0;this.ph=0;f.p.set(0,0,RZ0-3);f.yaw=0;f.pitch=.3;f.rag=f.inv=f.kx=f.kz=0;f.v.set(0,0);f.vy=0;this.f.length=0;this.qn=0;this.pq=0;this.pu=null;this.gl.visible=false}
 complete(){const z=this.rag>0?this.P[2].z:this.fps.p.z;return z<RZ0-RFIN&&z>RZ0-RL}
 progress(){return clamp((RZ0-this.fps.p.z)/RFIN,0,1)}
 label(){return `Rampe : ${Math.round(this.progress()*100)} % · ${this.f.length+this.qn} fruits`}
 gift(g,qty){this.qn+=(g.k||0)*qty*5}
 like(n){this.qn+=n}
 follow(){this.pq++}
 spawn(){const p=this.fps.p,t=(Math.random()*FRUITS.length)|0,d=FRUITS[t],near=Math.random()<.5,
  x=clamp(near?p.x+rnd(-3,3):p.x+rnd(-12,12),-RW+1,RW-1),z=clamp(p.z+(near?rnd(-14,-2):rnd(-24,3)),RZ0-RL+3,RZ0-3);
  if(this.f.length>=1800)this.f.shift();this.f.push({age:0,t,x,y:rh(z)+rnd(14,30),z,vx:rnd(-1,1),vy:0,vz:rnd(0,3),r:Math.max(...d.s),a:rnd(0,6),b:rnd(0,6)})}
 hit(o){const f=this.fps;this.startRag(5,o.vx*.6,4,o.vz*.6)
  this.parts.emit(o.x,o.y,o.z,FRUITS[o.t].c,30,5,2);Snd.pop();ev('🍎 Touché ! ragdoll 5 s')}
 fruit(dt){const p=this.fps.p,w=this.fps.w,L=this.f;
  for(let i=L.length-1;i>=0;i--){const o=L[i];if((o.age+=dt)>=10){L.splice(i,1);continue}o.vy-=22*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.z+=o.vz*dt;
   if(Math.abs(o.x)>RW-.3){o.x=clamp(o.x,-RW+.3,RW-.3);o.vx*=-.5}
   for(const b of this.boxes)if(o.x>b.x0&&o.x<b.x1&&o.z>b.z0&&o.z<b.z1&&o.y<b.y1-.3){const a=o.x-b.x0,c=b.x1-o.x,d=o.z-b.z0,e=b.z1-o.z,m=Math.min(a,c,d,e);
    if(m===a){o.x=b.x0;o.vx=-Math.abs(o.vx)*.4}else if(m===c){o.x=b.x1;o.vx=Math.abs(o.vx)*.4}else if(m===d){o.z=b.z0;o.vz=-Math.abs(o.vz)*.4}else{o.z=b.z1;o.vz=Math.abs(o.vz)*.4}}
   const g=w.ground(o.x,o.z,o.y)+o.r*.8;
   if(o.y<g){o.y=g;const sl=(rh(o.z+.1)-rh(o.z-.1))/.2,l=Math.hypot(1,sl),ny=1/l,nz=-sl/l,vn=o.vy*ny+o.vz*nz;if(vn<0){o.vy-=ny*vn*1.45;o.vz-=nz*vn*1.45}o.vx*=1-.6*dt;o.vz*=1-.15*dt}
   o.a+=o.vz*dt*2;o.b+=o.vx*dt*2;
   if(o.z>RZ0-1||o.y<-5){L.splice(i,1);continue}
   const dx=o.x-p.x,dz=o.z-p.z,dy=o.y-(p.y+.9);
   if(dx*dx+dz*dz<(.5+o.r)**2&&Math.abs(dy)<1+o.r&&this.inv<=0&&this.rag<=0){this.hit(o);L.splice(i,1)}}
  const cnt=FRUITS.map(()=>0),D=this.dm;
  for(const o of L){const k=cnt[o.t];if(k>=600)continue;cnt[o.t]++;D.position.set(o.x,o.y,o.z);D.rotation.set(o.a,o.b,0);D.scale.set(...FRUITS[o.t].s);D.updateMatrix();this.im[o.t].setMatrixAt(k,D.matrix)}
  this.im.forEach((m,i)=>{m.count=cnt[i];m.instanceMatrix.needsUpdate=true})}
 punchStep(dt){const f=this.fps,G=this.gl;
  if(!this.pu){if(this.pq>0){this.pq--;this.pu={t:0,hit:false};G.visible=true;Snd.tone(300,90,.25,'sawtooth',.4)}else return}
  const u=this.pu,p=f.p,y=f.yaw,fx=-Math.sin(y),fz=-Math.cos(y);u.t+=dt;
  const d=u.t<.3?5-3.9*ease(u.t/.3):1.1+3.9*ease((u.t-.3)/.3);
  G.position.set(p.x+fx*d,p.y+1.2,p.z+fz*d);G.rotation.set(0,y,0);
  if(!u.hit&&u.t>=.3){u.hit=true;this.startRag(2,-fx*17,4,-fz*17,true);Snd.boom();this.parts.emit(p.x+fx,p.y+1.2,p.z+fz,0xffffff,40,7,1);ev('👊 Coup de poing ! ragdoll 2 s')}
  if(u.t>.6){this.pu=null;G.visible=false}}
 update(dt){this.char(dt);this.cam.updateMatrixWorld(true);
  if(this.qn>0){this.acc+=dt*Math.max(60,this.qn/4);while(this.acc>=1&&this.qn>0){this.acc--;this.qn--;this.spawn()}}
  this.fruit(dt);this.punchStep(dt);this.parts.update(dt)}
 buildChar(){this.P=CB.map(b=>V3(...b));this.Q=this.P.map(p=>p.clone());this.cs=[...CN.map(b=>[b[0],b[1]]),...CX].map(([a,b])=>[a,b,V3(...CB[a]).distanceTo(V3(...CB[b]))]);
  const cy=new THREE.CylinderGeometry(1,1,1,10);this.bm=CN.map(b=>{const m=new THREE.Mesh(cy,new THREE.MeshStandardMaterial({color:b[3],roughness:.7}));m.castShadow=true;this.scene.add(m);return m});
  this.hd=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),new THREE.MeshStandardMaterial({color:0xe0a97c,roughness:.7}));this.hd.castShadow=true;this.scene.add(this.hd);this.face=0;this.ph=0;this.rag=this.inv=0;this.acc2=0}
 /* pose debout animée (marche / saut), dans le repère du personnage */
 pose(){const f=this.fps,s=Math.sin(this.face),c=Math.cos(this.face),am=Math.min(1,Math.hypot(f.v.x,f.v.y)/6.5),ph=this.ph,air=!f.on;
  CB.forEach((b,i)=>{let lx=b[0],ly=b[1],lz=b[2];
   if(i===11||i===13)lz+=Math.sin(ph)*(i===11?.2:.38)*am;if(i===12||i===14)lz-=Math.sin(ph)*(i===12?.2:.38)*am;
   if(i===13)ly+=Math.max(0,Math.cos(ph))*.14*am;if(i===14)ly+=Math.max(0,-Math.cos(ph))*.14*am;
   if(i===5||i===7)lz-=Math.sin(ph)*(i===5?.15:.3)*am;if(i===6||i===8)lz+=Math.sin(ph)*(i===6?.15:.3)*am;
   if(air&&i>10){lz+=i%2?.18:-.1;ly+=.12}
   this.P[i].set(f.p.x+c*lx-s*lz,f.p.y+ly,f.p.z-s*lx-c*lz)})}
 /* ragdoll : le corps garde la vitesse du joueur + l'impulsion, puis la physique (gravité, pente, obstacles, frottement) fait tout */
 startRag(sec,vx,vy,vz,force){if(this.rag>0||(!force&&this.inv>0))return false;const f=this.fps,h=1/60;this.pose();const ux=f.v.x+vx,uy=f.vy+vy,uz=f.v.y+vz;
  this.P.forEach((p,i)=>this.Q[i].set(p.x-ux*h,p.y-uy*h,p.z-uz*h));this.rag=this.rt=sec;this.acc2=0;return true}
 sim(){const P=this.P,Q=this.Q,h=1/60;
  for(let i=0;i<15;i++){const p=P[i],q=Q[i],x=p.x,y=p.y,z=p.z;p.x+=(x-q.x)*.996;p.y+=(y-q.y)*.996-22*h*h;p.z+=(z-q.z)*.996;q.set(x,y,z)}
  for(let k=0;k<8;k++){for(const[a,b,r]of this.cs){const A=P[a],B=P[b],dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,l=Math.hypot(dx,dy,dz)||1e-6,d=(l-r)/l*.5;A.x+=dx*d;A.y+=dy*d;A.z+=dz*d;B.x-=dx*d;B.y-=dy*d;B.z-=dz*d}
   for(let i=0;i<15;i++)this.col(P[i],Q[i])}}
 col(p,q){p.x=clamp(p.x,-RW+.3,RW-.3);p.z=Math.min(p.z,RZ0-.5);
  for(const b of this.boxes)if(p.x>b.x0&&p.x<b.x1&&p.z>b.z0&&p.z<b.z1&&p.y<b.y1-.15){const a=p.x-b.x0,c=b.x1-p.x,d=p.z-b.z0,e=b.z1-p.z,m=Math.min(a,c,d,e);if(m===a)p.x=b.x0;else if(m===c)p.x=b.x1;else if(m===d)p.z=b.z0;else p.z=b.z1}
  const g=this.fps.w.ground(p.x,p.z,p.y)+.08;
  if(p.y<g){const sl=(rh(p.z+.1)-rh(p.z-.1))/.2,l=Math.hypot(1,sl),ny=1/l,nz=-sl/l,d=(g-p.y)*ny;p.y+=d*ny;p.z+=d*nz;q.lerp(p,.04)}}
 stand(){const f=this.fps,h=this.P[2];f.p.set(h.x,f.w.ground(h.x,h.z,h.y),h.z);f.v.set(0,0);f.vy=0;f.on=true;this.inv=1.5;this.pose()}
 char(dt){const f=this.fps;if(this.inv>0)this.inv-=dt;
  if(this.rag>0){this.rag-=dt;this.acc2+=dt;let n=0;while(this.acc2>=1/60&&n++<5){this.acc2-=1/60;this.sim()}if(this.rag<=0){this.rag=0;this.stand()}}
  else{f.pitch=clamp(f.pitch,-.4,1.2);f.update(dt);const sp=Math.hypot(f.v.x,f.v.y);if(sp>.5)this.face=Math.atan2(-f.v.x,-f.v.y);this.ph+=sp*dt*1.5;this.pose()}
  const P=this.P,up=V3(0,1,0),d=V3(0,0,0);CN.forEach((b,i)=>{const A=P[b[0]],B=P[b[1]],m=this.bm[i];d.subVectors(B,A);const l=d.length()||1e-4;m.position.addVectors(A,B).multiplyScalar(.5);m.scale.set(b[2],l,b[2]);m.quaternion.setFromUnitVectors(up,d.divideScalar(l))});this.hd.position.copy(P[0]);
  this.camUpd(dt)}
 blocked(x,y,z){return y<rh(z)+.3||this.boxes.some(b=>x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1&&y<b.y1+.2)}
 camUpd(dt){const f=this.fps,c=this.cam,t=this.rag>0?this.P[2]:f.p,tx=t.x,ty=(this.rag>0?t.y:t.y+.9)+.8,tz=t.z,pc=clamp(f.pitch,-.4,1.2),cp=Math.cos(pc),
  dx=Math.sin(f.yaw)*cp,dy=Math.sin(pc),dz=Math.cos(f.yaw)*cp;let k=1;
  for(let s=1;s<=10;s++){const u=s*.6;if(this.blocked(tx+dx*u,ty+dy*u+.05*u,tz+dz*u)){k=(s-1)/10;break}}
  const u=6*k;c.position.lerp(V3(tx+dx*u,ty+dy*u+.3*k,tz+dz*u),1-Math.exp(-14*dt));c.lookAt(tx,ty,tz)}
 dispose(){disposeScene(this.scene)}}

/* ================= JEU 4 : LE MEC QUI RAGE ================= */
/* 11 catégories × 82 phrases = 902 phrases distinctes, écrites à partir de fragments rédigés à la main (début + cœur + fin) ; {U} = pseudo */
const PHR=(()=>{const X={
 anger:[["NON MAIS","ATTENDS,","OH LÀ LÀ,","C'EST BON,","STOP,"],["C'EST PAS POSSIBLE","J'EN PEUX PLUS","TOUT M'ÉNERVE ICI","JE VAIS EXPLOSER","JE SUIS À BOUT"],["MAINTENANT !","SÉRIEUSEMENT !!","À CHAQUE FOIS !","RAAAH !"]],
 annoy:[["Hé,","Bon,","Mais euh,","Franchement,","Ouf,"],["ça commence à chauffer","tu me cherches un peu là","j'ai les nerfs en pelote","ma patience a des limites","je sens la moutarde monter"],["{U} !","vraiment...","mais je reste calme !","c'est tendu."]],
 humor:[["Alors,","Petit rappel :","Info du jour :","Flash spécial :","Entre nous,"],["mon clavier a peur de moi","je suis calme comme un volcan","ma chaise me juge déjà","le chat trouve que j'exagère","mon T-Rex gère mieux que moi"],["et c'est vrai.","ahah !","{U} peut confirmer.","sans rire."]],
 gift:[["Oh !","Wow !","Hé !","Incroyable !","Quoi ?!"],["merci {U} pour ce cadeau","{U} m'envoie un cadeau","quel cadeau, {U}","{U} est trop généreux","{U} me gâte"],["ça fait plaisir !","je suis ému.","tu es une légende !","je m'y attendais pas !"]],
 like:[["Hop,","Encore !","Ça pique,","Ouch,","Aïe,"],["les likes de {U} font monter la pression","{U} appuie sur mon bouton rouge","{U} like et ma jauge grimpe","chaque like me chauffe un peu plus","{U} me fait bouillir"],["continuez !","je sens que ça monte.","bientôt le point de rupture !","ça devient dangereux."]],
 follow:[["Hey","Salut","Coucou","Yo","Hello"],["{U},","{U}, le nouveau,","{U}, merci pour le follow,","notre ami {U},","{U} rejoint la team,"],["bienvenue dans la famille !","installe-toi bien !","la maison est à toi !","ici ça rage souvent !"]],
 welcome:[["Bonsoir tout le monde,","Salut la team,","Hello les rageux,","Bienvenue au live,","Installez-vous,"],["je suis encore calme","aujourd'hui je tiens bon","ma jauge est à zéro","j'ai juré de ne pas m'énerver","je joue tranquillement"],["pour l'instant !","enfin je crois.","ne me provoquez pas !","on verra bien !"]],
 tease:[["Oh,","Eh,","Dis donc,","Alors,","Vraiment,"],["tu veux me voir exploser","tu crois que je vais craquer","t'aimes me pousser à bout","tu adores me chauffer","tu t'amuses bien"],["{U} ?","hein {U} ?","tu es culotté !","petit malin !"]],
 name:[["{U} !","Ah, {U} !","Regardez, {U} !","Oh, {U} !","Hé {U} !"],["quel pseudo magnifique","j'adore ton pseudo","ton pseudo claque","joli nom de guerrier","pseudo très suspect"],["tu mérites une médaille.","respect.","je te surveille.","continue comme ça !"]],
 crisis:[["AAAH !","RAAAH !","NON NON NON !","ÇA Y EST !","STOP STOP STOP !"],["JE CASSE TOUT","TOUT VA VOLER","JE RETOURNE LA CHAMBRE","PLUS RIEN NE RESTE DEBOUT","C'EST LA FIN DE CETTE CHAMBRE"],["{U} !","À CAUSE DE {U} !","VOUS L'AVEZ VOULU !","REGARDEZ ÇA !"]],
 after:[["Pfff...","Bon...","Ouf...","Bref...","Voilà..."],["je me sens mieux","je vais ranger tout ça","c'était pas ma faute","je recommence à zéro","je respire un grand coup"],["merci {U}.","on ne dit rien.","c'était intense.","promis, je reste calme."]]};
 const o={};for(const k in X){const[a,b,c]=X[k],n=a.length*b.length*c.length,L=[];for(let j=0;j<82;j++){const i=Math.floor(j*n/82);L.push(`${a[i%a.length]} ${b[(i/a.length|0)%b.length]} ${c[(i/(a.length*b.length)|0)%c.length]}`)}o[k]=L}return o})();
const Say={rec:[],t:0,
 pick(c,U){const L=PHR[c];let i,k=0;do{i=(Math.random()*L.length)|0}while(this.rec.includes(c+i)&&++k<40);this.rec.push(c+i);if(this.rec.length>150)this.rec.shift();return L[i].split('{U}').join(U||'toi')},
 say(c,U,pre=''){const tx=pre+this.pick(c,U);this.t=Math.max(1.6,tx.length*.07);const b=$('#bub');b.textContent=tx;b.style.display='block';clearTimeout(this.h);this.h=setTimeout(()=>b.style.display='none',this.t*1e3+500);
  if(S.voice>0&&window.speechSynthesis){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(tx);u.lang='fr-FR';const v=speechSynthesis.getVoices().find(v=>/^fr/i.test(v.lang));if(v)u.voice=v;u.volume=S.voice;
   const ang=c==='crisis'||c==='anger';u.pitch=ang?rnd(.6,1):rnd(.9,1.5);u.rate=ang?rnd(1.1,1.35):rnd(.95,1.15);speechSynthesis.speak(u)}catch{}}return tx}};

const m3=(g,c,o)=>mk(g,c,0,0,0,o),sp3=(r,c,x=1,y=1,z=1,o)=>{const m=m3(new THREE.SphereGeometry(r,16,12),c,o);m.scale.set(x,y,z);return m},
 cy3=(a,b,h,c,o)=>m3(new THREE.CylinderGeometry(a,b,h,16),c,o),cp3=(r,l,c,o)=>m3(new THREE.CapsuleGeometry(r,l,6,14),c,o),bx3=(w,h,d,c,o)=>m3(new THREE.BoxGeometry(w,h,d),c,o),
 pt3=(o,x,y,z,p)=>{o.position.set(x,y,z);if(p)p.add(o);return o},
 gr=(...a)=>{const g=new THREE.Group();a.forEach(([m,x,y,z,rx=0,ry=0,rz=0])=>{m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m)});return g},
 cvt=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},
 angN=d=>((d+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
const OUT={v:0x7b3fe4,b:0x2f7bff,r:0xe03040,g:0x2ed36a},YB=-Math.PI/2+.55,MBX=-1.5,MBZ=.2;
/* expressions : [sourcils, bouche ouverte, sourire, taille des yeux] */
const EXPR={calm:[0,.05,.1,1],angry:[1,.35,-.3,.9],shout:[1.2,1,0,1.15],smile:[-.2,.25,.8,1],shock:[-.9,.75,0,1.4],tired:[-.5,.2,-.4,.55],smug:[.5,.08,.7,.8]};

class Rage{
 constructor(){const q=this.q=QUAL[S.q],sc=this.scene=baseScene(q,0x140b26,14);sc.fog=null;sc.environment=null;
  sc.traverse(o=>{if(o.isHemisphereLight)o.intensity=.55;if(o.isDirectionalLight)o.intensity=.9});
  this.cam=new THREE.PerspectiveCamera(52,1,.1,80);sc.add(this.cam);this.parts=new Particles(sc,q.pt*2);this.parts.o.material.size=.16;
  const L=(c,i,d,x,y,z)=>{const l=new THREE.PointLight(c,i,d,2);l.position.set(x,y,z);sc.add(l);return l};
  L(0x9b5cff,60,20,1,4.8,-4);L(0x2f9bff,45,18,-3.5,3.2,2.5);this.mon=L(0x66aaff,10,6,-2.2,1.6,0);
  this.props=[];this.shots=[];this.decals=[];this.tq=[];this.tqt=0;this.k={sit:1,yaw:YB,px:0,pz:0,lean:0,jmp:0,lx:-.75,lz:-.25,le:-1.15,rx:-.75,rz:-.25,re:-1.15,hx:0,hy:0,hz:0,walk:0,br:0,mo:0,sm:0,ey:1};
  this.wc=new THREE.Color(0x66bbff);this.hv=V3(0,0,0);this.clG=new THREE.PlaneGeometry(.012,.22);this.dcG=new THREE.CircleGeometry(1,14);
  this.bRoom();this.bChair();this.bDesk();this.bRex();this.bMan();this.bCat();this.bExtra();this.reset()}
 prop(g,x,y,z,ry=0){g.position.set(x,y,z);g.rotation.y=ry;this.scene.add(g);const p={g,v:V3(0,0,0),w:V3(0,0,0),hp:V3(x,y,z),hr:ry,st:0,bt:0};this.props.push(p);return p}
 bRoom(){const s=this.scene,F=(o,x,y,z)=>{o.position.set(x,y,z);s.add(o);return o};
  F(bx3(11,.2,11,0x2a2340,{r:.6}),.5,-.1,-.5);F(bx3(11,6,.2,0x3b2f63),.5,3,-6.1);F(bx3(.2,6,11,0x33295a),-5.1,3,-.5);
  F(bx3(11,.07,.07,0xa855f7,{e:0xa855f7}),.5,5.5,-5.95);F(bx3(.07,.07,11,0x2f9bff,{e:0x2f9bff}),-4.95,5.5,-.5);F(bx3(11,.07,.07,0x2f9bff,{e:0x2f9bff}),.5,.5,-5.95);
  F(cy3(2.7,2.7,.03,0x5b2a86,{r:.9}),-1.1,.02,.3);F(cy3(2.2,2.2,.035,0x2a1650),-1.1,.025,.3);
  F(bx3(3.1,.35,2.2,0x2c2a3a),4.2,.18,-4.8);F(bx3(2.95,.25,2.05,0x4d8dff),4.2,.5,-4.8);F(bx3(2,.18,1.5,0x7b3fe4),4.7,.68,-4.7);F(sp3(.4,0xf0f0ff,1.4,.5,1),3.2,.8,-5.1);
  F(sp3(.75,0x6b46c1,1,.7,1),1.3,.4,-4.9);
  for(const y of[2.5,3.5]){F(bx3(3,.08,.5,0x5a4636),-1.2,y,-5.75);for(let i=0;i<7;i++)F(bx3(.14,.45+rnd(0,.2),.32,[0xe03040,0x2f7bff,0xffc83d,0x2ed36a,0xa855f7][i%5]),-2.4+i*.2,y+.28,-5.75)}
  F(sp3(.14,0xffd700,1,1,1,{m:.9,r:.2}),-.2,2.67,-5.75);F(cy3(.12,.08,.3,0xc0c0c0,{m:.9,r:.2}),.2,2.7,-5.75);F(sp3(.15,0xff5577),-.4,3.7,-5.75);
  const po=(t,x,y,z,ry,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t}));m.position.set(x,y,z);m.rotation.y=ry;s.add(m)};
  po(cvt(256,360,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ff3040');g.addColorStop(1,'#7b3fe4');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#fff';c.font='bold 54px Impact,Arial';c.textAlign='center';c.fillText('RAGE',w/2,120);c.fillText('QUIT',w/2,190);c.font='bold 26px Arial';c.fillText('LEVEL 99',w/2,300)}),2,3.4,-5.97,0,1.5,2.1);
  po(cvt(360,256,(c,w,h)=>{c.fillStyle='#0b1b3a';c.fillRect(0,0,w,h);for(let i=0;i<40;i++){c.fillStyle=`hsl(${rnd(180,300)},90%,60%)`;c.fillRect(rnd(0,w),rnd(0,h),rnd(2,30),3)}c.fillStyle='#fff';c.font='bold 44px Arial';c.textAlign='center';c.fillText('GAMER',w/2,140)}),-5.0,3.2,-2,Math.PI/2,2.2,1.5);
  po(cvt(512,128,(c,w,h)=>{c.fillStyle='#0000';c.font='bold 90px Impact,Arial';c.textAlign='center';c.shadowColor='#ff40ff';c.shadowBlur=28;c.fillStyle='#ff9bff';c.fillText('TILT !',w/2,98)}),3.2,4.4,-5.96,0,2.6,.65);
  F(cy3(.04,.04,2.6,0x333344),5.2,1.3,-1.6);F(cy3(.12,.4,.5,0xffe8a0,{e:0x886622}),5.2,2.7,-1.6);F(cy3(.3,.3,.04,0x333344),5.2,.02,-1.6);
  F(sp3(.5,0xc08a3a,1,.9,1),-3.8,.45,-5.2);for(let i=0;i<6;i++)F(sp3(.22,0x2f9a46,.6,1.5,.6),-3.8+rnd(-.2,.2),.95+rnd(0,.5),-5.2+rnd(-.2,.2)).rotation.z=rnd(-.5,.5)}
 bChair(){const c=gr([cy3(.3,.3,.08,0x16161d),0,.34,0],[cp3(.22,.5,0x252533),0,.78,-.27],[sp3(.2,0x7b3fe4,1,.7,.5),0,1.3,-.29],[bx3(.06,.04,.34,0x16161d),-.33,.6,.02],[bx3(.06,.04,.34,0x16161d),.33,.6,.02],[bx3(.04,.2,.04,0x16161d),-.33,.5,0],[bx3(.04,.2,.04,0x16161d),.33,.5,0],[cy3(.04,.04,.28,0x999aaa,{m:.8}),0,.2,0],[bx3(.03,.5,.04,0xff3040,{e:0xaa1020}),-.12,.8,-.33],[bx3(.03,.5,.04,0xff3040,{e:0xaa1020}),.12,.8,-.33]);
  for(let i=0;i<5;i++){const a=i/5*6.283;const r=gr([bx3(.34,.04,.05,0x16161d),.17,.1,0],[sp3(.05,0x222233),.34,.05,0]);r.rotation.y=-a;c.add(r)}
  this.chairP=this.prop(c,MBX,0,MBZ,YB)}
 bDesk(){const s=this.scene,F=(o,x,y,z)=>{o.position.set(x,y,z);s.add(o);return o};
  F(bx3(1.1,.08,3.4,0x2a2a38,{r:.4}),-3.1,.8,0);for(const z of[-1.6,1.6])F(bx3(1,.78,.08,0x1a1a24),-3.1,.4,z);F(bx3(.9,.3,1.1,0x16161d),-3.1,.55,1.0);
  F(cy3(.25,.3,.03,0x222233),-3.35,.86,0);F(cy3(.04,.04,.4,0x222233),-3.35,1.05,0);F(bx3(.06,.95,1.7,0x0b0b12),-3.4,1.5,0);
  this.scr=cvt(256,144,()=>{});this.scr.flipY=true;const sm=new THREE.Mesh(new THREE.PlaneGeometry(1.62,.9),new THREE.MeshBasicMaterial({map:this.scr}));sm.position.set(-3.365,1.5,0);sm.rotation.y=Math.PI/2;s.add(sm);this.sc2=this.scr.image;this.sct=0;
  this.prop(gr([cy3(.12,.14,.04,0x222233),0,.02,0],[cy3(.015,.015,.5,0x444455),0,.27,0],[cy3(.03,.12,.14,0xffc83d,{e:0x886600}),0,.55,.08,.5]),-3.45,.84,-1.3);
  this.prop(gr([cy3(.07,.06,.13,0xf4f4f4),0,.065,0],[m3(new THREE.TorusGeometry(.04,.012,8,12),0xf4f4f4),.08,.07,0]),-2.75,.84,1.1);
  this.prop(gr([bx3(.2,.025,.55,0x15151c),0,.015,0],[bx3(.16,.01,.12,0xa855f7,{e:0xa855f7}),0,.032,-.15],[bx3(.16,.01,.12,0x2f9bff,{e:0x2f9bff}),0,.032,0],[bx3(.16,.01,.12,0xff3040,{e:0xff3040}),0,.032,.15]),-2.7,.84,-.2,Math.PI/2);
  this.prop(gr([sp3(.05,0x15151c,.8,.5,1.3),0,.03,0]),-2.75,.84,.7);
  this.prop(gr([bx3(.3,.05,.4,0x2f7bff),0,.025,0],[bx3(.28,.05,.38,0xffc83d),0,.075,0],[bx3(.26,.05,.36,0xe03040),0,.125,0]),-3.35,.84,1.2,.4);
  this.prop(gr([sp3(.14,0x9be37a,1,1,1),0,.14,0],[sp3(.1,0x9be37a),0,.34,0],[m3(new THREE.ConeGeometry(.04,.1,6),0x9be37a),-.06,.45,0],[m3(new THREE.ConeGeometry(.04,.1,6),0x9be37a),.06,.45,0]),-3.4,.84,-.8,1);
  this.prop(gr([cy3(.04,.04,.12,0xff3040),0,.06,0],[cy3(.04,.04,.12,0x2ed36a),.1,.06,0]),-2.8,.84,-1.0);
  this.prop(gr([bx3(.45,.06,.45,0xd9a066),0,.03,0],[bx3(.45,.02,.45,0xe03040),0,.07,0]),-3.0,.84,-.7,.3);
  this.prop(gr([m3(new THREE.TorusGeometry(.2,.03,8,16,Math.PI),0x15151c),0,.1,0],[cy3(.09,.09,.06,0xa855f7,{e:0x6a2aa0}),-.2,.1,0,0,0,Math.PI/2],[cy3(.09,.09,.06,0xa855f7,{e:0x6a2aa0}),.2,.1,0,0,0,Math.PI/2]),-3.2,2.07,.5,Math.PI/2);
  this.webP=this.prop(gr([bx3(.12,.08,.1,0x15151c),0,.04,0],[sp3(.03,0x66ccff,1,1,1,{e:0x2288aa}),0,.05,.06]),-3.3,1.98,0,Math.PI/2);
  this.prop(gr([cy3(.18,.15,.35,0x3a3a4a,{side:THREE.DoubleSide})],[cy3(.15,.15,.02,0x14141c),0,-.17,0]),-4.2,.18,1.6);
  this.prop(gr([sp3(.3,0xff8fd0,1,.45,.8)]),0,.12,-2.4,.5);
  this.prop(gr([sp3(.1,0x8a5a3a),0,.18,0],[sp3(.07,0x8a5a3a),0,.34,0]),-2.2,.0,1.8)}
 bRex(){const gc=0x3fbf5a,lg=0x9ae8a8,s=this.scene,rx=this.rex=new THREE.Group(),tl=this.rexTail=new THREE.Group(),hd=this.rexHead=new THREE.Group(),jw=this.rexJaw=new THREE.Group();
  pt3(sp3(.4,gc,1,1.05,1.3),0,.65,0,rx);pt3(sp3(.3,lg,.9,.9,1.2),0,.58,.12,rx);rx.add(tl);tl.position.set(0,.65,-.45);pt3(m3(new THREE.ConeGeometry(.22,1,10),gc),0,0,-.45,tl).rotation.x=-Math.PI/2;
  rx.add(hd);hd.position.set(0,1.1,.5);pt3(sp3(.25,gc,1,.95,1.1),0,0,0,hd);pt3(sp3(.17,gc,.9,.7,1.2),0,-.03,.22,hd);hd.add(jw);jw.position.set(0,-.1,.1);pt3(sp3(.14,lg,.85,.4,1.3),0,0,.14,jw);
  for(const sd of[-1,1]){pt3(sp3(.06,0xffffff),sd*.13,.1,.14,hd);pt3(sp3(.03,0x111111),sd*.13,.1,.19,hd);pt3(cp3(.04,.08,gc),sd*.22,.78,.45,rx).rotation.x=-.8;pt3(cp3(.14,.22,gc),sd*.22,.25,.05,rx);pt3(sp3(.15,gc,1,.5,1.6),sd*.22,.05,.15,rx)}
  for(let i=0;i<5;i++)pt3(m3(new THREE.ConeGeometry(.07,.16,6),0xf7c548),0,1.0-i*.08,-.1-i*.2,rx).rotation.x=-.5-i*.1;
  rx.position.set(3.3,0,-1.2);rx.rotation.y=-.6;rx.scale.setScalar(.8);s.add(rx);this.roar=-3}
 bMan(){const s=this.scene,sk=0xf2b98d,hd=OUT[S.outfit]||OUT.v,pants=0x1e2a4a,hair=0x2a1a12,m=this.m={},man=this.man=new THREE.Group(),hips=m.hips=new THREE.Group(),to=m.to=new THREE.Group();man.add(hips);hips.add(cp3(.17,.1,pants));hips.add(to);to.position.y=.05;
  pt3(cp3(.2,.22,hd),0,.3,0,to);pt3(m3(new THREE.TorusGeometry(.14,.05,8,16),hd),0,.66,-.03,to).rotation.x=1.4;pt3(m3(new THREE.CircleGeometry(.06,16),0xffc83d,{e:0x553300}),0,.4,.205,to);pt3(bx3(.3,.12,.03,hd),0,.12,.2,to);
  const he=m.head=new THREE.Group();pt3(he,0,.78,0,to);pt3(sp3(.27,sk,1,1.05,1),0,0,0,he);pt3(sp3(.04,0xe8a67a),0,-.03,.27,he);
  for(const sd of[-1,1]){pt3(sp3(.05,sk,.5,1,1),sd*.27,0,0,he);const eg=pt3(new THREE.Group(),sd*.1,.04,.225,he);eg.add(sp3(.07,0xffffff,1,1,.5));pt3(sp3(.036,0x1a1a2a,1,1,.5),0,0,.03,eg);pt3(sp3(.012,0xffffff),sd*.01,.012,.045,eg);m['e'+sd]=eg;
   const br=pt3(new THREE.Group(),sd*.1,.15,.235,he);br.add(bx3(.12,.026,.02,hair));m['b'+sd]=br;pt3(sp3(.05,0xff9a9a,1,.6,.3),sd*.17,-.05,.21,he)}
  m.mo=pt3(sp3(.07,0x5a0b14,1,.17,.4),0,-.11,.235,he);m.te=pt3(bx3(.08,.015,.01,0xffffff),0,-.092,.255,he);
  const hr=m.hair=new THREE.Group();pt3(hr,0,.03,-.02,he);hr.rotation.x=-.2;hr.add(m3(new THREE.SphereGeometry(.29,18,12,0,6.283,0,1.5),hair));
  for(let i=0;i<9;i++){const a=i/9*6.283;pt3(m3(new THREE.ConeGeometry(.07,.2,8),hair),Math.cos(a)*.2,.22,Math.sin(a)*.2,hr).rotation.set(Math.sin(a)*.7,0,-Math.cos(a)*.7)}
  for(let i=0;i<5;i++)pt3(m3(new THREE.ConeGeometry(.06,.18,8),hair),(i-2)*.1,.17,.2,hr).rotation.x=1.3;
  pt3(m3(new THREE.TorusGeometry(.3,.025,8,20,Math.PI),0x15151c),0,0,0,he);
  for(const sd of[-1,1]){pt3(cy3(.09,.09,.06,0x15151c),sd*.29,0,0,he).rotation.z=Math.PI/2;pt3(cy3(.07,.07,.065,0xa855f7,{e:0xa855f7}),sd*.29,0,0,he).rotation.z=Math.PI/2;
   const sh=pt3(new THREE.Group(),sd*.28,.48,0,to),el=pt3(new THREE.Group(),0,-.3,0,sh);pt3(cp3(.075,.2,hd),0,-.17,0,sh);pt3(cp3(.065,.2,hd),0,-.17,0,el);pt3(sp3(.07,sk),0,-.38,0,el);pt3(sp3(.085,hd),0,-.02,0,sh);m['s'+sd]=sh;m['l'+sd]=el;
   const lg=pt3(new THREE.Group(),sd*.11,0,0,hips),kn=pt3(new THREE.Group(),0,-.4,0,lg);pt3(cp3(.09,.24,pants),0,-.22,0,lg);pt3(cp3(.075,.24,pants),0,-.22,0,kn);pt3(sp3(.1,0xffffff,1,.55,1.6),0,-.46,.07,kn);pt3(sp3(.1,0x7b3fe4,1.05,.2,1.65),0,-.5,.07,kn);m['g'+sd]=lg;m['k'+sd]=kn}
  const pad=()=>gr([cp3(.04,.16,0x15151c),0,0,0,0,0,Math.PI/2],[sp3(.03,0x333344),-.08,.04,.02],[sp3(.03,0x333344),.04,.04,-.03],[sp3(.016,0xff3040),.09,.045,.03],[sp3(.016,0x2ed36a),.12,.045,0],[sp3(.016,0x2f7bff),.1,.045,-.03]);
  m.ctrl=pt3(pad(),0,.38,.58,to);this.padP=this.prop(pad(),0,0,0);this.padP.g.visible=false;
  man.position.set(MBX,0,MBZ);man.rotation.y=YB;s.add(man);m.ey=0;this.blink=2;this.ph=0}
 bCat(){const c=0xe58a2e,g=this.catG=gr([cp3(.13,.3,c),0,.3,0,Math.PI/2],[sp3(.13,c),0,.42,.32],[m3(new THREE.ConeGeometry(.05,.12,6),c),-.07,.56,.32],[m3(new THREE.ConeGeometry(.05,.12,6),c),.07,.56,.32],[sp3(.025,0x222222),-.05,.44,.43],[sp3(.025,0x222222),.05,.44,.43],[cy3(.03,.03,.25,c),-.07,.12,.18],[cy3(.03,.03,.25,c),.07,.12,.18],[cy3(.03,.03,.25,c),-.07,.12,-.18],[cy3(.03,.03,.25,c),.07,.12,-.18]);
  const tail=gr([cp3(.03,.3,c),0,.2,0]);tail.position.set(0,.32,-.32);tail.rotation.x=-.8;g.add(tail);this.paw=cy3(.035,.035,.22,c);this.paw.position.set(.1,.32,.38);this.paw.rotation.x=1.2;g.add(this.paw);g.visible=false;this.scene.add(g);this.ct=null}
 bExtra(){const s=this.scene;this.showerG=gr([cy3(.04,.04,2,0x999aaa,{m:.8}),0,2.4,0],[cy3(.35,.2,.12,0xbbbbcc,{m:.8}),0,1.4,0]);this.showerG.position.set(MBX,2,MBZ);this.showerG.visible=false;s.add(this.showerG);
  this.clM=new THREE.MeshBasicMaterial({color:0xffb0b0,transparent:true});
  this.tomG=new THREE.SphereGeometry(.13,12,10);this.tomM=new THREE.MeshStandardMaterial({color:0xe02020,roughness:.4});this.eggG=new THREE.SphereGeometry(.09,12,10);this.eggM=new THREE.MeshStandardMaterial({color:0xfff4e0,roughness:.5})}
 /* ---------- état ---------- */
 reset(){this.rage=0;this.la=0;this.mode='play';this.mt=0;this.time=0;this.cu={};this.sh=0;this.xt=0;this.hitk=0;this.shk=0;this.who='Spectateur';this.tq.length=0;this.endCat();
  this.shots.forEach(o=>this.scene.remove(o.m));this.shots=[];this.decals.forEach(d=>d.m.parent?.remove(d.m));this.decals=[];
  this.props.forEach(p=>{p.st=0;p.g.position.copy(p.hp);p.g.rotation.set(0,p.hr,0);p.g.scale.setScalar(1)});this.padP.g.visible=false;this.m.ctrl.visible=true;$('#crack').classList.remove('on');
  Object.assign(this.k,{sit:1,yaw:YB,px:0,pz:0,lean:0,jmp:0});this.wel=1.2;ev(`Bibliothèque : ${Object.values(PHR).reduce((a,l)=>a+l.length,0)} phrases`)}
 progress(){return this.rage/100}
 label(){return `Rage ${Math.round(this.rage)} % · ❤ ${this.la}/${S.lkR} (prochain lancer) · crises ${App.wins}/5`}
 complete(){return false}
 talk(c,who,pre='',force){if(!force&&Say.t>.25)return;if(!force&&c==='like'&&Math.random()<.2)c='tease';if(!force&&Math.random()<.15)c='name';Say.say(c,who,pre)}
 like(n,who){this.who=who;this.la+=n;let fire=0;while(this.la>=Math.max(1,S.lkR)){this.la-=Math.max(1,S.lkR);fire++}
  if(fire){for(let i=0;i<fire&&this.tq.length<80;i++){for(let j=0;j<3;j++)this.tq.push('T');for(let j=0;j<5;j++)this.tq.push('E')}
   if(this.mode!=='crisis')this.rage=Math.min(100,this.rage+fire*S.lkRp);ev(`❤ ${who} · seuil atteint : 3 tomates + 5 œufs, rage +${fire*S.lkRp} %`);this.talk('like',who)}}
 gift(g,qty,who){const n=g.n;qty=Math.max(1,qty|0);this.who=who;
  if(n==='Rose'){for(let i=0;i<qty&&this.tq.length<80;i++)this.tq.push('T');this.talk('gift',who,'UNE TOMATE ! ')}
  else if(n==='GG'){for(let i=0;i<qty&&this.tq.length<80;i++)this.tq.push('E');this.talk('gift',who,'UN ŒUF ! ')}
  else if(n==='Capybara'||n==='Parfum'||n==='Cœur dans les mains'){
   if(this.mode==='crisis'){ev('Crise en cours : cadeau sans effet');return}
   if(n==='Capybara'){this.sh=Math.min(24,this.sh+4*qty);this.mode==='follow'&&(this.mode='play');this.talk('gift',who,'BRRR, LA DOUCHE ! ',1)}
   else if(n==='Parfum'){const d=Math.min(20,5+2.5*(qty-1));if(this.ct)this.ct.d=Math.min(24,this.ct.d+d);else this.ct={u:0,d:d+1.9,sc:.3};this.catG.visible=true;this.mode==='follow'&&(this.mode='play');this.talk('gift',who,'LE CHAT ! ',1)}
   else{this.rage=100;this.mode==='follow'&&(this.mode='play');this.talk('gift',who,'MON CŒUR ! ',1)}}}
 follow(who){this.who=who;if(this.mode==='crisis'||this.rage>=100)return;this.mode='follow';this.mt=0;Say.say('follow',who);banner('👤 '+who)}
 endCat(){this.ct=null;if(this.catG)this.catG.visible=false}
 startCrisis(){this.mode='crisis';this.mt=0;this.cu={};this.sh=0;this.endCat();ev(`🔥 CRISE DE RAGE ! (${this.who})`)}
 hw(){return this.m.head.getWorldPosition(this.hv)}
 shoot(kind){const T=kind==='T',m=new THREE.Mesh(T?this.tomG:this.eggG,T?this.tomM:this.eggM);if(!T)m.scale.set(.85,1.1,.85);const st=V3(this.cam.position.x+rnd(-3,3),rnd(.6,2.2),6.5);m.position.copy(st);this.scene.add(m);this.shots.push({m,s:0,st,T});Snd.tone(300,150,.1,'triangle',.2)}
 dec(g,col,x,y,r,sy,ttl){const m=new THREE.Mesh(this.dcG,new THREE.MeshBasicMaterial({color:col,transparent:true}));m.position.set(x,y,.262);m.scale.set(r,r*sy,1);this.m.head.add(m);this.decals.push({m,ttl,mt:ttl});if(this.decals.length>40){const d=this.decals.shift();d.m.parent?.remove(d.m);d.m.material.dispose()}}
 hit(T){const h=this.hw(),c=T?0xd01818:0xfff0b0;this.dec(0,c,rnd(-.12,.12),rnd(-.08,.15),rnd(.06,.1),1,8);for(let i=0;i<3;i++)this.dec(0,c,rnd(-.18,.18),rnd(-.15,.2),rnd(.015,.035),1.3,8);
  if(!T)this.dec(0,0xffb400,rnd(-.08,.08),rnd(-.05,.1),.03,1,8);this.parts.emit(h.x,h.y,h.z+.1,T?0xe02020:0xfff4cc,30,3.5,1.5);Snd.pop();this.hitk=1;this.xt=1;this.xn='shock';this.shk=Math.max(this.shk,.25);
  if(this.mode!=='crisis')this.talk('annoy',this.who,T?'SPLATCH ! ':'CRAC ! ')}
 claw(){const o=rnd(-.08,.08);for(let i=-1;i<=1;i++){const m=new THREE.Mesh(this.clG,this.clM.clone());m.position.set(o+i*.05,rnd(-.02,.05),.264);m.rotation.z=.6;this.m.head.add(m);this.decals.push({m,ttl:3.5,mt:3.5})}Snd.tone(900,400,.08,'sawtooth',.15);this.hitk=.7;this.talk('annoy',this.who,'AÏE ! ')}
 camBreak(){$('#crack').classList.add('on');Snd.boom();Snd.noise(.6,.8,6000);this.shk=1.3;const c=this.cam.position;this.parts.emit(c.x,c.y-.5,c.z-3,0xcfe8ff,90,7,1);const w=this.webP;w.st=1;w.v.set(rnd(-2,2),5,rnd(2,5));w.w.set(8,6,4)}
 fling(p){p.st=1;p.v.set(rnd(-6,3),rnd(3,7),rnd(-2,4));p.w.set(rnd(-8,8),rnd(-8,8),rnd(-8,8));Snd.tone(200,70,.15,'square',.18);const q=p.g.position;this.parts.emit(q.x,q.y+.3,q.z,0xffffff,12,3,1)}
 finish(){this.mode='play';this.mt=0;this.rage=0;this.props.forEach(p=>{if(p.st){p.st=0;p.g.position.copy(p.hp);p.g.rotation.set(0,p.hr,0)}});this.padP.g.visible=false;this.m.ctrl.visible=true;$('#crack').classList.remove('on');
  App.changeWins(1,'(crise de rage)');banner(`RAGE ${App.wins}/5`)}
 /* ---------- script de la grande crise (≈18 s) ---------- */
 crisisT(u,T){const O=(n,a,f)=>{if(u>=a&&!this.cu[n]){this.cu[n]=1;f()}},sn=Math.sin,fc=c=>this.talk(c,this.who,'',1);T.sp=14;let ex='angry';this.mox=null;
  if(u<.7){T.sit=1-ease(u/.7);T.lean=.25;T.lx=T.rx=-1.6;T.le=T.re=-1;ex='shock'}else{T.sit=0;ex=['shout','angry','shout','smug','shout'][(u/1.6|0)%5]}
  O('c0',.1,()=>fc('crisis'));
  O('kick',.6,()=>{const p=this.chairP;p.st=1;p.v.set(5.5,2.5,-1);p.w.set(0,7,2);Snd.boom();const q=this.padP;q.g.position.copy(this.m.ctrl.getWorldPosition(this.hv));q.g.visible=true;q.st=1;q.v.set(-3,5,3);q.w.set(9,5,3);this.m.ctrl.visible=false});
  if(u>=.7&&u<3.6){T.yaw=YB+(0-YB)*ease((u-.7)/1.1);const a=u*15;T.lx=-2.7+sn(a)*.7;T.rx=-2.7+sn(a+3)*.7;T.lz=T.rz=.5;T.le=-.5+sn(a)*.4;T.re=-.5-sn(a)*.4;T.jmp=Math.abs(sn(u*7))*.22;T.hx=-.25;T.hz=sn(u*12)*.18}
  O('c1',2.1,()=>fc('anger'));
  if(u>=3.6&&u<5.8){T.yaw=0;T.walk=1;T.pz=3.4*ease((u-3.6)/1.7);T.lx=-1.3;T.rx=-1.3;T.le=T.re=-1.7;T.lz=T.rz=-.2;T.lean=.2;if(u>5.2&&u<5.75){T.re=-.1;T.rx=-3}}
  O('c2',3.7,()=>fc('crisis'));O('smash',5.55,()=>this.camBreak());
  if(u>=5.8&&u<12.6){const a=u-5.8;T.yaw=-Math.PI/2+.3*sn(a);T.pz=3.4*(1-ease(a/1.3));T.px=-.3*ease(a/1.3);T.walk=a<1.4?1:.3;T.lx=-1.2+sn(u*9)*1.1;T.rx=-1.2+sn(u*9+2)*1.1;T.lz=T.rz=.9;T.le=T.re=-.7;T.jmp=Math.abs(sn(u*5))*.25;T.lean=.25*sn(u*4)}
  this.order=this.order||this.props.filter(p=>p!==this.chairP&&p!==this.padP&&p!==this.webP);this.order.forEach((p,i)=>O('L'+i,6+i*.42,()=>this.fling(p)));
  O('c3',6.1,()=>fc('crisis'));O('c4',8.6,()=>fc('anger'));O('c5',10.8,()=>fc('crisis'));
  if(u>=12.6&&u<14.6){ex='tired';T.lean=.85;T.lx=T.rx=-.1;T.le=T.re=-.15;T.px=-.3;T.yaw=-Math.PI/2+.2;T.hx=.3;T.sp=5;this.mox=.3+.3*Math.abs(sn(u*8))}
  O('aft',12.8,()=>fc('after'));
  if(u>=14.6){const f=u-14.6;ex=f>1.8?'smug':'tired';T.px=-.3*(1-ease(f/1.6));T.walk=f<1.6?.8:0;T.yaw=-Math.PI/2+.3*sn(1)*0+(YB+Math.PI/2)*ease((f-1)/1)+(-Math.PI/2-(-Math.PI/2));T.yaw=-Math.PI/2+(YB+Math.PI/2)*ease((f-1)/1.2);T.sit=ease((u-16.6)/1.1);
   if(u<16.4){T.lx=T.rx=-.15;T.le=T.re=-.2;T.lz=T.rz=0}}
  O('rest',14.6,()=>this.props.forEach(p=>{if(p.st===1){p.st=2;p.bt=rnd(0,1.2)}}));O('pad',16.5,()=>{this.padP.st=3});O('fin',18.3,()=>this.finish());
  this.cex=ex}
 phys(dt){for(const p of this.props){const g=p.g;
  if(p.st===1){p.v.y-=20*dt;g.position.addScaledVector(p.v,dt);g.rotation.x+=p.w.x*dt;g.rotation.y+=p.w.y*dt;g.rotation.z+=p.w.z*dt;const q=g.position;
   if(q.y<.05){q.y=.05;if(p.v.y<-2)Snd.tone(180,60,.1,'square',.1);p.v.y*=-.3;p.v.x*=.7;p.v.z*=.7;p.w.multiplyScalar(.6)}
   if(q.x<-4.7||q.x>5.6){q.x=clamp(q.x,-4.7,5.6);p.v.x*=-.5}if(q.z<-5.6||q.z>4.2){q.z=clamp(q.z,-5.6,4.2);p.v.z*=-.5}}
  else if(p.st===2){p.bt-=dt;if(p.bt<=0){const k=1-Math.exp(-dt*5);g.position.lerp(p.hp,k);g.rotation.x*=1-k;g.rotation.z*=1-k;g.rotation.y+=angN(p.hr-g.rotation.y)*k;if(g.position.distanceTo(p.hp)<.03){g.position.copy(p.hp);g.rotation.set(0,p.hr,0);p.st=0}}}
  else if(p.st===3){const t=this.m.ctrl.getWorldPosition(this.hv);g.position.lerp(t,1-Math.exp(-dt*6));g.rotation.x*=.9;g.rotation.z*=.9;g.scale.multiplyScalar(1-dt*1.5);if(g.position.distanceTo(t)<.25||g.scale.x<.3){p.st=0;g.visible=false;g.scale.setScalar(1);this.m.ctrl.visible=true}}}}
 /* ---------- boucle ---------- */
 update(dt){const t=this.time+=dt,u=this.mt+=dt,m=this.m,k=this.k,R=this.rage/100,sn=Math.sin;Say.t=Math.max(0,Say.t-dt);this.mox=null;
  if(this.wel>0){this.wel-=dt;if(this.wel<=0)Say.say('welcome')}
  if(this.rage>=100&&this.mode==='play'){this.startCrisis()}
  const T={sp:9,sit:1,yaw:YB,px:0,pz:0,lean:0,jmp:0,lx:-.75,lz:-.25,le:-1.15+sn(t*9)*.04,rx:-.75,rz:-.25,re:-1.15+sn(t*8+1)*.04,hx:.12,hy:sn(t*.7)*.15,hz:sn(t*37)*.05*R,walk:0};
  let ex=R>.75?'angry':R>.4?'smug':'calm';
  if(this.mode==='follow'){const a=u>.4&&u<3.4;T.sit=u<.5?1-ease(u/.5):u>3.4?ease((u-3.4)/.6):0;T.yaw=u<3.4?YB+(.2-YB)*ease(u/.6):.2+(YB-.2)*ease((u-3.4)/.6);if(a){T.rx=-2.9;T.rz=.5;T.re=-.5+sn(u*11)*.6;T.jmp=Math.abs(sn(u*6))*.1}ex='smile';m.ctrl.visible=u>3.8;if(u>4.2){this.mode='play';m.ctrl.visible=true}}
  else if(this.mode==='crisis')this.crisisT(u,T);
  else{
   if(this.sh>0){this.sh-=dt;this.rage=Math.max(0,this.rage-70*dt);T.lx=T.rx=-2.4;T.lz=T.rz=.6;T.le=T.re=-.8;T.hz=sn(t*25)*.1;ex=this.sh>1?'shock':'tired';this.showerG.visible=true;
    for(let i=0;i<14;i++)this.parts.put(MBX+rnd(-.5,.5),3.4,MBZ+rnd(-.5,.5),rnd(-.3,.3),-2,rnd(-.3,.3),this.wc,1.1)}else this.showerG.visible=false;
   if(this.ct){const c=this.ct,g=this.catG,h=this.hw().clone(),f=V3(sn(k.yaw),0,Math.cos(k.yaw)),tg=h.clone().addScaledVector(f,.36);tg.y-=.1;c.u+=dt;let p;
    if(c.u<1.4){const a=c.u/1.4;p=V3(5.8+(tg.x-5.8)*a,Math.abs(sn(a*18))*.1,MBZ+1.2+(tg.z-MBZ-1.2)*a)}
    else if(c.u<1.9){const a=(c.u-1.4)/.5;p=V3(tg.x,tg.y*a+sn(Math.PI*a)*.5,tg.z)}
    else if(c.u<c.d-.7){p=tg.clone();p.x+=rnd(-.01,.01);c.sc-=dt;if(c.sc<=0){c.sc=.45;this.claw()}this.paw.rotation.x=1.2+sn(t*30)*.9;
     T.lx=-1.8+sn(t*18)*.9;T.rx=-1.8-sn(t*18)*.9;T.lz=T.rz=.5;T.le=T.re=-.7;T.hz=sn(t*14)*.3;ex='shout'}
    else{const a=clamp((c.u-(c.d-.7))/.7,0,1);p=tg.clone().lerp(V3(6.4,0,tg.z+1),a);p.y+=sn(Math.PI*a)*.7;if(c.u>=c.d)this.endCat()}
    if(this.ct){g.position.copy(p);g.rotation.y=Math.atan2(h.x-p.x,h.z-p.z)}}
   if(this.mode==='play'&&this.sh<=0&&!this.ct&&this.xt<=0&&R>.7)T.lx+=sn(t*40)*.05}
  /* tirs */
  this.tqt-=dt;if(this.tq.length&&this.tqt<=0){this.tqt=.28;this.shoot(this.tq.shift()==='T'?'T':'E')}
  const hp=this.hw();for(const o of this.shots){o.s+=dt/.75;const a=Math.min(1,o.s);o.m.position.lerpVectors(o.st,hp,a);o.m.position.y+=1.1*sn(Math.PI*a);o.m.rotation.x+=dt*9;if(o.s>=1){o.dead=true;this.scene.remove(o.m);this.hit(o.T)}}this.shots=this.shots.filter(o=>!o.dead);
  for(let i=this.decals.length-1;i>=0;i--){const d=this.decals[i];d.ttl-=dt;d.m.material.opacity=Math.min(1,d.ttl/1.2);if(d.ttl<=0){d.m.parent?.remove(d.m);d.m.material.dispose();this.decals.splice(i,1)}}
  /* expression */
  if(this.xt>0){this.xt-=dt;ex=this.xn}else if(this.mode==='crisis')ex=this.cex;
  const E=EXPR[ex]||EXPR.calm,ds=1-Math.exp(-dt*14);this.hitk=Math.max(0,this.hitk-dt*2.5);
  const spk=Say.t>0?.25+.5*Math.abs(sn(t*17)):0;
  for(const q in T){if(q!=='sp')k[q]+=(T[q]-k[q])*Math.min(1,dt*T.sp)}k.yaw=T.yaw;
  k.br+=(E[0]-k.br)*ds;k.mo+=(Math.max(E[1],spk,this.mox||0)-k.mo)*ds;k.sm+=(E[2]-k.sm)*ds;k.ey+=(E[3]-k.ey)*ds;
  /* application du squelette */
  this.ph+=dt*8*k.walk;const sw=sn(this.ph)*k.walk,bl=(t%3.3)<.12?.1:1;
  m.hips.position.y=.46+.4*(1-k.sit)+Math.max(0,k.jmp)+Math.abs(sn(this.ph))*.04*k.walk;this.man.position.set(MBX+k.px,0,MBZ+k.pz);this.man.rotation.y=k.yaw;m.to.rotation.x=k.lean;
  for(const sd of[-1,1]){const L=sd<0;m['g'+sd].rotation.x=-1.5*k.sit+sw*sd*.7;m['k'+sd].rotation.x=1.5*k.sit+Math.max(0,sw*sd)*.6;
   m['s'+sd].rotation.set(L?k.lx:k.rx,0,sd*(L?k.lz:k.rz));m['l'+sd].rotation.x=L?k.le:k.re;
   m['b'+sd].rotation.z=sd*k.br*.5;m['b'+sd].position.y=.15+(k.br<0?-k.br*.03:0);m['e'+sd].scale.set(1,k.ey*bl,1)}
  m.head.rotation.set(k.hx+this.hitk*.35,k.hy,k.hz+this.hitk*sn(t*40)*.12);m.mo.scale.set(.075+.02*k.sm,.012+.075*k.mo,.03);m.te.visible=k.mo<.4;m.hair.rotation.z=this.sh>0?.2:0;
  /* décor vivant */
  this.rexTail.rotation.y=sn(t*3)*.4;this.rexHead.rotation.set(sn(t*1.3)*.05,sn(t*.8)*.3,0);this.roar-=dt;this.rexJaw.rotation.x=this.roar>0?.5*Math.abs(sn(t*14)):0;if(this.roar<-9){this.roar=1.2;Snd.tone(220,70,.5,'sawtooth',.15)}
  this.rex.position.y=this.mode==='crisis'?Math.abs(sn(t*9))*.2:0;this.rex.rotation.z=this.mode==='crisis'?sn(t*20)*.1:0;
  this.sct-=dt;if(this.sct<=0){this.sct=.18;const x=this.sc2.getContext('2d'),w=256,h=144;x.fillStyle=this.mode==='crisis'?'#300':'#0a1030';x.fillRect(0,0,w,h);
   for(let i=0;i<9;i++){x.fillStyle=`hsl(${rnd(180,320)},90%,55%)`;x.fillRect(rnd(0,w-30),rnd(0,h-12),rnd(10,60),rnd(4,14))}x.fillStyle='#2ed36a';x.fillRect(8,8,100*(1-R),8);x.fillStyle='#ff3040';x.fillRect(8,20,100*R,8);x.fillStyle='#fff';x.font='bold 18px Arial';x.fillText(this.mode==='crisis'?'GAME OVER':'LEVEL 7',w-110,h-10);this.scr.needsUpdate=true}
  this.mon.intensity=9+sn(t*8)*2;
  this.phys(dt);
  /* caméra stable, très légère dérive */
  this.shk=Math.max(0,this.shk-dt*1.2);const c=this.cam;c.position.set(1.4+sn(t*.3)*.2+rnd(-1,1)*this.shk*.15,3.6+sn(t*.4)*.08+rnd(-1,1)*this.shk*.15,11.2);c.lookAt(-1.1,1.5,.2);
  this.parts.update(dt)}
 dispose(){try{speechSynthesis.cancel()}catch{}$('#bub').style.display='none';$('#crack').classList.remove('on');this.decals.forEach(d=>d.m.material.dispose());disposeScene(this.scene)}}

/* ================= Application : manager, WIN, HUD, test, TikFinity ================= */
const renderer=new THREE.WebGLRenderer({canvas:$('#c'),antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const cv=$('#c');
const App={g:null,wins:0,cd:null,paused:false,test:false,likeAcc:0,env:null,lastN:0,locked:false,
 goal(){return this.g instanceof Rage?5:S.win},
 start(kind,col){this.stop(true);this.wins=0;this.likeAcc=0;this.cd=null;this.paused=false;this.g=kind==='g1'?new Quarry():kind==='g3'?new Ramp():kind==='g4'?new Rage():new Paint(col);this.resize();
  $('#menu').classList.remove('on');$('#hud').style.display='block';$('#test').classList.add('on');$('#cross').style.display=kind==='g3'||kind==='g4'?'none':'block';
  $('#gbar').style.display=kind==='g4'?'flex':'none';$('#fill').style.background=kind==='g4'?'linear-gradient(90deg,#ffc83d,#ff3040)':'';
  this.hud();this.lockUI();ev(kind==='g4'?'Le mec qui rage lancé':kind==='g1'?'Fosse aux billes lancée':kind==='g3'?'Rampe aux fruits lancée':'Bataille de peinture lancée')},
 stop(keep){if(this.g){this.g.dispose();this.g=null}Snd.vac(false);document.exitPointerLock?.();$('#hud').style.display='none';$('#cross').style.display='none';$('#lock').style.display='none';$('#cd').style.display=$('#banner').style.display='none';$('#gbar').style.display='none';$('#crack').classList.remove('on');$('#bub').style.display='none';try{speechSynthesis.cancel()}catch{}if(!keep)$('#menu').classList.add('on')},
 lockUI(){$('#lock').style.display=this.g&&!(this.g instanceof Rage)&&!this.locked&&!this.paused?'block':'none'},
 resize(){renderer.setSize(innerWidth,innerHeight,false);if(this.g){this.g.cam.aspect=innerWidth/innerHeight;this.g.cam.updateProjectionMatrix()}},
 hud(){$('#wins').textContent=this.wins;$('#tgt').textContent=this.goal();$('#wl').textContent=this.g instanceof Rage?'RAGES':'WIN';$$('[data-k=win]').forEach(e=>e.value=S.win)},
 changeWins(d,why){const o=this.wins;this.wins=Math.max(0,this.wins+d);this.hud();if(this.wins!==o)ev(`${this.wins-o>0?'+':''}${this.wins-o} WIN ${why||''}`);
  if(this.wins>=this.goal()&&this.g){this.paused=true;M.down=false;Snd.vac(false);document.exitPointerLock?.();$('#goal h2').textContent=this.g instanceof Rage?'VICTOIRE ! 5 RAGES':'Objectif atteint !';$('#goal').classList.add('on')}},
 gift(name,qty,who){const g=findGift(name);qty=Math.max(1,+qty||1);if(!g){ev(`Cadeau ignoré : ${name}`);return}
  ev(`🎁 ${who} · ${qty}× ${g.n}`);Snd.chime();if(!this.g)return;
  if(g.w){this.changeWins(g.w*qty,`(${g.n})`);banner(`${g.w*qty>0?'+':''}${g.w*qty} WIN`)}else this.g.gift(g,qty,who)},
 /* réglage de likes commun aux 3 jeux (par palier : 1 bombe rouge (peinture), 50 billes (fosse), 10 fruits (rampe)) ; le jeu 4 gère son propre seuil */
 likes(n,who){const g=this.g;if(!g)return;if(g instanceof Rage){g.like(n,who);return}const t=g instanceof Paint?['lkB','lkBn','bombe(s) rouge(s)']:g instanceof Quarry?['lkM','lkMn','bille(s)']:['lkF','lkFn','fruit(s)'];
  this.likeAcc+=n;const per=Math.max(1,S[t[0]]),b=Math.floor(this.likeAcc/per);if(b>0){this.likeAcc-=b*per;const q=b*Math.max(1,S[t[1]]);g.like(q);ev(`❤ ${who} · ${n} likes → ${q} ${t[2]}`)}},
 follow(who){ev(`👤 ${who} · nouveau follow`);Snd.chime();if(this.g?.follow)this.g.follow(who)},
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
   Les cadeaux sont reconnus automatiquement par leur nom (GIFTS) : aucune action à créer dans TikFinity. Événements : gift, like, follow. */
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
  else if(m.event==='follow'){App.follow(who)}
  else if(m.event==='like'){const n=+d.likeCount||+d.count||1;this.likes+=n;App.likes(n,who)}}};

/* ================= Événements d'interface ================= */
$$('[data-k]').forEach(e=>{e.value=S[e.dataset.k];e.oninput=()=>{const k=e.dataset.k;S[k]=e.tagName==='SELECT'?e.value:(e.value===''||isNaN(+e.value)?DEF[k]:+e.value);save();apply()}});
GIFTS.forEach(g=>{const b=document.createElement('button');b.className='b';b.textContent=g.n;b.onclick=()=>App.gift(g.n,$('#tQty').value,$('#tName').value||'Testeur');$('#tGifts').append(b)});
$('#tFollow').onclick=()=>App.follow($('#tName').value||'Testeur');
$('#tLike').onclick=()=>App.likes(+$('#tLikeN').value||1,$('#tName').value||'Testeur');
const show=id=>$('#'+id).classList.add('on'),lock=()=>{try{const r=cv.requestPointerLock();r?.catch?.(()=>{})}catch{}};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;Snd.init();const a=b.dataset.a,col=b.dataset.col;
 if(col){$('#pick').classList.remove('on');App.start('g2',+col);lock()}
 else if(a==='g1'){App.start('g1');lock()}else if(a==='g3'){App.start('g3');lock()}else if(a==='g4')App.start('g4');else if(a==='g2')show('pick');else if(a==='set')show('set');else if(a==='conn')show('conn');
 else if(a==='test'){App.test=!App.test;document.body.classList.toggle('test',App.test);b.querySelector('span')?b.querySelector('span').textContent='Mode test : '+(App.test?'activé':'désactivé'):b.textContent='Mode test : '+(App.test?'activé':'désactivé')}
 else if(a==='close')b.closest('.pane').classList.remove('on');
 else if(a==='fs')document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
 else if(a==='again'){$('#goal').classList.remove('on');const g=App.g;App.wins=0;App.paused=false;App.cd=null;g.reset();App.hud();if(!(g instanceof Rage))lock()}
 else if(a==='menu'){$('#goal').classList.remove('on');App.stop()}
 else if(b.id==='back')App.stop();else if(b.id==='cGo')Conn.go();else if(b.id==='cStop')Conn.stop()});
document.addEventListener('pointerlockchange',()=>{App.locked=document.pointerLockElement===cv;if(!App.locked)M.down=false;App.lockUI()});
document.addEventListener('mousemove',e=>{const g=App.g;if(!App.locked||!g||!g.fps||App.paused||g.fps.rag>0)return;const k=.0022*S.sens;g.fps.yaw-=e.movementX*k;g.fps.pitch=clamp(g.fps.pitch-e.movementY*k,-1.5,1.5)});
cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;Snd.init();if(App.locked)M.down=true;else if(App.g&&!App.paused&&!(App.g instanceof Rage))lock()});
addEventListener('pointerup',()=>M.down=false);addEventListener('blur',()=>{M.down=false;for(const k in K)K[k]=false});cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(App.locked&&e.code==='Space')e.preventDefault();K[e.code]=true});addEventListener('keyup',e=>K[e.code]=false);
addEventListener('resize',()=>App.resize());
addEventListener('error',e=>ev('Erreur : '+e.message));
$('#cUrl').value=S.url||DEF.url;Conn.stats();Conn.set('','déconnecté');if(S.auto)Conn.go();
apply();requestAnimationFrame(t=>App.loop(t));
